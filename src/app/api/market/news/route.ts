import { NextResponse, type NextRequest } from "next/server";

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
}

type YahooNewsItem = {
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number;
};

const newsCache = new Map<string, { data: NewsItem[]; ts: number }>();
const NEWS_CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  const cached = newsCache.get(symbol);
  if (cached && Date.now() - cached.ts < NEWS_CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const { getYahooFinance } = await import("@/lib/yahoo");
    const yf = await getYahooFinance();

    const result = await yf.search(symbol, { newsCount: 8 });
    const newsItems = (result.news ?? []) as YahooNewsItem[];
    const news: NewsItem[] = newsItems
      .filter((n) => Boolean(n.title))
      .map((n) => ({
        title: n.title ?? "",
        publisher: n.publisher || "Unknown",
        link: n.link || "#",
        publishedAt: n.providerPublishTime
          ? new Date(n.providerPublishTime * 1000).toISOString()
          : new Date().toISOString(),
      }));

    newsCache.set(symbol, { data: news, ts: Date.now() });
    return NextResponse.json(news);
  } catch (error) {
    console.error("News API error:", error);
    return NextResponse.json([]);
  }
}
