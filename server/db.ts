import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, products, licenses, activations, customers, twoFASecrets, activationTokens, webhooks, billingPlans, stripeEvents, stripePayments, InsertProduct, InsertLicense, InsertActivation, InsertCustomer, InsertTwoFASecret, InsertActivationToken, InsertWebhook, InsertBillingPlan, InsertStripeEvent, InsertStripePayment } from "../drizzle/schema";
import { and, desc, isNull, eq } from "drizzle-orm";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ========== Products ==========
export async function createProduct(product: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(product);
  return result;
}

export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(products).orderBy(desc(products.createdAt));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(products).where(eq(products.id, id));
}

// ========== Licenses ==========
export async function createLicense(license: InsertLicense) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(licenses).values(license);
  return result;
}

export async function getAllLicenses() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(licenses).orderBy(desc(licenses.createdAt));
}

export async function getLicenseByKey(licenseKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(licenses).where(eq(licenses.licenseKey, licenseKey)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateLicense(licenseKey: string, data: Partial<InsertLicense>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(licenses).set(data).where(eq(licenses.licenseKey, licenseKey));
}

export async function revokeLicense(licenseKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(licenses).set({ status: "revoked" }).where(eq(licenses.licenseKey, licenseKey));
}

// ========== Activations ==========
export async function createActivation(activation: InsertActivation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(activations).values(activation);
  return result;
}

export async function getAllActivations(filters?: {
  productId?: number;
  status?: "active" | "deactivated" | "all";
  licenseKey?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let rows = await db.select().from(activations).orderBy(desc(activations.activatedAt));

  if (filters?.licenseKey) {
    rows = rows.filter(row => row.licenseKey === filters.licenseKey);
  }

  if (filters?.status === "active") {
    rows = rows.filter(row => !row.deactivatedAt);
  } else if (filters?.status === "deactivated") {
    rows = rows.filter(row => !!row.deactivatedAt);
  }

  if (filters?.productId) {
    const productLicenses = await db
      .select({ licenseKey: licenses.licenseKey })
      .from(licenses)
      .where(eq(licenses.productId, filters.productId));
    const keys = new Set(productLicenses.map(row => row.licenseKey));
    rows = rows.filter(row => keys.has(row.licenseKey));
  }

  return rows;
}

export async function getActivationsByLicense(licenseKey: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(activations)
    .where(and(eq(activations.licenseKey, licenseKey), isNull(activations.deactivatedAt)))
    .orderBy(desc(activations.activatedAt));
}

export async function getActivationByDeviceAndLicense(licenseKey: string, deviceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(activations)
    .where(and(
      eq(activations.licenseKey, licenseKey),
      eq(activations.deviceId, deviceId),
      isNull(activations.deactivatedAt)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateActivationValidation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(activations).set({ lastValidatedAt: new Date() }).where(eq(activations.id, id));
}

export async function deactivateActivation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(activations).set({ deactivatedAt: new Date() }).where(eq(activations.id, id));
}

export async function deactivateActivations(ids: number[]) {
  if (!ids.length) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  for (const id of ids) {
    await db.update(activations).set({ deactivatedAt: now }).where(eq(activations.id, id));
  }
}

// ========== Customers ==========
export async function createCustomer(customer: InsertCustomer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(customers).values(customer);
  return result;
}

export async function getAllCustomers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(customers).orderBy(desc(customers.createdAt));
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCustomerByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCustomerByStripeId(stripeCustomerId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(customers)
    .where(eq(customers.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLicensesByCustomerId(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(licenses).where(eq(licenses.customerId, customerId));
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function getLicenseByStripeSubscriptionId(stripeSubscriptionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(licenses)
    .where(eq(licenses.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getStripePaymentByCheckoutSessionId(stripeCheckoutSessionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(stripePayments)
    .where(eq(stripePayments.stripeCheckoutSessionId, stripeCheckoutSessionId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getStripePaymentByInvoiceId(stripeInvoiceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(stripePayments)
    .where(eq(stripePayments.stripeInvoiceId, stripeInvoiceId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ========== Billing Plans ==========
export async function getAllBillingPlans() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(billingPlans).orderBy(desc(billingPlans.createdAt));
}

export async function getActiveBillingPlans() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(billingPlans)
    .where(eq(billingPlans.active, true))
    .orderBy(desc(billingPlans.createdAt));
}

export async function getBillingPlanById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(billingPlans).where(eq(billingPlans.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBillingPlanByStripePriceId(stripePriceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(billingPlans)
    .where(eq(billingPlans.stripePriceId, stripePriceId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBillingPlan(plan: InsertBillingPlan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(billingPlans).values(plan);
  return result;
}

export async function updateBillingPlan(id: number, data: Partial<InsertBillingPlan>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(billingPlans).set(data).where(eq(billingPlans.id, id));
}

export async function deleteBillingPlan(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(billingPlans).where(eq(billingPlans.id, id));
}

// ========== Stripe Events ==========
export async function hasProcessedStripeEvent(stripeEventId: string) {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(eq(stripeEvents.stripeEventId, stripeEventId))
    .limit(1);
  return result.length > 0;
}

export async function markStripeEventProcessed(event: InsertStripeEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(stripeEvents).values(event);
}

// ========== Stripe Payments ==========
export async function createStripePayment(payment: InsertStripePayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(stripePayments).values(payment);
  return result;
}

export async function updateStripePayment(id: number, data: Partial<InsertStripePayment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(stripePayments).set(data).where(eq(stripePayments.id, id));
}

export async function getAllStripePayments() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(stripePayments).orderBy(desc(stripePayments.createdAt));
}

// ========== Webhooks ==========
export async function getAllWebhooks() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(webhooks).orderBy(desc(webhooks.createdAt));
}

export async function getWebhookById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createWebhook(webhook: InsertWebhook) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(webhooks).values(webhook);
  return result;
}

export async function updateWebhook(id: number, data: Partial<InsertWebhook>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(webhooks).set(data).where(eq(webhooks.id, id));
}

export async function deleteWebhook(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(webhooks).where(eq(webhooks.id, id));
}

export async function getActiveWebhooksForEvent(event: string) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.active, true));

  return rows.filter(row => {
    try {
      const events = JSON.parse(row.events) as string[];
      return Array.isArray(events) && events.includes(event);
    } catch {
      return false;
    }
  });
}

// ========== 2FA Secrets ==========
export async function createTwoFASecret(secret: InsertTwoFASecret) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(twoFASecrets).values(secret);
}

export async function getTwoFASecretByProductId(productId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(twoFASecrets).where(eq(twoFASecrets.productId, productId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateTwoFASecret(productId: number, data: Partial<InsertTwoFASecret>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(twoFASecrets).set(data).where(eq(twoFASecrets.productId, productId));
}

// ========== Activation Tokens ==========
export async function createActivationToken(token: InsertActivationToken) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(activationTokens).values(token);
}

export async function getActivationTokenByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(activationTokens).where(eq(activationTokens.token, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteActivationToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(activationTokens).where(eq(activationTokens.token, token));
}

export async function deleteExpiredActivationTokens() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete tokens that have expired
  const now = new Date();
  // This is a simplified implementation - in production, use proper SQL comparison
  const allTokens = await db.select().from(activationTokens);
  for (const token of allTokens) {
    if (token.expiresAt && new Date(token.expiresAt) < now) {
      await db.delete(activationTokens).where(eq(activationTokens.id, token.id));
    }
  }
}
