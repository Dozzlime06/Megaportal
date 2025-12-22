import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const bridgeTransactions = pgTable("bridge_transactions", {
  id: serial("id").primaryKey(),
  txHash: text("tx_hash"),
  depositor: text("depositor").notNull(),
  amount: text("amount").notNull(),
  quotedMegaAmount: text("quoted_mega_amount").notNull(),
  slippageBps: integer("slippage_bps").notNull().default(50),
  status: text("status").notNull().default("pending"),
  sourceChainId: integer("source_chain_id").notNull().default(8453),
  destChainId: integer("dest_chain_id").notNull().default(4326),
  megaTxHash: text("mega_tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertBridgeTransactionSchema = createInsertSchema(bridgeTransactions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertBridgeTransaction = z.infer<typeof insertBridgeTransactionSchema>;
export type BridgeTransaction = typeof bridgeTransactions.$inferSelect;
