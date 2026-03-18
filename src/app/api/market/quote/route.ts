import { NextResponse, type NextRequest } from "next/server";
import { getYahooFinance } from "@/lib/yahoo";
import { getActiveOverrides, applyOverrides } from "@/lib/price-overrides";
import type { MarketAsset } from "@/lib/types";

function mapYahooQuoteType(qt: string): "stock" | "commodity" | "index" {
  if (qt === "INDEX") return "index";
  if (qt === "FUTURE" || qt === "COMMODITY") return "commodity";
  return "stock";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim();
  const type = (searchParams.get("type") || "stock").toLowerCase();
  const cgIdParam = searchParams.get("cg_id")?.trim();

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const overrides = await getActiveOverrides();
    let asset: MarketAsset;

    if (type === "crypto") {
      let cgId = cgIdParam;
      if (!cgId) {
        const searchRes = await fetch(
          `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`,
          { headers: { Accept: "application/json" }, next: { revalidate: 120 } }
        );
        if (!searchRes.ok) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        const data = await searchRes.json();
        const coins = (data.coins || []) as { id: string; symbol: string }[];
        const symU = symbol.toUpperCase();
        const match =
          coins.find((c) => c.symbol?.toUpperCase() === symU) || coins[0];
        if (!match?.id) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        cgId = match.id;
      }

      const mRes = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(cgId!)}&sparkline=false&price_change_percentage=24h`,
        { headers: { Accept: "application/json" }, cache: "no-store" }
      );
      if (!mRes.ok) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const markets = await mRes.json();
      const coin = markets[0];
      if (!coin) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      asset = {
        symbol: (coin.symbol || symbol).toUpperCase(),
        name: coin.name || symbol,
        price: coin.current_price ?? 0,
        change24h: coin.price_change_24h ?? 0,
        changePercent24h: coin.price_change_percentage_24h ?? 0,
        volume: coin.total_volume ?? 0,
        marketCap: coin.market_cap ?? 0,
        high24h: coin.high_24h ?? 0,
        low24h: coin.low_24h ?? 0,
        asset_type: "crypto",
        marketState: null,
        coingecko_id: coin.id,
      };
    } else {
      const yf = await getYahooFinance();
      const q = await yf.quote(symbol);
      const price = q?.regularMarketPrice ?? 0;
      if (!q || price == null || price <= 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const qt = String((q as { quoteType?: string }).quoteType || "EQUITY");
      asset = {
        symbol: (q as { symbol?: string }).symbol || symbol,
        name:
          (q as { shortName?: string; longName?: string }).shortName ||
          (q as { longName?: string }).longName ||
          symbol,
        price,
        change24h: (q as { regularMarketChange?: number }).regularMarketChange ?? 0,
        changePercent24h:
          (q as { regularMarketChangePercent?: number }).regularMarketChangePercent ?? 0,
        volume: (q as { regularMarketVolume?: number }).regularMarketVolume ?? 0,
        marketCap: (q as { marketCap?: number }).marketCap ?? 0,
        high24h:
          (q as { regularMarketDayHigh?: number }).regularMarketDayHigh ?? price,
        low24h:
          (q as { regularMarketDayLow?: number }).regularMarketDayLow ?? price,
        asset_type: mapYahooQuoteType(qt),
        marketState: (q as { marketState?: string }).marketState ?? null,
      };
    }

    const [withOverride] = applyOverrides([asset], overrides);
    const active = Object.keys(overrides).length > 0;
    return NextResponse.json(withOverride, {
      headers: {
        "Cache-Control": active ? "no-store" : "max-age=8",
      },
    });
  } catch (e) {
    console.error("market quote error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
