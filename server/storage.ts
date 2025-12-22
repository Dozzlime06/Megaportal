import { type User, type InsertUser, type BridgeTransaction, type InsertBridgeTransaction, users, bridgeTransactions } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createBridgeTransaction(tx: InsertBridgeTransaction): Promise<BridgeTransaction>;
  getBridgeTransaction(id: number): Promise<BridgeTransaction | undefined>;
  getBridgeTransactionByTxHash(txHash: string): Promise<BridgeTransaction | undefined>;
  getBridgeTransactionsByDepositor(depositor: string): Promise<BridgeTransaction[]>;
  getAllPendingTransactions(): Promise<BridgeTransaction[]>;
  updateBridgeTransactionStatus(id: number, status: string, megaTxHash?: string): Promise<BridgeTransaction | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createBridgeTransaction(tx: InsertBridgeTransaction): Promise<BridgeTransaction> {
    const [transaction] = await db.insert(bridgeTransactions).values(tx).returning();
    return transaction;
  }

  async getBridgeTransaction(id: number): Promise<BridgeTransaction | undefined> {
    const [transaction] = await db.select().from(bridgeTransactions).where(eq(bridgeTransactions.id, id));
    return transaction;
  }

  async getBridgeTransactionByTxHash(txHash: string): Promise<BridgeTransaction | undefined> {
    const [transaction] = await db.select().from(bridgeTransactions).where(eq(bridgeTransactions.txHash, txHash));
    return transaction;
  }

  async getBridgeTransactionsByDepositor(depositor: string): Promise<BridgeTransaction[]> {
    return db.select().from(bridgeTransactions)
      .where(eq(bridgeTransactions.depositor, depositor.toLowerCase()))
      .orderBy(desc(bridgeTransactions.createdAt));
  }

  async getAllPendingTransactions(): Promise<BridgeTransaction[]> {
    return db.select().from(bridgeTransactions)
      .where(eq(bridgeTransactions.status, "pending"))
      .orderBy(desc(bridgeTransactions.createdAt));
  }

  async updateBridgeTransactionStatus(id: number, status: string, megaTxHash?: string): Promise<BridgeTransaction | undefined> {
    const updateData: any = { status };
    if (megaTxHash) {
      updateData.megaTxHash = megaTxHash;
    }
    if (status === "completed") {
      updateData.completedAt = new Date();
    }
    const [transaction] = await db.update(bridgeTransactions)
      .set(updateData)
      .where(eq(bridgeTransactions.id, id))
      .returning();
    return transaction;
  }
}

export const storage = new DatabaseStorage();
