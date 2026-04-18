type YahooFinanceClient = {
  options: (
    symbol: string,
    options?: Record<string, unknown>
  ) => Promise<{
    options?: Array<{
      calls?: Array<Record<string, unknown>>;
      puts?: Array<Record<string, unknown>>;
    }>;
  }>;
  quote: (symbol: string) => Promise<{
    regularMarketPrice?: number | null;
    regularMarketChange?: number | null;
    regularMarketChangePercent?: number | null;
    regularMarketVolume?: number | null;
    regularMarketDayHigh?: number | null;
    regularMarketDayLow?: number | null;
    marketCap?: number | null;
    marketState?: string | null;
  }>;
  search: (
    query: string,
    options?: { quotesCount?: number; newsCount?: number }
  ) => Promise<{
    quotes?: Array<Record<string, unknown>>;
    news?: Array<Record<string, unknown>>;
  }>;
  chart: (...args: unknown[]) => Promise<unknown>;
};

let instance: YahooFinanceClient | null = null;

export async function getYahooFinance(): Promise<YahooFinanceClient> {
  if (!instance) {
    const { default: YahooFinance } = await import("yahoo-finance2");
    instance = new YahooFinance({
      suppressNotices: ["yahooSurvey"],
    }) as YahooFinanceClient;
  }
  return instance;
}
