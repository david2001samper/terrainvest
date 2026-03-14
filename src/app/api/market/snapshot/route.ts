import { NextResponse } from "next/server";
import { headers } from "next/headers";

const SNAPSHOT_SYMBOLS = ["BTC", "ETH", "AAPL", "TSLA", "GC=F", "CL=F", "^GSPC", "^IXIC"];

export async function GET() {
  try {
    let base = process.env.NEXT_PUBLIC_APP_URL;
    if (!base) {
      const headersList = await headers();
      const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000";
      const proto = headersList.get("x-forwarded-proto") || "http";
      base = `${proto}://${host}`;
    }

    const [cryptoRes, stocksRes] = await Promise.all([
      fetch(`${base}/api/market/crypto`, { cache: "no-store" }),
      fetch(`${base}/api/market/stocks`, { cache: "no-store" }),
    ]);

    const crypto = cryptoRes.ok ? await cryptoRes.json() : [];
    const stocks = stocksRes.ok ? await stocksRes.json() : [];
    const all = [...crypto, ...stocks];

    const filtered = SNAPSHOT_SYMBOLS.map((sym) =>
      all.find((a: { symbol: string }) => a.symbol === sym)
    ).filter(Boolean);

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Market snapshot error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
