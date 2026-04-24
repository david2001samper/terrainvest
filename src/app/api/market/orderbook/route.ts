import { NextResponse, type NextRequest } from "next/server";
import { getActiveOverrides } from "@/lib/price-overrides";
import { simulatePrice } from "@/lib/price-simulator";

interface OrderBookLevel {
  price: number;
  size: number;
}

interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  midPrice: number;
  spread: number;
  source: string;
}

const cache = new Map<string, { data: OrderBookData; ts: number }>();

const CACHE_TTL_MS = 6_000;

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  XRP: "XRPUSDT",
  ADA: "ADAUSDT",
  DOGE: "DOGEUSDT",
  DOT: "DOTUSDT",
  AVAX: "AVAXUSDT",
  MATIC: "MATICUSDT",
  LINK: "LINKUSDT",
  BNB: "BNBUSDT",
  SHIB: "SHIBUSDT",
};

async function fetchBinanceDepth(symbol: string): Promise<OrderBookData | null> {
  const binanceSymbol = BINANCE_SYMBOL_MAP[symbol.toUpperCase()];
  if (!binanceSymbol) return null;

  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/depth?symbol=${binanceSymbol}&limit=10`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const bids: OrderBookLevel[] = (data.bids || []).map(
      (b: [string, string]) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) })
    );
    const asks: OrderBookLevel[] = (data.asks || []).map(
      (a: [string, string]) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) })
    );

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;

    return {
      bids,
      asks,
      midPrice: (bestBid + bestAsk) / 2,
      spread: bestAsk - bestBid,
      source: "binance",
    };
  } catch {
    return null;
  }
}

async function fetchItickDepth(
  symbol: string,
  assetType: string
): Promise<OrderBookData | null> {
  const apiKey = process.env.ITICK_API_KEY;
  if (!apiKey) return null;

  try {
    let code: string;
    let region: string;
    if (assetType === "forex") {
      code = symbol.replace("=X", "");
      region = "forex";
    } else if (symbol.startsWith("^")) {
      code = symbol.replace("^", "");
      region = "US";
    } else {
      code = symbol.replace(/=.*$/, "");
      region = "US";
    }

    const endpoint = `https://api.itick.org/stock/depth?region=${encodeURIComponent(region)}&code=${encodeURIComponent(code)}`;

    const res = await fetch(endpoint, {
      headers: { token: apiKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code !== 0 || !json.data) return null;

    const depthData = json.data;

    const bids: OrderBookLevel[] = (depthData.b || [])
      .sort((a: { po: number }, b: { po: number }) => a.po - b.po)
      .map((b: { p: number; v: number }) => ({
        price: Number(b.p),
        size: Number(b.v),
      }));
    const asks: OrderBookLevel[] = (depthData.a || [])
      .sort((a: { po: number }, b: { po: number }) => a.po - b.po)
      .map((a: { p: number; v: number }) => ({
        price: Number(a.p),
        size: Number(a.v),
      }));

    if (bids.length === 0 && asks.length === 0) return null;

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;

    return {
      bids,
      asks,
      midPrice: (bestBid + bestAsk) / 2,
      spread: bestAsk - bestBid,
      source: "itick",
    };
  } catch (e) {
    console.error("iTick depth error:", e);
    return null;
  }
}

function buildBookFromPrice(
  midPrice: number,
  assetType: string
): OrderBookData {
  const spreadPct =
    assetType === "forex"
      ? 0.0002
      : assetType === "crypto"
      ? 0.001
      : 0.0005;
  const halfSpread = midPrice * spreadPct * 0.5;
  const bestBid = midPrice - halfSpread;
  const bestAsk = midPrice + halfSpread;
  const step = halfSpread * 0.6;

  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  for (let i = 0; i < 10; i++) {
    const baseSize = (800 + Math.random() * 1200) * (1 + i * 0.3);
    bids.push({
      price: bestBid - step * i,
      size: Math.round(baseSize),
    });
    asks.push({
      price: bestAsk + step * i,
      size: Math.round(baseSize * (0.8 + Math.random() * 0.4)),
    });
  }

  return {
    bids,
    asks,
    midPrice,
    spread: bestAsk - bestBid,
    source: "generated",
  };
}

function buildSimulatedBook(
  midPrice: number,
  assetType: string
): OrderBookData {
  const spreadPct =
    assetType === "forex"
      ? 0.00015 + Math.random() * 0.0001
      : assetType === "crypto"
      ? 0.0008 + Math.random() * 0.0004
      : 0.0004 + Math.random() * 0.0002;

  const halfSpread = midPrice * spreadPct * 0.5;
  const bestBid = midPrice - halfSpread;
  const bestAsk = midPrice + halfSpread;

  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  let bidCursor = bestBid;
  let askCursor = bestAsk;
  const baseStep = halfSpread * (0.4 + Math.random() * 0.3);

  for (let i = 0; i < 10; i++) {
    const depth = 1 + i * 0.3;
    const bidBase = (300 + Math.random() * 700) * depth;
    const askBase = (300 + Math.random() * 700) * depth;

    const bidWall = Math.random() < 0.1 ? 2.5 + Math.random() * 4 : 1;
    const askWall = Math.random() < 0.1 ? 2.5 + Math.random() * 4 : 1;

    bids.push({ price: bidCursor, size: Math.round(bidBase * bidWall) });
    asks.push({ price: askCursor, size: Math.round(askBase * askWall) });

    const stepJitter = 0.7 + Math.random() * 0.6;
    bidCursor -= baseStep * stepJitter;
    askCursor += baseStep * stepJitter;
  }

  return {
    bids,
    asks,
    midPrice,
    spread: bestAsk - bestBid,
    source: "simulated",
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const assetType = searchParams.get("type") || "stock";

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  const overrides = await getActiveOverrides();
  const overridePrice = overrides[symbol.toUpperCase()];

  if (overridePrice != null) {
    const simPrice = simulatePrice(symbol, overridePrice, assetType);
    return NextResponse.json(buildSimulatedBook(simPrice, assetType));
  }

  const cacheKey = `${symbol}:${assetType}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  let book: OrderBookData | null = null;

  if (assetType === "crypto") {
    book = await fetchBinanceDepth(symbol);
  } else {
    book = await fetchItickDepth(symbol, assetType);
  }

  if (!book) {
    try {
      const { fetchMarketPrice } = await import("@/lib/market-price");
      const price = await fetchMarketPrice(symbol);
      if (price && price > 0) {
        book = buildBookFromPrice(price, assetType);
      }
    } catch {
      /* fallback failed */
    }
  }

  if (!book) {
    return NextResponse.json(
      { error: "Order book unavailable" },
      { status: 404 }
    );
  }

  cache.set(cacheKey, { data: book, ts: Date.now() });
  return NextResponse.json(book);
}
