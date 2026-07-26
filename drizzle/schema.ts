import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

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
  require2FA: boolean("require2FA").default(false).notNull(),
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
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
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

/**
 * 2FA Secrets table - Stores TOTP secrets for 2FA-enabled products
 */
export const twoFASecrets = mysqlTable("twoFASecrets", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  secret: varchar("secret", { length: 255 }).notNull(), // Base32 encoded secret
  backupCodes: text("backupCodes"), // JSON array of backup codes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TwoFASecret = typeof twoFASecrets.$inferSelect;
export type InsertTwoFASecret = typeof twoFASecrets.$inferInsert;

/**
 * Activation Tokens table - Stores pending activation tokens waiting for 2FA confirmation
 */
export const activationTokens = mysqlTable("activationTokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  licenseKey: varchar("licenseKey", { length: 128 }).notNull(),
  deviceId: varchar("deviceId", { length: 255 }).notNull(),
  deviceInfo: text("deviceInfo"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivationToken = typeof activationTokens.$inferSelect;
export type InsertActivationToken = typeof activationTokens.$inferInsert;

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
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Webhooks table - outbound event notifications for external integrations
 */
export const webhooks = mysqlTable("webhooks", {
  id: int("id").autoincrement().primaryKey(),
  url: varchar("url", { length: 2048 }).notNull(),
  secret: varchar("secret", { length: 255 }),
  events: text("events").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = typeof webhooks.$inferInsert;

/**
 * Billing plans - maps Stripe Price IDs to license configuration
 */
export const billingPlans = mysqlTable("billingPlans", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  stripePriceId: varchar("stripePriceId", { length: 255 }).notNull().unique(),
  licenseType: mysqlEnum("licenseType", [
    "subscription",
    "perpetual",
    "node_locked",
    "user_based",
    "feature_based",
  ]).notNull(),
  maxActivations: int("maxActivations").default(1),
  renewalPeriodDays: int("renewalPeriodDays").default(365),
  autoRenew: boolean("autoRenew").default(true).notNull(),
  features: text("features"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BillingPlan = typeof billingPlans.$inferSelect;
export type InsertBillingPlan = typeof billingPlans.$inferInsert;

/**
 * Stripe webhook events - idempotency tracking
 */
export const stripeEvents = mysqlTable("stripeEvents", {
  id: int("id").autoincrement().primaryKey(),
  stripeEventId: varchar("stripeEventId", { length: 255 }).notNull().unique(),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});

export type StripeEvent = typeof stripeEvents.$inferSelect;
export type InsertStripeEvent = typeof stripeEvents.$inferInsert;

/**
 * Stripe payments - checkout and invoice records linked to licenses
 */
export const stripePayments = mysqlTable("stripePayments", {
  id: int("id").autoincrement().primaryKey(),
  billingPlanId: int("billingPlanId").notNull(),
  customerId: int("customerId"),
  licenseKey: varchar("licenseKey", { length: 128 }),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 255 }),
  amountTotal: int("amountTotal"),
  currency: varchar("currency", { length: 8 }),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StripePayment = typeof stripePayments.$inferSelect;
export type InsertStripePayment = typeof stripePayments.$inferInsert;