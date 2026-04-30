import { NextResponse, type NextRequest } from "next/server";
import { getYahooFinance } from "@/lib/yahoo";
import { getActiveOverrides, applyOverrides } from "@/lib/price-overrides";
import type { MarketAsset } from "@/lib/types";

function mapYahooQuoteType(qt: string): "stock" | "commodity" | "index" | "forex" {
  if (qt === "INDEX") return "index";
  if (qt === "FUTURE" || qt === "COMMODITY") return "commodity";
  if (qt === "CURRENCY") return "forex";
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

    if (type === "forex") {
      const yf = await getYahooFinance();
      const q = await yf.quote(symbol);
      const qPrice = q?.regularMarketPrice ?? 0;
      if (!q || qPrice <= 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      asset = {
        symbol: (q as { symbol?: string }).symbol || symbol,
        name:
          (q as { shortName?: string }).shortName ||
          (q as { longName?: string }).longName ||
          symbol,
        price: qPrice,
        change24h: (q as { regularMarketChange?: number }).regularMarketChange ?? 0,
        changePercent24h:
          (q as { regularMarketChangePercent?: number }).regularMarketChangePercent ?? 0,
        volume: (q as { regularMarketVolume?: number }).regularMarketVolume ?? 0,
        marketCap: 0,
        high24h:
          (q as { regularMarketDayHigh?: number }).regularMarketDayHigh ?? qPrice,
        low24h:
          (q as { regularMarketDayLow?: number }).regularMarketDayLow ?? qPrice,
        asset_type: "forex",
        marketState: (q as { marketState?: string }).marketState ?? null,
      };
    } else if (type === "crypto") {
      let cgId = cgIdParam;
      let resolvedSymbol = symbol.toUpperCase();

      if (!cgId) {
        // Resolve CoinGecko ID from search (cached 2 min — not price sensitive)
        try {
          const searchRes = await fetch(
            `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`,
            { headers: { Accept: "application/json" }, next: { revalidate: 120 } }
          );
          if (searchRes.ok) {
            const data = await searchRes.json();
            const coins = (data.coins || []) as { id: string; symbol: string; name: string }[];
            const symU = symbol.toUpperCase();
            const match = coins.find((c) => c.symbol?.toUpperCase() === symU) || coins[0];
            if (match?.id) {
              cgId = match.id;
              resolvedSymbol = (match.symbol || symbol).toUpperCase();
            }
          }
        } catch {
          // will try Binance fallback below
        }
      }

      // Try CoinGecko markets for full data
      let coinData: {
        id: string; symbol: string; name: string;
        current_price?: number; price_change_24h?: number;
        price_change_percentage_24h?: number; total_volume?: number;
        market_cap?: number; high_24h?: number; low_24h?: number;
      } | null = null;

      if (cgId) {
        try {
          const mRes = await fetch(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(cgId)}&sparkline=false&price_change_percentage=24h`,
            { headers: { Accept: "application/json" }, cache: "no-store" }
          );
          if (mRes.ok) {
            const markets = await mRes.json();
            coinData = markets[0] ?? null;
          }
        } catch {
          // fall through to Binance
        }
      }

      if (coinData && (coinData.current_price ?? 0) > 0) {
        asset = {
          symbol: (coinData.symbol || resolvedSymbol).toUpperCase(),
          name: coinData.name || symbol,
          price: coinData.current_price ?? 0,
          change24h: coinData.price_change_24h ?? 0,
          changePercent24h: coinData.price_change_percentage_24h ?? 0,
          volume: coinData.total_volume ?? 0,
          marketCap: coinData.market_cap ?? 0,
          high24h: coinData.high_24h ?? 0,
          low24h: coinData.low_24h ?? 0,
          asset_type: "crypto",
          marketState: null,
          coingecko_id: coinData.id,
        };
      } else {
        // Binance fallback: use symbol + USDT pair
        const binanceSym = `${resolvedSymbol}USDT`;
        const bRes = await fetch(
          `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSym}`,
          { cache: "no-store", headers: { Accept: "application/json" } }
        );
        if (!bRes.ok) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        const tick = (await bRes.json()) as {
          symbol: string; lastPrice: string; priceChange: string;
          priceChangePercent: string; highPrice: string; lowPrice: string; quoteVolume: string;
        };
        const price = parseFloat(tick.lastPrice) || 0;
        if (price <= 0) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        asset = {
          symbol: resolvedSymbol,
          name: resolvedSymbol,
          price,
          change24h: parseFloat(tick.priceChange) || 0,
          changePercent24h: parseFloat(tick.priceChangePercent) || 0,
          volume: parseFloat(tick.quoteVolume) || 0,
          marketCap: 0,
          high24h: parseFloat(tick.highPrice) || 0,
          low24h: parseFloat(tick.lowPrice) || 0,
          asset_type: "crypto",
          marketState: null,
          coingecko_id: cgId || undefined,
        };
      }
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
