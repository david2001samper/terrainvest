-- Add profit_loss column to trades table for PnL analytics
ALTER TABLE trades ADD COLUMN IF NOT EXISTS profit_loss NUMERIC(20, 2) DEFAULT 0;
