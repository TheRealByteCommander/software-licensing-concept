import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
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

import { products, licenses, activations, customers, InsertProduct, InsertLicense, InsertActivation, InsertCustomer } from "../drizzle/schema";
import { and, desc, isNull } from "drizzle-orm";

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

export async function getAllActivations() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(activations).orderBy(desc(activations.activatedAt));
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
