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
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  asset_type: "crypto" | "stock" | "commodity" | "index";
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
  created_at: string;
  updated_at: string;
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
  asset_type: "crypto" | "stock" | "commodity" | "index";
  marketState?: string | null;
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
