export type ForexInstrument = {
  symbol: string; // e.g. EURUSD=X
  base: string;   // EUR
  quote: string;  // USD
  contractSize: number; // 100000
  pipSize: number; // 0.0001 or 0.01 (JPY)
  typicalSpreadPips: number;
  swapLongBps: number;
  swapShortBps: number;
};

export const DEFAULT_CONTRACT_SIZE = 100000;

export function parseForexSymbol(symbol: string): { base: string; quote: string } | null {
  const s = symbol.toUpperCase();
  if (!s.endsWith("=X")) return null;
  const core = s.slice(0, -2); // strip =X
  if (core.length !== 6) return null;
  return { base: core.slice(0, 3), quote: core.slice(3, 6) };
}

export function inferPipSize(symbol: string): number {
  const parsed = parseForexSymbol(symbol);
  if (!parsed) return 0.0001;
  return parsed.quote === "JPY" ? 0.01 : 0.0001;
}

export function lotsToUnits(lots: number): number {
  return lots * DEFAULT_CONTRACT_SIZE;
}

export function unitsToLots(units: number): number {
  return units / DEFAULT_CONTRACT_SIZE;
}

