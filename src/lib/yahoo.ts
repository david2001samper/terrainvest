let instance: any = null;

export async function getYahooFinance() {
  if (!instance) {
    const { default: YahooFinance } = await import("yahoo-finance2");
    instance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
  }
  return instance;
}
