# Terra Invest VIP — Premium Trading Platform

A luxurious, full-featured trading platform built with Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

## Features

- **Authentication** — Email/password sign-up, sign-in, logout with Supabase Auth
- **Live Market Data** — Real-time prices for crypto (CoinGecko), stocks, commodities, and indexes (yahoo-finance2)
- **Trading** — Market buy/sell orders with instant execution, position management, full trade history
- **Portfolio** — Active positions with unrealized P&L, realized P&L tracking
- **Watchlist** — Save favorite assets with heart toggle
- **Admin Panel** — Client management, balance editing, trade viewing, asset management, analytics
- **Order Book** — Real Level 2 market depth (iTick for stocks/forex, Binance for crypto), per-user permission, admin-configurable cache
- **Candlestick Charts** — OHLC candlestick view powered by TradingView Lightweight Charts
- **P&L Analytics** — Cumulative P&L curve, daily breakdown, per-symbol win rate
- **News Feed** — Per-asset financial news from Yahoo Finance
- **Market Heatmap** — Color-coded grid view of all assets by 24h % change
- **Depth Chart** — Cumulative bid/ask staircase visualization
- **Options Greeks** — Delta, Gamma, Theta, Vega on options positions
- **Price Simulation** — GBM + mean reversion engine with S/R zones for realistic override-priced charts
- **VIP Design** — Dark luxurious theme with gold accents, glassmorphism cards, premium typography

## Tech Stack

| Layer      | Technology                                   |
|------------|----------------------------------------------|
| Framework  | Next.js 16 (App Router)                      |
| Language   | TypeScript                                   |
| Styling    | Tailwind CSS v4 + shadcn/ui + Lucide icons   |
| Backend    | Supabase (Auth, Postgres, Realtime)           |
| Charts     | Recharts + TradingView Lightweight Charts    |
| Validation | Zod                                          |
| Data       | React Query (@tanstack/react-query)           |
| Market API | CoinGecko (crypto) + yahoo-finance2 (stocks) |
| Toasts     | Sonner                                       |

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your **Project URL** and **Anon Key** from Settings → API
3. Copy the **Service Role Key** from Settings → API (keep this secret!)

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: iTick API key for real order book depth (stocks/forex)
# Sign up at https://itick.org — $79/mo for real Level 2 data
ITICK_API_KEY=your-itick-api-key
```

### 4. Set Up Database

1. Open the Supabase SQL Editor
2. Copy the contents of `supabase-schema.sql` and run it
3. This creates all tables, RLS policies, triggers, indexes, and seeds default assets

### 5. Create Admin Account

After the database is set up, either:

- **Option A**: Visit `http://localhost:3000/admin/settings` and click "Create Admin Account"
- **Option B**: Call the seed API: `POST http://localhost:3000/api/seed`

Default admin credentials:
- Email: `admin@terrainvestvip.com`
- Password: `admin123`

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 7. (Optional) Disable Email Confirmation

In Supabase Dashboard → Authentication → Providers → Email:
- Toggle OFF "Confirm email" for faster testing

## Project Structure

```
src/
├── app/
│   ├── (protected)/          # Auth-protected routes
│   │   ├── dashboard/        # Main dashboard
│   │   ├── markets/          # Market listing + asset detail
│   │   ├── portfolio/        # User positions
│   │   ├── history/          # Trade history
│   │   └── watchlist/        # Saved assets
│   ├── admin/                # Admin panel (admin role only)
│   │   ├── clients/          # Client management
│   │   ├── trades/           # All platform trades
│   │   ├── assets/           # Asset management
│   │   └── settings/         # Platform settings
│   ├── auth/                 # Login, signup, callback
│   ├── api/                  # API routes
│   │   ├── market/           # crypto, stocks, chart endpoints
│   │   ├── trade/            # Trade execution
│   │   ├── watchlist/        # Watchlist toggle
│   │   ├── admin/            # Admin APIs
│   │   └── seed/             # Admin account seeder
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Landing page
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── nav-sidebar.tsx       # Main navigation
│   ├── price-chart.tsx       # Recharts price chart
│   ├── trade-panel.tsx       # Buy/sell widget
│   └── providers.tsx         # React Query + Toaster
├── hooks/
│   ├── use-profile.ts        # User profile with realtime
│   ├── use-market-data.ts    # Market data polling
│   ├── use-positions.ts      # Positions & trades
│   └── use-watchlist.ts      # Watchlist management
├── lib/
│   ├── supabase/             # Supabase client/server/middleware
│   ├── types.ts              # TypeScript interfaces
│   ├── validations.ts        # Zod schemas
│   ├── format.ts             # Number/currency formatters
│   └── utils.ts              # shadcn utility
└── middleware.ts              # Auth + admin route protection
```

## API Endpoints

| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| GET    | /api/market/crypto    | Live crypto prices (CoinGecko) |
| GET    | /api/market/stocks    | Stocks, commodities, indexes   |
| GET    | /api/market/chart     | Historical chart data          |
| POST   | /api/trade            | Execute buy/sell order         |
| GET    | /api/watchlist        | Get user watchlist             |
| POST   | /api/watchlist        | Toggle watchlist item          |
| POST   | /api/seed             | Create admin account           |
| GET    | /api/admin/clients    | List all clients (admin)       |
| PATCH  | /api/admin/clients    | Update client profile (admin)  |
| GET    | /api/admin/trades     | All trades (admin)             |
| GET    | /api/admin/analytics  | Platform analytics (admin)     |
| GET    | /api/admin/assets     | List assets (admin)            |
| POST   | /api/admin/assets     | Add new asset (admin)          |
| DELETE | /api/admin/positions  | Force-close position (admin)   |

## Market Data Sources

- **Cryptocurrencies**: CoinGecko API (free, no API key required)
- **Stocks, Commodities, Indexes**: yahoo-finance2 npm package (free, no API key required)
- Data refreshes every 8–10 seconds automatically

## Default Users

| Role  | Email                        | Password |
|-------|------------------------------|----------|
| Admin | admin@terrainvestvip.com     | admin123 |

New users start with $10,000,000 balance.
