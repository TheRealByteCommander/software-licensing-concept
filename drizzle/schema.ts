import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Products table - Represents software products that can be licensed
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Licenses table - Represents individual licenses for products
 */
export const licenses = mysqlTable("licenses", {
  id: int("id").autoincrement().primaryKey(),
  licenseKey: varchar("licenseKey", { length: 128 }).notNull().unique(),
  productId: int("productId").notNull(),
  customerId: int("customerId"),
  type: mysqlEnum("type", ["subscription", "perpetual", "node_locked", "user_based", "feature_based"]).notNull(),
  status: mysqlEnum("status", ["active", "expired", "revoked", "grace_period"]).default("active").notNull(),
  maxActivations: int("maxActivations").default(1),
  expiresAt: timestamp("expiresAt"),
  metadata: text("metadata"), // JSON string for additional data like features
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type License = typeof licenses.$inferSelect;
export type InsertLicense = typeof licenses.$inferInsert;

/**
 * Activations table - Tracks device activations for licenses
 */
export const activations = mysqlTable("activations", {
  id: int("id").autoincrement().primaryKey(),
  licenseKey: varchar("licenseKey", { length: 128 }).notNull(),
  deviceId: varchar("deviceId", { length: 255 }).notNull(),
  deviceInfo: text("deviceInfo"), // JSON string for device metadata
  activatedAt: timestamp("activatedAt").defaultNow().notNull(),
  lastValidatedAt: timestamp("lastValidatedAt").defaultNow().notNull(),
  deactivatedAt: timestamp("deactivatedAt"),
});

export type Activation = typeof activations.$inferSelect;
export type InsertActivation = typeof activations.$inferInsert;

/**
 * Customers table - Extended customer information
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // Link to users table if needed
  email: varchar("email", { length: 320 }).notNull(),
  name: text("name"),
  company: text("company"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;