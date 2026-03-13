import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().min(2, "Name must be at least 2 characters").max(50),
});

export const tradeSchema = z.object({
  symbol: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  quantity: z.number().positive("Quantity must be positive"),
  price: z.number().positive("Price must be positive"),
});

export const balanceUpdateSchema = z.object({
  userId: z.string().uuid(),
  newBalance: z.number().min(0, "Balance cannot be negative"),
});

export const assetSchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  asset_type: z.enum(["crypto", "stock", "commodity", "index"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type TradeInput = z.infer<typeof tradeSchema>;
export type BalanceUpdateInput = z.infer<typeof balanceUpdateSchema>;
export type AssetInput = z.infer<typeof assetSchema>;
