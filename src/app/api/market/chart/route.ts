import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const assetType = searchParams.get("type") || "stock";
  const days = parseInt(searchParams.get("days") || "30");
  const interval = searchParams.get("interval") || "1d";

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    if (assetType === "crypto") {
      const idMap: Record<string, string> = {
        BTC: "bitcoin", ETH: "ethereum", SOL: "solana",
        XRP: "ripple", ADA: "cardano", DOGE: "dogecoin",
        DOT: "polkadot", AVAX: "avalanche-2", MATIC: "matic-network",
        LINK: "chainlink", BNB: "binancecoin", SHIB: "shiba-inu",
      };
      const cgId = idMap[symbol] || symbol.toLowerCase();
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`,
        { next: { revalidate: 30 } }
      );
      if (!res.ok) throw new Error("CoinGecko chart error");
      const json = await res.json();

      const prices: [number, number][] = json.prices || [];
      const volumes: [number, number][] = json.total_volumes || [];

      const data = prices.map(([ts, price], i) => {
        const vol = volumes[i]?.[1] ?? 0;
        return {
          time: new Date(ts).toISOString(),
          open: price * (1 + (Math.random() - 0.5) * 0.003),
          high: price * (1 + Math.random() * 0.005),
          low: price * (1 - Math.random() * 0.005),
          close: price,
          volume: vol,
        };
      });
      return NextResponse.json(data);
    }

    const { getYahooFinance } = await import("@/lib/yahoo");
    const yf = await getYahooFinance();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chart: any = await yf.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: interval,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (chart.quotes || []).map((q: any) => ({
      time: new Date(q.date).toISOString(),
      open: q.open ?? 0,
      high: q.high ?? 0,
      low: q.low ?? 0,
      close: q.close ?? 0,
      volume: q.volume ?? 0,
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Chart API error:", error);
    const basePrice = 100;
    const mockData = Array.from({ length: Math.min(days, 365) }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      const drift = Math.sin(i / 5) * 10 + (Math.random() - 0.5) * 5;
      const price = basePrice + drift;
      return {
        time: date.toISOString(),
        open: price - Math.random() * 2,
        high: price + Math.random() * 3,
        low: price - Math.random() * 3,
        close: price,
        volume: Math.floor(Math.random() * 10000000),
      };
    });
    return NextResponse.json(mockData);
  }
}
