import { getYahooFinance } from "@/lib/yahoo";

type OptionQuote = {
  contractSymbol?: string;
  lastPrice?: number;
  bid?: number;
  ask?: number;
};

type OptionSide = "buy" | "sell";

function normalizeExpiryToEpochSeconds(expiry: string) {
  const date = new Date(expiry);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

function toPositiveNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function pickExecutablePremium(contract: OptionQuote, side: OptionSide) {
  if (side === "buy") {
    return (
      toPositiveNumber(contract.ask) ??
      toPositiveNumber(contract.lastPrice) ??
      toPositiveNumber(contract.bid)
    );
  }

  return (
    toPositiveNumber(contract.bid) ??
    toPositiveNumber(contract.lastPrice) ??
    toPositiveNumber(contract.ask)
  );
}

export async function getExecutableOptionPremium(params: {
  underlyingSymbol: string;
  contractSymbol: string;
  expiryIso: string;
  side: OptionSide;
}) {
  const expiryEpoch = normalizeExpiryToEpochSeconds(params.expiryIso);
  if (!expiryEpoch) return null;

  const yf = await getYahooFinance();
  const result = await yf.options(params.underlyingSymbol, {
    lang: "en-US",
    formatted: false,
    region: "US",
    date: expiryEpoch,
  });

  const chain = result.options?.[0];
  if (!chain) return null;

  const contracts = [...(chain.calls ?? []), ...(chain.puts ?? [])] as OptionQuote[];
  const match = contracts.find(
    (contract) => contract.contractSymbol === params.contractSymbol
  );
  if (!match) return null;

  return pickExecutablePremium(match, params.side);
}
