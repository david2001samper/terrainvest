import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

let cacheTtlMs = 5 * 60 * 1000;
let lastSettingsFetch = 0;

async function refreshCacheTtl() {
  if (Date.now() - lastSettingsFetch < 60_000) return;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "order_book_cache_minutes")
      .single();
    if (data?.value) {
      const minutes = parseInt(data.value, 10);
      if (minutes > 0) cacheTtlMs = minutes * 60 * 1000;
    }
  } catch {
    /* keep default */
  }
  lastSettingsFetch = Date.now();
}

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

function rebaseOrderBook(
  book: OrderBookData,
  simulatedMid: number
): OrderBookData {
  if (!book.midPrice || book.midPrice <= 0) return book;
  const ratio = simulatedMid / book.midPrice;

  return {
    bids: book.bids.map((l) => ({ price: l.price * ratio, size: l.size })),
    asks: book.asks.map((l) => ({ price: l.price * ratio, size: l.size })),
    midPrice: simulatedMid,
    spread: book.spread * ratio,
    source: book.source,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const assetType = searchParams.get("type") || "stock";

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  await refreshCacheTtl();

  const cacheKey = `${symbol}:${assetType}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < cacheTtlMs) {
    const overrides = await getActiveOverrides();
    const overridePrice = overrides[symbol.toUpperCase()];
    if (overridePrice != null) {
      const simPrice = simulatePrice(symbol, overridePrice, assetType);
      return NextResponse.json(rebaseOrderBook(cached.data, simPrice));
    }
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

  const overrides = await getActiveOverrides();
  const overridePrice = overrides[symbol.toUpperCase()];
  if (overridePrice != null) {
    const simPrice = simulatePrice(symbol, overridePrice, assetType);
    return NextResponse.json(rebaseOrderBook(book, simPrice));
  }

  return NextResponse.json(book);
}
