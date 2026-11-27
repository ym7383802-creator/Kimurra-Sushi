import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import {
  DEFAULT_BUSINESS_INFO,
  DEFAULT_ORDER_SETTINGS,
  DEFAULT_KIMURA_CATEGORIES,
  type BusinessBranch,
  type BusinessInfo,
  type CustomerOrder,
  type MenuOffer,
  type OrderSettings,
  type KimuraSushiCategory,
} from "./kimura-sushi-menu.ts";

export const MENU_VERSION = 10;
export const BRAND_VERSION = 8;

export interface StoreData {
  adminUsername: string | null;
  adminPasswordHash: string | null;
  sessionSecret?: string;
  menuVersion?: number;
  brandVersion?: number;
  categories: KimuraSushiCategory[];
  offers: MenuOffer[];
  orders: CustomerOrder[];
  settings: OrderSettings;
  businessInfo: BusinessInfo;
  nextOrderNumber: number;
}

export interface StorageDiagnostics {
  backend: "postgres" | "supabase" | "local_file";
  persistentOnVercel: boolean;
  isVercelRuntime: boolean;
  whatsappApiConfigured: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const STORE_FILE = path.join(DATA_DIR, "store.json");

function getPostgresUrl(): string {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
}

function getSupabaseConfig(): { url: string; serviceKey: string } | null {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

export function getStorageDiagnostics(): StorageDiagnostics {
  const hasPg = Boolean(getPostgresUrl());
  const hasSb = Boolean(getSupabaseConfig());
  const backend: StorageDiagnostics["backend"] = hasPg
    ? "postgres"
    : hasSb
      ? "supabase"
      : "local_file";

  const isVercelRuntime = Boolean(process.env.VERCEL);
  const whatsappApiConfigured = Boolean(
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
  );

  return {
    backend,
    persistentOnVercel: hasPg || hasSb,
    isVercelRuntime,
    whatsappApiConfigured,
  };
}

export function cloneDefaultCategories(): KimuraSushiCategory[] {
  return structuredClone(DEFAULT_KIMURA_CATEGORIES);
}

export function cloneDefaultBusinessInfo(): BusinessInfo {
  return structuredClone(DEFAULT_BUSINESS_INFO);
}

function sanitizeExternalHttpUrl(raw: unknown, fallback = ""): string {
  const val = typeof raw === "string" ? raw.trim() : "";
  if (!val) return fallback;
  try {
    const parsed = new URL(val);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? val : fallback;
  } catch {
    return fallback;
  }
}

function sanitizeImagePathOrUrl(raw: unknown, fallback = ""): string {
  const val = typeof raw === "string" ? raw.trim() : "";
  if (!val) return fallback;
  if (
    val.startsWith("/api/media/") ||
    val.startsWith("/uploads/") ||
    val.startsWith("/src/assets/") ||
    val.startsWith("/assets/")
  ) {
    return val;
  }
  return sanitizeExternalHttpUrl(val, fallback);
}

export function normalizeBusinessInfo(raw?: Partial<BusinessInfo> | null): BusinessInfo {
  const defaults = cloneDefaultBusinessInfo();
  if (!raw || typeof raw !== "object") return defaults;
  const branches: BusinessBranch[] = Array.isArray(raw.branches)
    ? raw.branches
        .filter(
          (b): b is BusinessBranch =>
            Boolean(b && typeof b === "object" && typeof b.name === "string" && b.name.trim()),
        )
        .map((b, idx) => ({
          id:
            typeof b.id === "string" && b.id.trim()
              ? b.id.trim()
              : `branch-${Date.now()}-${idx}`,
          name: b.name.trim(),
          address: typeof b.address === "string" ? b.address.trim() : "",
          phone: typeof b.phone === "string" ? b.phone.trim() : "",
          whatsapp: typeof b.whatsapp === "string" ? b.whatsapp.trim() : "",
          mapsUrl: sanitizeExternalHttpUrl(b.mapsUrl, ""),
        }))
    : defaults.branches;

  const phone =
    typeof raw.phone === "string" && raw.phone.trim() ? raw.phone.trim() : defaults.phone;

  return {
    businessName:
      typeof raw.businessName === "string" && raw.businessName.trim()
        ? raw.businessName.trim()
        : defaults.businessName,
    slogan: typeof raw.slogan === "string" ? raw.slogan.trim() : defaults.slogan,
    logoUrl:
      typeof raw.logoUrl === "string"
        ? sanitizeImagePathOrUrl(raw.logoUrl, defaults.logoUrl)
        : defaults.logoUrl,
    aboutUs: typeof raw.aboutUs === "string" ? raw.aboutUs.trim() : defaults.aboutUs,
    chefName: typeof raw.chefName === "string" ? raw.chefName.trim() : defaults.chefName,
    chefInstagramUrl:
      typeof raw.chefInstagramUrl === "string"
        ? sanitizeExternalHttpUrl(raw.chefInstagramUrl, "")
        : defaults.chefInstagramUrl,
    chefPhotoUrl:
      typeof raw.chefPhotoUrl === "string"
        ? sanitizeImagePathOrUrl(raw.chefPhotoUrl, "")
        : defaults.chefPhotoUrl,
    instagramHandle:
      typeof raw.instagramHandle === "string"
        ? raw.instagramHandle.trim()
        : defaults.instagramHandle,
    instagramUrl:
      typeof raw.instagramUrl === "string"
        ? sanitizeExternalHttpUrl(raw.instagramUrl, "")
        : defaults.instagramUrl,
    facebookUrl:
      typeof raw.facebookUrl === "string"
        ? sanitizeExternalHttpUrl(raw.facebookUrl, "")
        : defaults.facebookUrl,
    tiktokUrl:
      typeof raw.tiktokUrl === "string"
        ? sanitizeExternalHttpUrl(raw.tiktokUrl, "")
        : defaults.tiktokUrl,
    phone,
    whatsapp:
      typeof raw.whatsapp === "string" && raw.whatsapp.trim()
        ? raw.whatsapp.trim()
        : defaults.whatsapp,
    vodafoneCashNumber:
      typeof raw.vodafoneCashNumber === "string" && raw.vodafoneCashNumber.trim()
        ? raw.vodafoneCashNumber.trim()
        : phone || defaults.vodafoneCashNumber,
    instaPayIdentifier:
      typeof raw.instaPayIdentifier === "string" && raw.instaPayIdentifier.trim()
        ? raw.instaPayIdentifier.trim()
        : phone || defaults.instaPayIdentifier,
    email: typeof raw.email === "string" ? raw.email.trim() : defaults.email,
    businessHours:
      typeof raw.businessHours === "string" ? raw.businessHours.trim() : defaults.businessHours,
    deliveryInfo:
      typeof raw.deliveryInfo === "string" ? raw.deliveryInfo.trim() : defaults.deliveryInfo,
    branches,
  };
}

function buildDefaultStore(): StoreData {
  return {
    adminUsername: null,
    adminPasswordHash: null,
    sessionSecret: crypto.randomBytes(32).toString("hex"),
    menuVersion: MENU_VERSION,
    brandVersion: BRAND_VERSION,
    categories: cloneDefaultCategories(),
    offers: [],
    orders: [],
    settings: { ...DEFAULT_ORDER_SETTINGS },
    businessInfo: cloneDefaultBusinessInfo(),
    nextOrderNumber: 1001,
  };
}

function isBuiltInAssetPath(img?: string): boolean {
  return Boolean(img && img.startsWith("/src/assets/images/"));
}

function normalizeStorePayload(parsed: Partial<StoreData> | null | undefined): {
  data: StoreData;
  changed: boolean;
} {
  if (!parsed || typeof parsed !== "object") {
    return { data: buildDefaultStore(), changed: true };
  }

  let changed = false;
  const defaultsByDishId = new Map<string, string>();
  const defaultCoverByCatId = new Map<string, string>();
  for (const cat of DEFAULT_KIMURA_CATEGORIES) {
    defaultCoverByCatId.set(cat.id, cat.coverImage);
    for (const d of cat.dishes) {
      if (d.image) defaultsByDishId.set(d.id, d.image);
    }
  }

  const needsMenuImageRefresh = (parsed.menuVersion ?? 0) < 10;

  let categories: KimuraSushiCategory[];
  if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
    categories = cloneDefaultCategories();
    changed = true;
  } else if ((parsed.menuVersion ?? 0) < 8) {
    categories = cloneDefaultCategories();
    changed = true;
  } else {
    // Non-destructive upgrade from v8/v9 -> v10: refresh built-in category/dish images while preserving admin-uploaded media & stock
    categories = parsed.categories.map((cat) => {
      const defaultCover = defaultCoverByCatId.get(cat.id);
      const nextCover =
        needsMenuImageRefresh && defaultCover && (!cat.coverImage || isBuiltInAssetPath(cat.coverImage))
          ? defaultCover
          : cat.coverImage || defaultCover || "";
      if (nextCover !== cat.coverImage) {
        changed = true;
      }

      return {
        ...cat,
        name: cat.id === "old-menu" ? "Old Menu" : cat.name,
        coverImage: nextCover,
        dishes: Array.isArray(cat.dishes)
          ? cat.dishes.map((dish) => {
              const cleanedDesc =
                typeof dish.description === "string"
                  ? dish.description.replace(/أولد منيو|اولد منيو/g, "Old Menu")
                  : dish.description;
              const defaultDishImg = defaultsByDishId.get(dish.id);
              const resolvedImg =
                needsMenuImageRefresh && defaultDishImg && (!dish.image || isBuiltInAssetPath(dish.image))
                  ? defaultDishImg
                  : dish.image || defaultDishImg;
              if (cleanedDesc !== dish.description || resolvedImg !== dish.image) {
                changed = true;
              }
              return {
                ...dish,
                ...(cleanedDesc !== undefined ? { description: cleanedDesc } : {}),
                ...(resolvedImg ? { image: resolvedImg } : {}),
              };
            })
          : [],
      };
    });
  }

  const needsBrandMigration = (parsed.brandVersion ?? 0) < 6;
  const businessInfo = needsBrandMigration
    ? cloneDefaultBusinessInfo()
    : normalizeBusinessInfo(parsed.businessInfo);
  if ((parsed.brandVersion ?? 0) < 8 && !businessInfo.tiktokUrl) {
    businessInfo.tiktokUrl = DEFAULT_BUSINESS_INFO.tiktokUrl;
    changed = true;
  }

  let sessionSecret =
    typeof parsed.sessionSecret === "string" && parsed.sessionSecret.length >= 32
      ? parsed.sessionSecret
      : "";
  if (!sessionSecret) {
    sessionSecret = crypto.randomBytes(32).toString("hex");
    changed = true;
  }

  if (
    needsBrandMigration ||
    !parsed.businessInfo ||
    parsed.menuVersion !== MENU_VERSION ||
    parsed.brandVersion !== BRAND_VERSION
  ) {
    changed = true;
  }

  const orders: CustomerOrder[] = Array.isArray(parsed.orders)
    ? parsed.orders.map((order) => {
        const legacyStatus = (order.status as string) === "completed" ? "delivered" : order.status;
        return {
          ...order,
          status: legacyStatus || "pending",
          paymentMethod: order.paymentMethod || "cash_on_delivery",
          paymentStatus: order.paymentStatus || "cash_due",
        };
      })
    : [];

  const offers: MenuOffer[] = Array.isArray(parsed.offers) ? parsed.offers : [];

  const data: StoreData = {
    adminUsername:
      typeof parsed.adminUsername === "string" && parsed.adminUsername.trim()
        ? parsed.adminUsername.trim().toLowerCase()
        : null,
    adminPasswordHash:
      typeof parsed.adminPasswordHash === "string" ? parsed.adminPasswordHash : null,
    sessionSecret,
    menuVersion: MENU_VERSION,
    brandVersion: BRAND_VERSION,
    categories,
    offers,
    orders,
    settings: { ...DEFAULT_ORDER_SETTINGS, ...(parsed.settings ?? {}) },
    businessInfo,
    nextOrderNumber: typeof parsed.nextOrderNumber === "number" ? parsed.nextOrderNumber : 1001,
  };

  return { data, changed };
}

// --- PostgreSQL Pool & Initialization ---
let pgPool: Pool | null = null;
let pgInitPromise: Promise<void> | null = null;

function getPgPool(): Pool {
  if (pgPool) return pgPool;
  const connectionString = getPostgresUrl();
  const isLocal =
    connectionString.includes("127.0.0.1") ||
    connectionString.includes("localhost") ||
    connectionString.includes("sslmode=disable");

  pgPool = new Pool({
    connectionString,
    max: 5,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
  return pgPool;
}

async function ensurePgTables(): Promise<void> {
  if (!pgInitPromise) {
    pgInitPromise = (async () => {
      const pool = getPgPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS kimura_app_state (
          id INTEGER PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS kimura_media (
          id TEXT PRIMARY KEY,
          mime_type TEXT NOT NULL,
          data_base64 TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    })();
  }
  await pgInitPromise;
}

// --- Supabase REST helpers ---
async function supabaseRequest(
  pathSuffix: string,
  init: RequestInit = {},
): Promise<Response> {
  const sb = getSupabaseConfig();
  if (!sb) throw new Error("Supabase not configured");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", sb.serviceKey);
  headers.set("Authorization", `Bearer ${sb.serviceKey}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${sb.url}/rest/v1/${pathSuffix}`, {
    ...init,
    headers,
  });
}

// --- Local File Mutex ---
let localMutex: Promise<unknown> = Promise.resolve();

function withLocalLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = localMutex.then(fn, fn);
  localMutex = next.catch(() => {});
  return next;
}

function readLocalStoreSync(): StoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    const initial = buildDefaultStore();
    writeLocalStoreSync(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    const { data, changed } = normalizeStorePayload(parsed);
    if (changed) writeLocalStoreSync(data);
    return data;
  } catch {
    const fallback = buildDefaultStore();
    writeLocalStoreSync(fallback);
    return fallback;
  }
}

function writeLocalStoreSync(data: StoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmpFile, STORE_FILE);
}

// --- Public Unified Store API ---
export async function readStore(): Promise<StoreData> {
  const diag = getStorageDiagnostics();

  if (diag.backend === "postgres") {
    await ensurePgTables();
    const pool = getPgPool();
    const result = await pool.query<{ payload: Partial<StoreData> }>(
      "SELECT payload FROM kimura_app_state WHERE id = 1",
    );
    if (result.rows.length === 0) {
      const initial = buildDefaultStore();
      await pool.query(
        "INSERT INTO kimura_app_state (id, payload, updated_at) VALUES (1, $1::jsonb, NOW()) ON CONFLICT (id) DO NOTHING",
        [JSON.stringify(initial)],
      );
      return initial;
    }
    const { data, changed } = normalizeStorePayload(result.rows[0].payload);
    if (changed) {
      await pool.query(
        "UPDATE kimura_app_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = 1",
        [JSON.stringify(data)],
      );
    }
    return data;
  }

  if (diag.backend === "supabase") {
    const res = await supabaseRequest("kimura_app_state?id=eq.1&select=payload", {
      method: "GET",
    });
    if (!res.ok) {
      throw new Error(`Supabase read error (${res.status})`);
    }
    const rows = (await res.json()) as Array<{ payload: Partial<StoreData> }>;
    if (!Array.isArray(rows) || rows.length === 0) {
      const initial = buildDefaultStore();
      await supabaseRequest("kimura_app_state", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ id: 1, payload: initial, updated_at: new Date().toISOString() }),
      });
      return initial;
    }
    const { data, changed } = normalizeStorePayload(rows[0].payload);
    if (changed) {
      await supabaseRequest("kimura_app_state?id=eq.1", {
        method: "PATCH",
        body: JSON.stringify({ payload: data, updated_at: new Date().toISOString() }),
      });
    }
    return data;
  }

  return withLocalLock(async () => readLocalStoreSync());
}

export async function mutateStoreAtomic<T>(
  mutator: (store: StoreData) => Promise<T> | T,
): Promise<T> {
  const diag = getStorageDiagnostics();

  if (diag.backend === "postgres") {
    await ensurePgTables();
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let rowRes = await client.query<{ payload: Partial<StoreData> }>(
        "SELECT payload FROM kimura_app_state WHERE id = 1 FOR UPDATE",
      );
      if (rowRes.rows.length === 0) {
        const initial = buildDefaultStore();
        await client.query(
          "INSERT INTO kimura_app_state (id, payload, updated_at) VALUES (1, $1::jsonb, NOW()) ON CONFLICT (id) DO NOTHING",
          [JSON.stringify(initial)],
        );
        rowRes = await client.query<{ payload: Partial<StoreData> }>(
          "SELECT payload FROM kimura_app_state WHERE id = 1 FOR UPDATE",
        );
      }

      const { data } = normalizeStorePayload(rowRes.rows[0]?.payload);
      const outcome = await mutator(data);
      await client.query(
        "UPDATE kimura_app_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = 1",
        [JSON.stringify(data)],
      );
      await client.query("COMMIT");
      return outcome;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  if (diag.backend === "supabase") {
    const store = await readStore();
    const outcome = await mutator(store);
    const res = await supabaseRequest("kimura_app_state", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        id: 1,
        payload: store,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      throw new Error(`Supabase write failed (${res.status})`);
    }
    return outcome;
  }

  return withLocalLock(async () => {
    const store = readLocalStoreSync();
    const outcome = await mutator(store);
    writeLocalStoreSync(store);
    return outcome;
  });
}

// --- Persistent Media Storage (Payment Screenshots, Logos, Dish Photos) ---
export async function saveMediaAsset(
  id: string,
  mimeType: string,
  buffer: Buffer,
): Promise<string> {
  const safeId = id.replace(/[^a-zA-Z0-9._-]/g, "");
  const diag = getStorageDiagnostics();

  if (diag.backend === "postgres") {
    await ensurePgTables();
    const pool = getPgPool();
    await pool.query(
      "INSERT INTO kimura_media (id, mime_type, data_base64) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET mime_type = EXCLUDED.mime_type, data_base64 = EXCLUDED.data_base64",
      [safeId, mimeType, buffer.toString("base64")],
    );
    return `/api/media/${safeId}`;
  }

  if (diag.backend === "supabase") {
    const res = await supabaseRequest("kimura_media", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        id: safeId,
        mime_type: mimeType,
        data_base64: buffer.toString("base64"),
      }),
    });
    if (!res.ok) {
      throw new Error(`Supabase media upload failed (${res.status})`);
    }
    return `/api/media/${safeId}`;
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const resolved = path.resolve(UPLOADS_DIR, safeId);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error("Invalid media path");
  }
  fs.writeFileSync(resolved, buffer);
  return `/api/media/${safeId}`;
}

export async function getMediaAsset(
  rawId: string,
): Promise<{ mimeType: string; buffer: Buffer } | null> {
  const safeId = path.basename(rawId).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeId) return null;
  const diag = getStorageDiagnostics();

  if (diag.backend === "postgres") {
    await ensurePgTables();
    const pool = getPgPool();
    const res = await pool.query<{ mime_type: string; data_base64: string }>(
      "SELECT mime_type, data_base64 FROM kimura_media WHERE id = $1",
      [safeId],
    );
    if (res.rows.length === 0) return null;
    return {
      mimeType: res.rows[0].mime_type,
      buffer: Buffer.from(res.rows[0].data_base64, "base64"),
    };
  }

  if (diag.backend === "supabase") {
    const res = await supabaseRequest(
      `kimura_media?id=eq.${encodeURIComponent(safeId)}&select=mime_type,data_base64`,
      { method: "GET" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ mime_type: string; data_base64: string }>;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return {
      mimeType: rows[0].mime_type,
      buffer: Buffer.from(rows[0].data_base64, "base64"),
    };
  }

  const resolved = path.resolve(UPLOADS_DIR, safeId);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(resolved)) {
    return null;
  }
  const ext = path.extname(safeId).toLowerCase();
  const mimeType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return {
    mimeType,
    buffer: fs.readFileSync(resolved),
  };
}

export function getUploadsDirPath(): string {
  return UPLOADS_DIR;
}
