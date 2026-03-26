import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tradeSchema } from "@/lib/validations";
import { fetchMarketPrice } from "@/lib/market-price";
import { isMarketOpen, resolveAssetTypeFromSymbol } from "@/lib/market-hours";
import { parseForexSymbol, inferPipSize, DEFAULT_CONTRACT_SIZE, lotsToUnits } from "@/lib/forex/instruments";
import { midToBidAsk } from "@/lib/forex/pricing";
import { convertToUSD } from "@/lib/forex/convert";
import { computeSwapDeltaUsd } from "@/lib/forex/swap";

const UNREALISTIC_THRESHOLD = 0.15;
const SLIPPAGE_MAX = 0.003;
const DELAY_MIN_MS = 1000;
const DELAY_MAX_MS = 5000;

function randomDelay() {
  const ms = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = tradeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { symbol, side, quantity, price: userPrice } = parsed.data;
    const clientAssetType = (body.asset_type as string) || "";
    const lots = typeof body.lots === "number" ? body.lots : null;

    let marketPrice: number | null = null;
    const [feeRow] = await Promise.all([
      supabase.from("platform_settings").select("value").eq("key", "fee_per_trade").single(),
      fetchMarketPrice(symbol)
        .then((p) => { marketPrice = p; })
        .catch(() => { marketPrice = null; }),
    ]);

    const fee = parseFloat(feeRow?.data?.value ?? "0.10");
    const price = marketPrice ?? userPrice;

    if (marketPrice != null) {
      const priceDiff = Math.abs(userPrice - price) / (price || 1);
      if (priceDiff > UNREALISTIC_THRESHOLD) {
        return NextResponse.json(
          {
            error: "Order rejected",
            message: "Price moved significantly. Please refresh and try again.",
            pending: true,
          },
          { status: 400 }
        );
      }
    }

    const slippage = 1 + (Math.random() * 2 - 1) * SLIPPAGE_MAX;
    const execPrice = price * slippage;
    const total = quantity * execPrice;

    await randomDelay();

    const { data: profile } = await supabase
      .from("profiles")
      .select("balance, is_locked, can_trade_crypto, can_trade_stocks, can_trade_indexes, can_trade_commodities, can_trade_forex, can_trade_options, max_leverage")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.is_locked) {
      return NextResponse.json(
        { error: "Your account has been locked. Contact support." },
        { status: 403 }
      );
    }

    const assetType = resolveAssetType(symbol, clientAssetType);
    const hours = isMarketOpen(assetType);
    if (!hours.open) {
      return NextResponse.json({ error: hours.reason || "Market is closed." }, { status: 400 });
    }
    const permMap: Record<string, string> = {
      crypto: "can_trade_crypto",
      stock: "can_trade_stocks",
      index: "can_trade_indexes",
      commodity: "can_trade_commodities",
      forex: "can_trade_forex",
    };
    const permField = permMap[assetType];
    if (permField && profile[permField as keyof typeof profile] === false) {
      const label = assetType.charAt(0).toUpperCase() + assetType.slice(1);
      return NextResponse.json(
        { error: `${label} trading is not enabled on your account. Contact your account manager.` },
        { status: 403 }
      );
    }

    const leverage = assetType === "forex" ? (profile.max_leverage || 1) : 1;
    const marginRequired = total / leverage;

    const totalWithFee = side === "buy" ? marginRequired + fee : total - fee;
    if (side === "buy" && profile.balance < totalWithFee) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    if (side === "sell" && assetType !== "forex") {
      const { data: position } = await supabase
        .from("positions")
        .select("quantity")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .single();

      if (!position || position.quantity < quantity) {
        return NextResponse.json(
          { error: "Insufficient position" },
          { status: 400 }
        );
      }
    }

    const { error: tradeError } = await supabase.from("trades").insert({
      user_id: user.id,
      symbol,
      side,
      quantity,
      price: execPrice,
      total,
      status: "filled",
    });

    if (tradeError) {
      return NextResponse.json({ error: tradeError.message }, { status: 500 });
    }

    // -----------------------------
    // REALISTIC FOREX (CFD) ENGINE
    // -----------------------------
    if (assetType === "forex") {
      const parsedFx = parseForexSymbol(symbol);
      if (!parsedFx) {
        return NextResponse.json({ error: "Invalid forex symbol" }, { status: 400 });
      }

      const unitsAbs = lots != null && lots > 0 ? lotsToUnits(lots) : quantity;
      if (!unitsAbs || unitsAbs <= 0) {
        return NextResponse.json({ error: "Invalid size" }, { status: 400 });
      }

      // Use mid as primary reference, but execute on bid/ask
      const pipSize = inferPipSize(symbol);
      const bidAsk = midToBidAsk({
        instrument: { pipSize, typicalSpreadPips: parsedFx.quote === "JPY" ? 1.4 : 1.1 },
        mid: execPrice,
        changePercent24h: null,
      });
      const fillPrice = side === "buy" ? bidAsk.ask : bidAsk.bid;

      // Fetch existing net position (if any)
      const { data: existing } = await supabase
        .from("forex_positions")
        .select("*")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .single();

      const prevUnits = Number(existing?.units_signed ?? 0);
      const prevAvg = Number(existing?.avg_entry_price ?? 0);
      const prevMarginUsed = Number(existing?.margin_used_usd ?? 0);
      const prevSwapAccrued = Number(existing?.swap_accrued_usd ?? 0);
      const prevLastSwapAt = (existing?.last_swap_at as string | null) ?? null;

      const deltaUnits = side === "buy" ? unitsAbs : -unitsAbs;
      const next = applyNettingTrade({
        prevUnitsSigned: prevUnits,
        prevAvgEntry: prevAvg,
        deltaUnitsSigned: deltaUnits,
        fillPrice,
      });

      // Notional & margin are computed from mid price and absolute units
      const notionalQuote = Math.abs(next.unitsSigned) * bidAsk.mid;
      const notionalUsd = await convertToUSD(parsedFx.quote, notionalQuote);
      const nextMarginUsed = notionalUsd / Math.max(1, leverage);

      // Swap accrual (opportunistic)
      const swap = computeSwapDeltaUsd({
        instrument: { swapLongBps: -2.0, swapShortBps: -2.0 },
        notionalUsd,
        unitsSigned: next.unitsSigned,
        lastSwapAt: prevLastSwapAt,
        now: new Date(),
      });
      const nextSwapAccrued = prevSwapAccrued + swap.deltaUsd;

      // Realized P&L affects cash balance; margin delta affects cash balance as used margin
      const marginDelta = nextMarginUsed - prevMarginUsed;
      const balanceDelta = -marginDelta + next.realizedPnlUsd + swap.deltaUsd - fee;

      if (profile.balance + balanceDelta < 0) {
        return NextResponse.json({ error: "Insufficient balance / margin" }, { status: 400 });
      }

      await supabase
        .from("profiles")
        .update({ balance: profile.balance + balanceDelta })
        .eq("id", user.id);

      // Upsert position
      if (Math.abs(next.unitsSigned) < 0.00000001) {
        if (existing?.id) {
          await supabase.from("forex_positions").delete().eq("id", existing.id);
        }
      } else if (existing?.id) {
        await supabase
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
      } else {
        await supabase.from("forex_positions").insert({
          user_id: user.id,
          symbol,
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
      }

      return NextResponse.json({ success: true, message: `${side.toUpperCase()} order executed` });
    }

    if (side === "buy") {
      await supabase
        .from("profiles")
        .update({ balance: profile.balance - marginRequired - fee })
        .eq("id", user.id);

      const { data: existingPos } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .single();

      if (existingPos) {
        const newQty = existingPos.quantity + quantity;
        const newAvgPrice =
          (existingPos.entry_price * existingPos.quantity + execPrice * quantity) /
          newQty;
        await supabase
          .from("positions")
          .update({
            quantity: newQty,
            entry_price: newAvgPrice,
            current_value: newQty * execPrice,
            leverage,
            asset_type: assetType,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPos.id);
      } else {
        await supabase.from("positions").insert({
          user_id: user.id,
          symbol,
          quantity,
          entry_price: execPrice,
          current_value: quantity * execPrice,
          leverage,
          asset_type: assetType,
        });
      }
    } else {
      const { data: position } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .single();

      if (position) {
        const posLeverage = position.leverage || 1;
        const newQty = position.quantity - quantity;
        const pnl = (execPrice - position.entry_price) * quantity;
        const sellProceeds = (quantity * position.entry_price) / posLeverage + pnl;

        await supabase
          .from("profiles")
          .update({ balance: profile.balance + sellProceeds - fee })
          .eq("id", user.id);

        if (newQty <= 0.00000001) {
          await supabase.from("positions").delete().eq("id", position.id);
        } else {
          await supabase
            .from("positions")
            .update({
              quantity: newQty,
              current_value: newQty * execPrice,
              updated_at: new Date().toISOString(),
            })
            .eq("id", position.id);
        }

        const { data: prof } = await supabase
          .from("profiles")
          .select("total_pnl")
          .eq("id", user.id)
          .single();
        if (prof) {
          await supabase
            .from("profiles")
            .update({ total_pnl: prof.total_pnl + pnl })
            .eq("id", user.id);
        }
      }
    }

    return NextResponse.json({ success: true, message: `${side.toUpperCase()} order executed` });
  } catch (error) {
    console.error("Trade error:", error);
    return NextResponse.json({ error: "Trade execution failed" }, { status: 500 });
  }
}

function applyNettingTrade(params: {
  prevUnitsSigned: number;
  prevAvgEntry: number;
  deltaUnitsSigned: number;
  fillPrice: number;
}): { unitsSigned: number; avgEntryPrice: number; realizedPnlUsd: number } {
  const { prevUnitsSigned, prevAvgEntry, deltaUnitsSigned, fillPrice } = params;

  const prev = prevUnitsSigned;
  const delta = deltaUnitsSigned;

  if (Math.abs(prev) < 1e-12) {
    return { unitsSigned: delta, avgEntryPrice: fillPrice, realizedPnlUsd: 0 };
  }

  const sameDir = prev > 0 === delta > 0;
  if (sameDir) {
    const newUnits = prev + delta;
    const newAvg =
      (Math.abs(prev) * prevAvgEntry + Math.abs(delta) * fillPrice) / Math.max(1e-12, Math.abs(newUnits));
    return { unitsSigned: newUnits, avgEntryPrice: newAvg, realizedPnlUsd: 0 };
  }

  // Opposite direction: close as much as possible at fillPrice
  const closeAbs = Math.min(Math.abs(prev), Math.abs(delta));
  const closedSigned = prev > 0 ? closeAbs : -closeAbs;
  const realized = (fillPrice - prevAvgEntry) * closedSigned;

  const remainingDeltaAbs = Math.abs(delta) - closeAbs;
  const newUnits = prev + delta;

  if (Math.abs(newUnits) < 1e-12) {
    return { unitsSigned: 0, avgEntryPrice: 0, realizedPnlUsd: realized };
  }

  // If flipped, new avg is fillPrice for the newly opened remainder
  if (remainingDeltaAbs > 0 && (prev > 0) !== (newUnits > 0)) {
    return { unitsSigned: newUnits, avgEntryPrice: fillPrice, realizedPnlUsd: realized };
  }

  // Reduced but not flipped: avg stays
  return { unitsSigned: newUnits, avgEntryPrice: prevAvgEntry, realizedPnlUsd: realized };
}

function resolveAssetType(symbol: string, clientHint: string): string {
  if (clientHint && ["crypto", "stock", "index", "commodity", "forex"].includes(clientHint)) {
    return clientHint;
  }
  return resolveAssetTypeFromSymbol(symbol);
}
