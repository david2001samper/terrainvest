import { fetchMarketPrice } from "@/lib/market-price";
import { simulatePrice } from "@/lib/price-simulator";
import { isMarketOpen, resolveAssetTypeFromSymbol } from "@/lib/market-hours";
import {
  parseForexSymbol,
  inferPipSize,
  DEFAULT_CONTRACT_SIZE,
} from "@/lib/forex/instruments";
import { midToBidAsk } from "@/lib/forex/pricing";
import { convertToUSD } from "@/lib/forex/convert";
import { computeSwapDeltaUsd } from "@/lib/forex/swap";

type ServiceClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createServiceClient>>;

type OrderRow = {
  id: string;
  user_id: string;
  symbol: string;
  side: "buy" | "sell";
  order_type: "limit" | "stop" | "stop-limit";
  quantity: number;
  limit_price: number | null;
  stop_price: number | null;
  status: "open" | "filled" | "cancelled" | "expired";
};

type ProfileRow = {
  id: string;
  balance: number;
  total_pnl: number;
  is_locked: boolean | null;
  max_leverage: number | null;
  can_trade_crypto: boolean | null;
  can_trade_stocks: boolean | null;
  can_trade_indexes: boolean | null;
  can_trade_commodities: boolean | null;
  can_trade_forex: boolean | null;
};

type ProcessSummary = {
  scanned: number;
  triggered: number;
  filled: number;
  cancelled: number;
  skipped: number;
  errors: Array<{ orderId: string; reason: string }>;
};

const FEE_FALLBACK = 0.1;
const CRYPTO_SYMBOLS = new Set([
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "ADA",
  "DOGE",
  "DOT",
  "AVAX",
  "MATIC",
  "LINK",
]);

function resolveAssetType(order: OrderRow): string {
  if (CRYPTO_SYMBOLS.has(order.symbol.toUpperCase())) return "crypto";
  return resolveAssetTypeFromSymbol(order.symbol);
}

function shouldTrigger(order: OrderRow, marketPrice: number) {
  const side = order.side;
  const limit = Number(order.limit_price);
  const stop = Number(order.stop_price);

  if (order.order_type === "limit") {
    if (!Number.isFinite(limit) || limit <= 0) return false;
    return side === "buy" ? marketPrice <= limit : marketPrice >= limit;
  }
  if (order.order_type === "stop") {
    if (!Number.isFinite(stop) || stop <= 0) return false;
    return side === "buy" ? marketPrice >= stop : marketPrice <= stop;
  }
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(stop) || stop <= 0) {
    return false;
  }
  if (side === "buy") {
    return marketPrice >= stop && marketPrice <= limit;
  }
  return marketPrice <= stop && marketPrice >= limit;
}

function permissionEnabled(profile: ProfileRow, assetType: string) {
  const map: Record<string, keyof ProfileRow> = {
    crypto: "can_trade_crypto",
    stock: "can_trade_stocks",
    index: "can_trade_indexes",
    commodity: "can_trade_commodities",
    forex: "can_trade_forex",
  };
  const field = map[assetType];
  if (!field) return true;
  return profile[field] !== false;
}

function applyNettingTrade(params: {
  prevUnitsSigned: number;
  prevAvgEntry: number;
  deltaUnitsSigned: number;
  fillPrice: number;
}): { unitsSigned: number; avgEntryPrice: number; realizedPnlUsd: number } {
  const { prevUnitsSigned, prevAvgEntry, deltaUnitsSigned, fillPrice } = params;
  if (Math.abs(prevUnitsSigned) < 1e-12) {
    return { unitsSigned: deltaUnitsSigned, avgEntryPrice: fillPrice, realizedPnlUsd: 0 };
  }

  const sameDir = prevUnitsSigned > 0 === deltaUnitsSigned > 0;
  if (sameDir) {
    const newUnits = prevUnitsSigned + deltaUnitsSigned;
    const newAvg =
      (Math.abs(prevUnitsSigned) * prevAvgEntry + Math.abs(deltaUnitsSigned) * fillPrice) /
      Math.max(1e-12, Math.abs(newUnits));
    return { unitsSigned: newUnits, avgEntryPrice: newAvg, realizedPnlUsd: 0 };
  }

  const closeAbs = Math.min(Math.abs(prevUnitsSigned), Math.abs(deltaUnitsSigned));
  const closedSigned = prevUnitsSigned > 0 ? closeAbs : -closeAbs;
  const realized = (fillPrice - prevAvgEntry) * closedSigned;
  const newUnits = prevUnitsSigned + deltaUnitsSigned;
  const remainingDeltaAbs = Math.abs(deltaUnitsSigned) - closeAbs;

  if (Math.abs(newUnits) < 1e-12) {
    return { unitsSigned: 0, avgEntryPrice: 0, realizedPnlUsd: realized };
  }
  if (remainingDeltaAbs > 0 && (prevUnitsSigned > 0) !== (newUnits > 0)) {
    return { unitsSigned: newUnits, avgEntryPrice: fillPrice, realizedPnlUsd: realized };
  }
  return { unitsSigned: newUnits, avgEntryPrice: prevAvgEntry, realizedPnlUsd: realized };
}

async function getFeePerTrade(supabase: ServiceClient) {
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "fee_per_trade")
    .single();
  const parsed = Number.parseFloat(data?.value ?? String(FEE_FALLBACK));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : FEE_FALLBACK;
}

async function getServiceOverrides(supabase: ServiceClient) {
  const { data, error } = await supabase
    .from("price_overrides")
    .select("symbol, override_price")
    .gt("expires_at", new Date().toISOString());
  if (error) return {} as Record<string, number>;
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    map[String(row.symbol).toUpperCase()] = Number(row.override_price);
  }
  return map;
}


/**
 * Returns the price at which the order should actually fill.
 * Limit orders fill at the limit price (guaranteed price or better).
 * Stop and stop-limit orders fill at the prevailing market price.
 */
function fillPriceFor(order: OrderRow, marketPrice: number): number {
  if (order.order_type === "limit") {
    const limit = Number(order.limit_price);
    return Number.isFinite(limit) && limit > 0 ? limit : marketPrice;
  }
  return marketPrice;
}

async function fillOrder(
  supabase: ServiceClient,
  order: OrderRow,
  profile: ProfileRow,
  assetType: string,
  fillPrice: number,
  fee: number
) {
  const quantity = Number(order.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false as const, fatal: true, reason: "Invalid quantity" };
  }

  if (assetType === "forex") {
    const parsedFx = parseForexSymbol(order.symbol);
    if (!parsedFx) return { ok: false as const, fatal: true, reason: "Invalid forex symbol" };
    const pipSize = inferPipSize(order.symbol);
    const bidAsk = midToBidAsk({
      instrument: { pipSize, typicalSpreadPips: parsedFx.quote === "JPY" ? 1.4 : 1.1 },
      mid: fillPrice,
      changePercent24h: null,
    });
    const dealPrice = order.side === "buy" ? bidAsk.ask : bidAsk.bid;
    const leverage = Math.max(1, profile.max_leverage || 1);

    const { data: existing, error: existingErr } = await supabase
      .from("forex_positions")
      .select("*")
      .eq("user_id", order.user_id)
      .eq("symbol", order.symbol)
      .maybeSingle();
    if (existingErr) return { ok: false as const, fatal: false, reason: existingErr.message };

    const prevUnits = Number(existing?.units_signed ?? 0);
    const prevAvg = Number(existing?.avg_entry_price ?? 0);
    const prevMarginUsed = Number(existing?.margin_used_usd ?? 0);
    const prevSwapAccrued = Number(existing?.swap_accrued_usd ?? 0);
    const prevLastSwapAt = (existing?.last_swap_at as string | null) ?? null;
    const deltaUnits = order.side === "buy" ? quantity : -quantity;
    const next = applyNettingTrade({
      prevUnitsSigned: prevUnits,
      prevAvgEntry: prevAvg,
      deltaUnitsSigned: deltaUnits,
      fillPrice: dealPrice,
    });
    const notionalQuote = Math.abs(next.unitsSigned) * bidAsk.mid;
    const notionalUsd = await convertToUSD(parsedFx.quote, notionalQuote);
    const nextMarginUsed = notionalUsd / leverage;
    const swap = computeSwapDeltaUsd({
      instrument: { swapLongBps: -2.0, swapShortBps: -2.0 },
      notionalUsd,
      unitsSigned: next.unitsSigned,
      lastSwapAt: prevLastSwapAt,
      now: new Date(),
    });
    const nextSwapAccrued = prevSwapAccrued + swap.deltaUsd;
    const marginDelta = nextMarginUsed - prevMarginUsed;
    const balanceDelta = -marginDelta + next.realizedPnlUsd + swap.deltaUsd - fee;
    if (profile.balance + balanceDelta < 0) {
      return { ok: false as const, fatal: false, reason: "Insufficient balance / margin" };
    }

    const { error: balanceErr } = await supabase
      .from("profiles")
      .update({ balance: profile.balance + balanceDelta })
      .eq("id", order.user_id);
    if (balanceErr) return { ok: false as const, fatal: false, reason: balanceErr.message };

    if (Math.abs(next.unitsSigned) < 1e-8) {
      if (existing?.id) {
        const { error: delErr } = await supabase
          .from("forex_positions")
          .delete()
          .eq("id", existing.id);
        if (delErr) return { ok: false as const, fatal: false, reason: delErr.message };
      }
    } else if (existing?.id) {
      const { error: upErr } = await supabase
        .from("forex_positions")
        .update({
          base: parsedFx.base,
          quote: parsedFx.quote,
          contract_size: DEFAULT_CONTRACT_SIZE,
          pip_size: pipSize,
          units_signed: next.unitsSigned,
          avg_entry_price: next.avgEntryPrice,
          last_mid: bidAsk.mid,
          last_bid: bidAsk.bid,
          last_ask: bidAsk.ask,
          leverage,
          margin_used_usd: nextMarginUsed,
          swap_accrued_usd: nextSwapAccrued,
          last_swap_at: swap.newLastSwapAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (upErr) return { ok: false as const, fatal: false, reason: upErr.message };
    } else {
      const { error: insErr } = await supabase.from("forex_positions").insert({
        user_id: order.user_id,
        symbol: order.symbol,
        base: parsedFx.base,
        quote: parsedFx.quote,
        contract_size: DEFAULT_CONTRACT_SIZE,
        pip_size: pipSize,
        units_signed: next.unitsSigned,
        avg_entry_price: next.avgEntryPrice,
        last_mid: bidAsk.mid,
        last_bid: bidAsk.bid,
        last_ask: bidAsk.ask,
        leverage,
        margin_used_usd: nextMarginUsed,
        swap_accrued_usd: nextSwapAccrued,
        last_swap_at: swap.newLastSwapAt,
      });
      if (insErr) return { ok: false as const, fatal: false, reason: insErr.message };
    }

    if (Math.abs(next.realizedPnlUsd) > 0.001) {
      const { error: pnlErr } = await supabase
        .from("profiles")
        .update({ total_pnl: profile.total_pnl + next.realizedPnlUsd })
        .eq("id", order.user_id);
      if (pnlErr) return { ok: false as const, fatal: false, reason: pnlErr.message };
    }

    const { error: tradeErr } = await supabase.from("trades").insert({
      user_id: order.user_id,
      symbol: order.symbol,
      side: order.side,
      quantity,
      price: dealPrice,
      total: quantity * dealPrice,
      profit_loss: next.realizedPnlUsd,
      status: "filled",
    });
    if (tradeErr) return { ok: false as const, fatal: false, reason: tradeErr.message };

    return { ok: true as const };
  }

  if (order.side === "buy") {
    const cost = quantity * fillPrice + fee;
    if (profile.balance < cost) {
      return { ok: false as const, fatal: false, reason: "Insufficient balance" };
    }

    const { error: debErr } = await supabase
      .from("profiles")
      .update({ balance: profile.balance - cost })
      .eq("id", order.user_id);
    if (debErr) return { ok: false as const, fatal: false, reason: debErr.message };

    const { data: existingPos, error: existingErr } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", order.user_id)
      .eq("symbol", order.symbol)
      .maybeSingle();
    if (existingErr) return { ok: false as const, fatal: false, reason: existingErr.message };

    if (existingPos) {
      const newQty = Number(existingPos.quantity) + quantity;
      const newAvg =
        (Number(existingPos.entry_price) * Number(existingPos.quantity) + fillPrice * quantity) /
        newQty;
      const { error: upErr } = await supabase
        .from("positions")
        .update({
          quantity: newQty,
          entry_price: newAvg,
          current_value: newQty * fillPrice,
          leverage: 1,
          asset_type: assetType,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPos.id);
      if (upErr) return { ok: false as const, fatal: false, reason: upErr.message };
    } else {
      const { error: insErr } = await supabase.from("positions").insert({
        user_id: order.user_id,
        symbol: order.symbol,
        quantity,
        entry_price: fillPrice,
        current_value: quantity * fillPrice,
        leverage: 1,
        asset_type: assetType,
      });
      if (insErr) return { ok: false as const, fatal: false, reason: insErr.message };
    }

    const { error: tradeErr } = await supabase.from("trades").insert({
      user_id: order.user_id,
      symbol: order.symbol,
      side: order.side,
      quantity,
      price: fillPrice,
      total: quantity * fillPrice,
      profit_loss: 0,
      status: "filled",
    });
    if (tradeErr) return { ok: false as const, fatal: false, reason: tradeErr.message };
    return { ok: true as const };
  }

  const { data: position, error: posErr } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", order.user_id)
    .eq("symbol", order.symbol)
    .maybeSingle();
  if (posErr) return { ok: false as const, fatal: false, reason: posErr.message };
  if (!position || Number(position.quantity) < quantity) {
    return { ok: false as const, fatal: true, reason: "Insufficient position for sell order" };
  }

  const posLeverage = Number(position.leverage || 1);
  const pnl = (fillPrice - Number(position.entry_price)) * quantity;
  const proceeds = (quantity * Number(position.entry_price)) / posLeverage + pnl;
  const newQty = Number(position.quantity) - quantity;

  const { error: creditErr } = await supabase
    .from("profiles")
    .update({ balance: profile.balance + proceeds - fee })
    .eq("id", order.user_id);
  if (creditErr) return { ok: false as const, fatal: false, reason: creditErr.message };

  if (newQty <= 1e-8) {
    const { error: delErr } = await supabase
      .from("positions")
      .delete()
      .eq("id", position.id);
    if (delErr) return { ok: false as const, fatal: false, reason: delErr.message };
  } else {
    const { error: upErr } = await supabase
      .from("positions")
      .update({
        quantity: newQty,
        current_value: newQty * fillPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", position.id);
    if (upErr) return { ok: false as const, fatal: false, reason: upErr.message };
  }

  const { error: pnlErr } = await supabase
    .from("profiles")
    .update({ total_pnl: profile.total_pnl + pnl })
    .eq("id", order.user_id);
  if (pnlErr) return { ok: false as const, fatal: false, reason: pnlErr.message };

  const { error: tradeErr } = await supabase.from("trades").insert({
    user_id: order.user_id,
    symbol: order.symbol,
    side: order.side,
    quantity,
    price: fillPrice,
    total: quantity * fillPrice,
    profit_loss: pnl,
    status: "filled",
  });
  if (tradeErr) return { ok: false as const, fatal: false, reason: tradeErr.message };

  return { ok: true as const };
}

export async function processOpenOrders(
  supabase: ServiceClient,
  options?: { userId?: string; maxOrders?: number }
): Promise<ProcessSummary> {
  const summary: ProcessSummary = {
    scanned: 0,
    triggered: 0,
    filled: 0,
    cancelled: 0,
    skipped: 0,
    errors: [],
  };
  const feePerTrade = await getFeePerTrade(supabase);
  const overrides = await getServiceOverrides(supabase);

  let query = supabase
    .from("orders")
    .select(
      "id, user_id, symbol, side, order_type, quantity, limit_price, stop_price, status"
    )
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(options?.maxOrders ?? 200);
  if (options?.userId) {
    query = query.eq("user_id", options.userId);
  }
  const { data: orders, error: ordersErr } = await query;
  if (ordersErr) {
    summary.errors.push({ orderId: "orders_query", reason: ordersErr.message });
    return summary;
  }

  for (const rawOrder of (orders ?? []) as OrderRow[]) {
    summary.scanned += 1;
    const order = rawOrder;
    const assetType = resolveAssetType(order);
    const hours = isMarketOpen(assetType);
    if (!hours.open) {
      summary.skipped += 1;
      continue;
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select(
        "id, balance, total_pnl, is_locked, max_leverage, can_trade_crypto, can_trade_stocks, can_trade_indexes, can_trade_commodities, can_trade_forex"
      )
      .eq("id", order.user_id)
      .single();
    if (profileErr || !profile) {
      summary.skipped += 1;
      summary.errors.push({
        orderId: order.id,
        reason: profileErr?.message || "Profile not found",
      });
      continue;
    }
    if (profile.is_locked) {
      summary.skipped += 1;
      continue;
    }
    if (!permissionEnabled(profile as ProfileRow, assetType)) {
      summary.skipped += 1;
      continue;
    }

    // When an admin price override is active we use the raw override value for
    // the trigger comparison (no jitter). This is critical: simulatePrice adds
    // Gaussian noise, so a limit buy set exactly at the override target can
    // randomly come back $20 above it and fail the "marketPrice <= limit" check.
    // We still apply simulatePrice for the fill so the fill price looks organic.
    const overrideRaw = overrides[order.symbol.toUpperCase()];
    const hasOverride =
      overrideRaw != null && Number.isFinite(overrideRaw) && overrideRaw > 0;

    let triggerPrice: number; // deterministic — used in shouldTrigger
    let fillBase: number;     // may carry jitter — used for the actual fill

    if (hasOverride) {
      // No external API call needed when override is active.
      triggerPrice = overrideRaw;
      fillBase     = simulatePrice(order.symbol, overrideRaw, assetType);
    } else {
      const rawPrice = await fetchMarketPrice(order.symbol, assetType);
      if (!rawPrice || rawPrice <= 0) {
        summary.skipped += 1;
        continue;
      }
      triggerPrice = rawPrice;
      fillBase     = rawPrice;
    }

    if (!shouldTrigger(order, triggerPrice)) {
      summary.skipped += 1;
      continue;
    }
    summary.triggered += 1;

    const fillPrice = fillPriceFor(order, fillBase);
    const fillResult = await fillOrder(
      supabase,
      order,
      profile as ProfileRow,
      assetType,
      fillPrice,
      feePerTrade
    );
    if (!fillResult.ok) {
      if (fillResult.fatal) {
        const { error: cancelErr } = await supabase
          .from("orders")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", order.id)
          .eq("status", "open");
        if (!cancelErr) summary.cancelled += 1;
      } else {
        summary.skipped += 1;
      }
      summary.errors.push({ orderId: order.id, reason: fillResult.reason });
      continue;
    }

    const { error: fillMarkErr } = await supabase
      .from("orders")
      .update({ status: "filled", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "open");
    if (fillMarkErr) {
      summary.errors.push({ orderId: order.id, reason: fillMarkErr.message });
      continue;
    }
    summary.filled += 1;
  }

  return summary;
}
