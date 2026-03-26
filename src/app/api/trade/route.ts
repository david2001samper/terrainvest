import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tradeSchema } from "@/lib/validations";
import { fetchMarketPrice } from "@/lib/market-price";

function detectAssetType(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.endsWith("=X")) return "forex";
  const cryptoSyms = ["BTC","ETH","SOL","XRP","ADA","DOGE","DOT","AVAX","MATIC","LINK","BNB","SHIB","UNI","ATOM","LTC","NEAR","APT"];
  if (cryptoSyms.includes(s)) return "crypto";
  const indexSyms = ["^GSPC","^IXIC","^DJI","^RUT","^VIX","^FTSE","^N225","^HSI","^GDAXI","^FCHI"];
  if (indexSyms.includes(s) || s.startsWith("^")) return "index";
  const commoditySyms = ["GC=F","CL=F","SI=F","NG=F","HG=F","PL=F","XAU","XAG"];
  if (commoditySyms.includes(s) || s.endsWith("=F")) return "commodity";
  return "stock";
}

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

    const assetType = detectAssetType(symbol);
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

    if (side === "sell") {
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
      await supabase
        .from("profiles")
        .update({ balance: profile.balance + total - fee })
        .eq("id", user.id);

      const { data: position } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .single();

      if (position) {
        const newQty = position.quantity - quantity;
        const pnl = (execPrice - position.entry_price) * quantity;

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
