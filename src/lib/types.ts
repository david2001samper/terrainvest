export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: "user" | "admin";
  balance: number;
  is_locked?: boolean;
  total_pnl: number;
  vip_level: number;
  avatar_url?: string | null;
  preferred_currency?: string | null;
  last_login_at?: string | null;
  notify_withdrawal?: boolean;
  notify_deposit?: boolean;
  can_trade_crypto?: boolean;
  can_trade_stocks?: boolean;
  can_trade_indexes?: boolean;
  can_trade_commodities?: boolean;
  can_trade_forex?: boolean;
  can_trade_options?: boolean;
  max_leverage?: number;
  created_at: string;
  updated_at: string;
}

export type AssetTypeValue = "crypto" | "stock" | "commodity" | "index" | "forex";

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  asset_type: AssetTypeValue;
  is_active: boolean;
  created_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  total: number;
  status: "filled" | "cancelled" | "pending";
  created_at: string;
}

export interface Position {
  id: string;
  user_id: string;
  symbol: string;
  quantity: number;
  entry_price: number;
  current_value: number;
  unrealized_pnl: number;
  leverage?: number;
  asset_type?: string;
  created_at: string;
  updated_at: string;
}

export interface OptionsPosition {
  id: string;
  user_id: string;
  contract_symbol: string;
  underlying_symbol: string;
  option_type: "call" | "put";
  strike: number;
  expiry: string;
  quantity: number;
  entry_premium: number;
  current_premium: number | null;
  status: "open" | "closed" | "expired" | "exercised";
  closed_premium: number | null;
  realized_pnl: number | null;
  created_at: string;
  updated_at: string;
}

export interface OptionContract {
  contractSymbol: string;
  strike: number;
  expiry: string;
  type: "call" | "put";
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  created_at: string;
}

export interface MarketAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  asset_type: AssetTypeValue;
  marketState?: string | null;
  coingecko_id?: string;
}

export interface ChartDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}
