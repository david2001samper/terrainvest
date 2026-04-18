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
const DELAY_MIN_MS = 300;
const DELAY_MAX_MS = 2000;

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
    const preliminaryAssetType = resolveAssetType(symbol, clientAssetType);

    let marketPrice: number | null = null;
    const [feeRow] = await Promise.all([
      supabase.from("platform_settings").select("value").eq("key", "fee_per_trade").single(),
      fetchMarketPrice(symbol, preliminaryAssetType)
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

    // Use pre-slippage price for the balance check so slippage variation never
    // causes a spurious "Insufficient balance" rejection.
    const preSlippageMargin = (quantity * price) / leverage;
    const totalWithFee = side === "buy" ? preSlippageMargin + fee : total - fee;
    if (side === "buy" && profile.balance < totalWithFee) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    let tradePnl = 0;
    if (side === "sell" && assetType !== "forex") {
      const { data: positionForSell, error: positionForSellError } = await supabase
        .from("positions")
        .select("quantity, entry_price")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .maybeSingle();
      if (positionForSellError) {
        return NextResponse.json({ error: positionForSellError.message }, { status: 500 });
      }
      if (!positionForSell || positionForSell.quantity < quantity) {
        return NextResponse.json({ error: "Insufficient position" }, { status: 400 });
      }
      tradePnl = (execPrice - positionForSell.entry_price) * quantity;
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
      const { data: existing, error: existingErr } = await supabase
        .from("forex_positions")
        .select("*")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .maybeSingle();
      if (existingErr) {
        return NextResponse.json({ error: existingErr.message }, { status: 500 });
      }

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

      const { error: fxBalanceErr } = await supabase
        .from("profiles")
        .update({ balance: profile.balance + balanceDelta })
        .eq("id", user.id);
      if (fxBalanceErr) {
        return NextResponse.json({ error: fxBalanceErr.message }, { status: 500 });
      }

      // Upsert position
      if (Math.abs(next.unitsSigned) < 0.00000001) {
        if (existing?.id) {
          const { error: deleteFxErr } = await supabase
            .from("forex_positions")
            .delete()
            .eq("id", existing.id);
          if (deleteFxErr) {
            return NextResponse.json({ error: deleteFxErr.message }, { status: 500 });
          }
        }
      } else if (existing?.id) {
        const { error: updateFxErr } = await supabase
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
        if (updateFxErr) {
          return NextResponse.json({ error: updateFxErr.message }, { status: 500 });
        }
      } else {
        const { error: insertFxErr } = await supabase.from("forex_positions").insert({
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
        if (insertFxErr) {
          return NextResponse.json({ error: insertFxErr.message }, { status: 500 });
        }
      }

      if (Math.abs(next.realizedPnlUsd) > 0.001) {
        const { data: fxProf, error: fxProfErr } = await supabase
          .from("profiles")
          .select("total_pnl")
          .eq("id", user.id)
          .single();
        if (fxProfErr) {
          return NextResponse.json({ error: fxProfErr.message }, { status: 500 });
        }
        if (fxProf) {
          const { error: updateFxPnlErr } = await supabase
            .from("profiles")
            .update({ total_pnl: fxProf.total_pnl + next.realizedPnlUsd })
            .eq("id", user.id);
          if (updateFxPnlErr) {
            return NextResponse.json({ error: updateFxPnlErr.message }, { status: 500 });
          }
        }
      }

      const { error: fxTradeErr } = await supabase.from("trades").insert({
        user_id: user.id,
        symbol,
        side,
        quantity,
        price: fillPrice,
        total: quantity * fillPrice,
        profit_loss: next.realizedPnlUsd,
        status: "filled",
      });
      if (fxTradeErr) {
        return NextResponse.json({ error: fxTradeErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: `${side.toUpperCase()} order executed` });
    }

    if (side === "buy") {
      const { error: buyBalanceErr } = await supabase
        .from("profiles")
        .update({ balance: profile.balance - marginRequired - fee })
        .eq("id", user.id);
      if (buyBalanceErr) {
        return NextResponse.json({ error: buyBalanceErr.message }, { status: 500 });
      }

      const { data: existingPos, error: existingPosErr } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .maybeSingle();
      if (existingPosErr) {
        return NextResponse.json({ error: existingPosErr.message }, { status: 500 });
      }

      if (existingPos) {
        const newQty = existingPos.quantity + quantity;
        const newAvgPrice =
          (existingPos.entry_price * existingPos.quantity + execPrice * quantity) /
          newQty;
        const { error: updatePosErr } = await supabase
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
        if (updatePosErr) {
          return NextResponse.json({ error: updatePosErr.message }, { status: 500 });
        }
      } else {
        const { error: insertPosErr } = await supabase.from("positions").insert({
          user_id: user.id,
          symbol,
          quantity,
          entry_price: execPrice,
          current_value: quantity * execPrice,
          leverage,
          asset_type: assetType,
        });
        if (insertPosErr) {
          return NextResponse.json({ error: insertPosErr.message }, { status: 500 });
        }
      }

      const { error: buyTradeErr } = await supabase.from("trades").insert({
        user_id: user.id,
        symbol,
        side,
        quantity,
        price: execPrice,
        total,
        profit_loss: 0,
        status: "filled",
      });
      if (buyTradeErr) {
        return NextResponse.json({ error: buyTradeErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: `${side.toUpperCase()} order executed` });
    }

    const { data: position, error: positionErr } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", user.id)
      .eq("symbol", symbol)
      .maybeSingle();
    if (positionErr) {
      return NextResponse.json({ error: positionErr.message }, { status: 500 });
    }
    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    const posLeverage = position.leverage || 1;
    const newQty = position.quantity - quantity;
    const pnl = (execPrice - position.entry_price) * quantity;
    const sellProceeds = (quantity * position.entry_price) / posLeverage + pnl;

    const { error: sellBalanceErr } = await supabase
      .from("profiles")
      .update({ balance: profile.balance + sellProceeds - fee })
      .eq("id", user.id);
    if (sellBalanceErr) {
      return NextResponse.json({ error: sellBalanceErr.message }, { status: 500 });
    }

    if (newQty <= 0.00000001) {
      const { error: deletePosErr } = await supabase
        .from("positions")
        .delete()
        .eq("id", position.id);
      if (deletePosErr) {
        return NextResponse.json({ error: deletePosErr.message }, { status: 500 });
      }
    } else {
      const { error: reducePosErr } = await supabase
        .from("positions")
        .update({
          quantity: newQty,
          current_value: newQty * execPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("id", position.id);
      if (reducePosErr) {
        return NextResponse.json({ error: reducePosErr.message }, { status: 500 });
      }
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("total_pnl")
      .eq("id", user.id)
      .single();
    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }
    if (prof) {
      const { error: updatePnlErr } = await supabase
        .from("profiles")
        .update({ total_pnl: prof.total_pnl + pnl })
        .eq("id", user.id);
      if (updatePnlErr) {
        return NextResponse.json({ error: updatePnlErr.message }, { status: 500 });
      }
    }

    const { error: sellTradeErr } = await supabase.from("trades").insert({
      user_id: user.id,
      symbol,
      side,
      quantity,
      price: execPrice,
      total,
      profit_loss: tradePnl,
      status: "filled",
    });
    if (sellTradeErr) {
      return NextResponse.json({ error: sellTradeErr.message }, { status: 500 });
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
