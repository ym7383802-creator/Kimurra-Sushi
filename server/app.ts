import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import type { Express, NextFunction, Request, Response } from "express";
import {
  BRAND_VERSION,
  MENU_VERSION,
  cloneDefaultBusinessInfo,
  cloneDefaultCategories,
  getMediaAsset,
  getStorageDiagnostics,
  getUploadsDirPath,
  mutateStoreAtomic,
  normalizeBusinessInfo,
  readStore,
  saveMediaAsset,
  type StoreData,
} from "../lib/store-adapter.ts";
import {
  DEFAULT_ORDER_SETTINGS,
  DRAGON_WARNING_MESSAGE,
  MINIMUM_SUSHI_PIECES,
  buildWhatsAppOrderMessage,
  buildWhatsAppOrderUrl,
  formatWhatsAppInternational,
  getBestOfferForItem,
  isIndividualSushiCategory,
  type BusinessInfo,
  type ComboBoxConfig,
  type CustomerOrder,
  type CustomerOrderItem,
  type MenuDishVariant,
  type MenuOffer,
  type OfferDiscountType,
  type OfferTargetType,
  type OrderSettings,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type SelectedComboPiece,
  type ServiceType,
  type KimuraSushiCategory,
  type KimuraSushiDish,
  type WhatsAppDeliveryInfo,
} from "../lib/kimura-sushi-menu.ts";

const SESSION_COOKIE_NAME = "ks_admin_session";
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const ENV_SESSION_SECRET = (process.env.SESSION_SECRET || "").trim();
let cachedStoreSecret = "";
const ENV_ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
const ENV_PASSWORD_HASH =
  process.env.ADMIN_PASSWORD_HASH ||
  (process.env.ADMIN_PASSWORD ? hashPassword(process.env.ADMIN_PASSWORD) : null);

function resolveSessionSecret(store?: StoreData): string {
  if (ENV_SESSION_SECRET) return ENV_SESSION_SECRET;
  if (store?.sessionSecret) {
    cachedStoreSecret = store.sessionSecret;
    return store.sessionSecret;
  }
  if (!cachedStoreSecret) {
    cachedStoreSecret = crypto.randomBytes(32).toString("hex");
  }
  return cachedStoreSecret;
}

interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

interface LoginAttemptRecord {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, LoginAttemptRecord>();

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = crypto.scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function signSessionPayload(payload: SessionPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifySignedSessionToken(token: string, secret: string): SessionPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");

  const expectedBuf = Buffer.from(expectedSig, "utf8");
  const actualBuf = Buffer.from(sig, "utf8");
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!parsed || typeof parsed.sub !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = decodeURIComponent(part.slice(eq + 1).trim());
    result[key] = val;
  }
  return result;
}

function setSessionCookie(req: Request, res: Response, username: string, secret: string): void {
  const now = Date.now();
  const token = signSessionPayload(
    {
      sub: username,
      iat: now,
      exp: now + INACTIVITY_TIMEOUT_MS,
    },
    secret,
  );
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    isHttps ? "SameSite=None" : "SameSite=Lax",
  ];
  if (isHttps) {
    parts.push("Secure");
    parts.push("Partitioned");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    isHttps ? "SameSite=None" : "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isHttps) {
    parts.push("Secure");
    parts.push("Partitioned");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

function getActiveAdminCredentials(store: StoreData): {
  username: string | null;
  passwordHash: string | null;
  envManaged: boolean;
} {
  if (ENV_PASSWORD_HASH) {
    return {
      username: ENV_ADMIN_USERNAME || store.adminUsername || "admin",
      passwordHash: ENV_PASSWORD_HASH,
      envManaged: true,
    };
  }
  return {
    username: store.adminUsername,
    passwordHash: store.adminPasswordHash,
    envManaged: false,
  };
}

function getValidSession(
  req: Request,
  res: Response,
  secret: string,
): { session: SessionPayload | null; timedOut: boolean } {
  const cookies = parseCookies(req);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return { session: null, timedOut: false };

  const payload = verifySignedSessionToken(rawToken, secret);
  if (!payload) {
    clearSessionCookie(req, res);
    return { session: null, timedOut: false };
  }

  if (Date.now() > payload.exp) {
    clearSessionCookie(req, res);
    return { session: null, timedOut: true };
  }

  // Rolling session extension on authenticated activity
  setSessionCookie(req, res, payload.sub, secret);
  return { session: payload, timedOut: false };
}

function isSameOriginOrXhr(req: Request): boolean {
  if (req.headers["x-requested-with"] === "XMLHttpRequest") {
    return true;
  }
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    const expectedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "");
    return Boolean(expectedHost && originHost === expectedHost);
  } catch {
    return false;
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !isSameOriginOrXhr(req)) {
    res.status(403).json({ error: "Cross-origin state mutation blocked." });
    return;
  }
  try {
    const store = ENV_SESSION_SECRET ? undefined : await readStore();
    const secret = resolveSessionSecret(store);
    const { session, timedOut } = getValidSession(req, res, secret);
    if (!session) {
      res.status(401).json({
        error: timedOut
          ? "Session expired due to inactivity. Please log in again."
          : "Unauthorized.",
        timedOut,
      });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Session verification failed." });
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    return { allowed: true };
  }
  if (record.count >= 8) {
    return { allowed: false, retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  if (loginAttempts.size > 1000) {
    for (const [key, entry] of loginAttempts.entries()) {
      if (now > entry.resetAt) {
        loginAttempts.delete(key);
      }
    }
  }
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
    return;
  }
  record.count += 1;
}

function clearFailedLogins(ip: string): void {
  loginAttempts.delete(ip);
}

const VALID_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
]);

const VALID_PAYMENT_METHODS: ReadonlySet<PaymentMethod> = new Set([
  "vodafone_cash",
  "instapay",
  "cash_on_delivery",
]);

const VALID_PAYMENT_STATUSES: ReadonlySet<PaymentStatus> = new Set([
  "pending_verification",
  "approved",
  "rejected",
  "cash_due",
]);

const VALID_SERVICE_TYPES: ReadonlySet<ServiceType> = new Set([
  "Dine-in · Main Hall",
  "Takeaway · Counter Pickup",
  "Delivery · Local Order",
]);

function isSafeInternalMediaPath(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith("/api/media/") ||
    trimmed.startsWith("/uploads/") ||
    trimmed.startsWith("/src/assets/") ||
    trimmed.startsWith("/assets/")
  );
}

function isSafeImageReference(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (isSafeInternalMediaPath(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

async function sendWhatsAppCloudOrder(
  recipientRaw: string,
  order: CustomerOrder,
  businessName: string,
): Promise<WhatsAppDeliveryInfo> {
  const overrideRecipient = (process.env.WHATSAPP_RECIPIENT_NUMBER || "").trim();
  const recipientIntl = formatWhatsAppInternational(overrideRecipient || recipientRaw);
  const waMeUrl = buildWhatsAppOrderUrl(overrideRecipient || recipientRaw, order, businessName);

  const accessToken = (process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();

  if (!accessToken || !phoneNumberId || !recipientIntl) {
    return {
      status: "manual_link_required",
      recipient: recipientIntl || recipientRaw,
      waMeUrl,
      reason: "WhatsApp Cloud API credentials are not configured; manual link ready.",
    };
  }

  try {
    const bodyText = buildWhatsAppOrderMessage(order, businessName);
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipientIntl,
          type: "text",
          text: {
            preview_url: false,
            body: bodyText,
          },
        }),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };

    if (!response.ok || !payload.messages?.[0]?.id) {
      return {
        status: "failed",
        recipient: recipientIntl,
        waMeUrl,
        reason: payload.error?.message || `WhatsApp API returned HTTP ${response.status}.`,
      };
    }

    return {
      status: "sent",
      recipient: recipientIntl,
      waMeUrl,
      messageId: payload.messages[0].id,
    };
  } catch (err) {
    return {
      status: "failed",
      recipient: recipientIntl,
      waMeUrl,
      reason: err instanceof Error ? err.message : "Network failure calling WhatsApp API.",
    };
  }
}

function parsePriceVariants(
  rawPrice: string,
  existingVariants?: MenuDishVariant[],
): MenuDishVariant[] {
  const parts = rawPrice
    .split("-")
    .map((s) => Number(s.replace(/[^0-9.]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (parts.length >= 2) {
    return [
      { label: existingVariants?.[0]?.label || "4 pcs", price: parts[0] },
      { label: existingVariants?.[1]?.label || "8 pcs", price: parts[1] },
    ];
  }
  if (parts.length === 1) {
    return [{ label: existingVariants?.[0]?.label || "Regular", price: parts[0] }];
  }
  return existingVariants ?? [];
}

function hasValidImageMagicBytes(rawType: string, buffer: Buffer): boolean {
  if (rawType === "png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (rawType === "jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (rawType === "webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

function parseBase64Image(dataUrl: string): { mimeType: string; ext: string; buffer: Buffer } | null {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const rawType = match[1] === "jpg" ? "jpeg" : match[1];
  const ext = rawType === "jpeg" ? "jpg" : rawType;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > 4 * 1024 * 1024) {
    return null;
  }
  if (!hasValidImageMagicBytes(rawType, buffer)) {
    return null;
  }
  return {
    mimeType: `image/${rawType}`,
    ext,
    buffer,
  };
}

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

function wrapAsync(fn: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch(next);
  };
}

export function createApp(): Express {
  const app = express();
  app.set("trust proxy", true);

  // Legacy static uploads directory for local preview backwards-compatibility
  app.use("/uploads", express.static(getUploadsDirPath()));

  // Serve persisted media assets (DB or local file)
  app.get("/api/media/:id", async (req, res) => {
    try {
      const asset = await getMediaAsset(req.params.id);
      if (!asset) {
        res.status(404).json({ error: "Media not found." });
        return;
      }
      res.setHeader("Content-Type", asset.mimeType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(asset.buffer);
    } catch {
      res.status(500).json({ error: "Unable to load media." });
    }
  });

  // Public payment screenshot upload (size & MIME validated)
  app.post("/api/uploads/payment-proof", express.json({ limit: "6mb" }), async (req, res) => {
    try {
      const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
      const parsed = parseBase64Image(dataUrl);
      if (!parsed) {
        res.status(400).json({
          error: "يرجى رفع صورة تحويل بصيغة PNG أو JPG أو WebP بحد أقصى 4 ميجابايت.",
        });
        return;
      }

      const fileName = `proof-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${parsed.ext}`;
      const mediaUrl = await saveMediaAsset(fileName, parsed.mimeType, parsed.buffer);
      res.status(201).json({ mediaUrl });
    } catch {
      res.status(500).json({ error: "فشل رفع صورة التحويل. حاول مرة أخرى." });
    }
  });

  // Admin media / logo upload
  app.post(
    "/api/admin/media/upload",
    express.json({ limit: "6mb" }),
    requireAdmin,
    async (req, res) => {
      try {
        const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
        const prefix =
          typeof req.body?.prefix === "string" && /^[a-z0-9-]+$/i.test(req.body.prefix)
            ? req.body.prefix
            : "menu";
        const parsed = parseBase64Image(dataUrl);
        if (!parsed) {
          res.status(400).json({ error: "Please upload a PNG, JPG, or WebP image (max 4 MB)." });
          return;
        }
        const fileName = `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString("hex")}.${parsed.ext}`;
        const mediaUrl = await saveMediaAsset(fileName, parsed.mimeType, parsed.buffer);
        res.status(201).json({ mediaUrl });
      } catch {
        res.status(500).json({ error: "Failed to save image." });
      }
    },
  );

  app.post(
    "/api/admin/logo/upload",
    express.json({ limit: "6mb" }),
    requireAdmin,
    async (req, res) => {
      try {
        const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
        const parsed = parseBase64Image(dataUrl);
        if (!parsed) {
          res.status(400).json({ error: "Please upload a PNG, JPG, or WebP image file (max 4 MB)." });
          return;
        }
        const fileName = `kimura-logo-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${parsed.ext}`;
        const mediaUrl = await saveMediaAsset(fileName, parsed.mimeType, parsed.buffer);

        const updatedInfo = await mutateStoreAtomic((store) => {
          store.businessInfo = normalizeBusinessInfo({
            ...store.businessInfo,
            logoUrl: mediaUrl,
          });
          return store.businessInfo;
        });

        res.json({
          logoUrl: updatedInfo.logoUrl,
          businessInfo: updatedInfo,
        });
      } catch {
        res.status(500).json({ error: "Unable to upload logo." });
      }
    },
  );

  app.use(express.json({ limit: "1mb" }));

  // --- Health / Diagnostics (non-sensitive) ---
  app.get("/api/health", (_req, res) => {
    const diag = getStorageDiagnostics();
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      backend: diag.backend,
      persistentOnVercel: diag.persistentOnVercel,
      whatsappApiConfigured: diag.whatsappApiConfigured,
    });
  });

  // --- Public Menu, Active Offers & Ordering ---
  app.get("/api/menu", async (_req, res) => {
    try {
      const store = await readStore();
      res.setHeader("Cache-Control", "no-store");
      res.json({
        categories: store.categories,
        offers: store.offers,
        settings: store.settings,
        businessInfo: store.businessInfo,
      });
    } catch {
      res.status(500).json({ error: "Unable to load menu." });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const body = req.body as {
        serviceType?: string;
        customerName?: string;
        customerPhone?: string;
        deliveryAddress?: string;
        notes?: string;
        paymentMethod?: string;
        paymentReference?: string;
        paymentScreenshotUrl?: string;
        items?: Array<{
          dishId?: string;
          variantLabel?: string;
          quantity?: number;
          selectedPieces?: string[];
        }>;
      };

      const serviceType = body.serviceType as ServiceType;
      if (!VALID_SERVICE_TYPES.has(serviceType)) {
        res.status(400).json({ error: "Invalid order service type." });
        return;
      }

      const customerName = (body.customerName ?? "").trim();
      const customerPhone = (body.customerPhone ?? "").trim();
      const deliveryAddress = (body.deliveryAddress ?? "").trim();
      const notes = (body.notes ?? "").trim();
      const paymentMethod = (body.paymentMethod ?? "cash_on_delivery") as PaymentMethod;
      const paymentReference = (body.paymentReference ?? "").trim();
      const rawScreenshotUrl = (body.paymentScreenshotUrl ?? "").trim();

      if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
        res.status(400).json({ error: "Invalid payment method selected." });
        return;
      }

      if (!customerName || customerName.length < 2) {
        res.status(400).json({ error: "Please provide your name." });
        return;
      }
      const phoneDigits = customerPhone.replace(/\D/g, "");
      if (!customerPhone || phoneDigits.length < 8) {
        res.status(400).json({ error: "Please provide a valid phone number." });
        return;
      }
      if (serviceType === "Delivery · Local Order" && !deliveryAddress) {
        res.status(400).json({ error: "Please provide your delivery address." });
        return;
      }

      if (rawScreenshotUrl && !isSafeInternalMediaPath(rawScreenshotUrl)) {
        res.status(400).json({ error: "Invalid payment screenshot reference." });
        return;
      }

      if (paymentMethod === "vodafone_cash" || paymentMethod === "instapay") {
        if (paymentReference.length < 4 && !rawScreenshotUrl) {
          res.status(400).json({
            error: "يرجى إدخال رقم مرجع التحويل أو إرفاق صورة التحويل لإتمام الطلب.",
          });
          return;
        }
      }

      if (!Array.isArray(body.items) || body.items.length === 0) {
        res.status(400).json({ error: "Your order tray is empty." });
        return;
      }

      const result = await mutateStoreAtomic((store) => {
        const { settings } = store;

        if (!settings.orderingEnabled) {
          return {
            errorStatus: 400,
            error: settings.closedMessage || "Online ordering is currently paused.",
          };
        }

        if (
          (serviceType === "Dine-in · Main Hall" && !settings.dineInEnabled) ||
          (serviceType === "Takeaway · Counter Pickup" && !settings.takeawayEnabled) ||
          (serviceType === "Delivery · Local Order" && !settings.deliveryEnabled)
        ) {
          return { errorStatus: 400, error: `${serviceType} is currently unavailable.` };
        }

        const nowMs = Date.now();
        const dishRequestedTotals = new Map<string, number>();
        const resolvedItems: CustomerOrderItem[] = [];
        let individualSushiCount = 0;
        let discountTotal = 0;

        for (const reqItem of body.items!) {
          const qty = Math.floor(Number(reqItem.quantity));
          if (!reqItem.dishId || !Number.isFinite(qty) || qty <= 0) {
            return { errorStatus: 400, error: "Invalid item quantity in order." };
          }

          let foundDish: KimuraSushiDish | undefined;
          let foundCat: KimuraSushiCategory | undefined;
          for (const cat of store.categories) {
            const match = cat.dishes.find((d) => d.id === reqItem.dishId);
            if (match) {
              foundDish = match;
              foundCat = cat;
              break;
            }
          }

          if (!foundDish || !foundCat) {
            return { errorStatus: 400, error: "One of the selected dishes is no longer on the menu." };
          }

          if (!foundDish.available || foundDish.stock <= 0) {
            return { errorStatus: 400, error: `${foundDish.name} is currently unavailable.` };
          }

          const nextDishTotal = (dishRequestedTotals.get(foundDish.id) ?? 0) + qty;
          if (nextDishTotal > foundDish.stock) {
            return {
              errorStatus: 400,
              error: `Only ${foundDish.stock} left in stock for ${foundDish.name}.`,
            };
          }
          dishRequestedTotals.set(foundDish.id, nextDishTotal);

          const variant =
            foundDish.variants.find((v) => v.label === reqItem.variantLabel) ?? foundDish.variants[0];
          if (!variant) {
            return { errorStatus: 400, error: `Invalid option for ${foundDish.name}.` };
          }

          const baseUnitPrice = variant.price;
          const offerEval = getBestOfferForItem({
            dishId: foundDish.id,
            categoryId: foundCat.id,
            isCombo: Boolean(foundDish.comboConfig),
            basePrice: baseUnitPrice,
            offers: store.offers,
            nowMs,
          });
          const resolvedPrice = offerEval.finalPrice;
          discountTotal += offerEval.discountAmount * qty;

          let resolvedPieces: SelectedComboPiece[] | undefined;

          if (foundDish.comboConfig) {
            const cfg = foundDish.comboConfig;
            const rawPieceIds = Array.isArray(reqItem.selectedPieces) ? reqItem.selectedPieces : [];

            if (rawPieceIds.length !== cfg.requiredPieces) {
              return {
                errorStatus: 400,
                error: `${foundDish.name} requires exactly ${cfg.requiredPieces} selected pieces.`,
              };
            }

            const allowedCategorySet = new Set(cfg.allowedCategoryIds);
            const validatedPieces: SelectedComboPiece[] = [];
            let rawSpecialCount = 0;
            let friedSpecialCount = 0;

            for (const pieceDishId of rawPieceIds) {
              let matchedPiece: KimuraSushiDish | undefined;
              let matchedPieceCatId = "";
              for (const cat of store.categories) {
                const p = cat.dishes.find((d) => d.id === pieceDishId);
                if (p) {
                  matchedPiece = p;
                  matchedPieceCatId = cat.id;
                  break;
                }
              }

              if (!matchedPiece) {
                return { errorStatus: 400, error: "One of the selected combo pieces does not exist." };
              }
              if (!allowedCategorySet.has(matchedPieceCatId)) {
                return {
                  errorStatus: 400,
                  error: `${matchedPiece.name} is not eligible for ${foundDish.name}.`,
                };
              }
              if (!matchedPiece.available || matchedPiece.stock <= 0) {
                return {
                  errorStatus: 400,
                  error: `${matchedPiece.name} is currently unavailable for combo selection.`,
                };
              }

              const piecePrice = matchedPiece.variants[0]?.price ?? 0;
              if (cfg.exactPiecePrice !== undefined && piecePrice !== cfg.exactPiecePrice) {
                return {
                  errorStatus: 400,
                  error: `${foundDish.name} only allows pieces priced at ${cfg.exactPiecePrice} EGP (${matchedPiece.name} is ${piecePrice} EGP).`,
                };
              }

              if (matchedPieceCatId === "raw-special-rolls") rawSpecialCount += 1;
              else if (matchedPieceCatId === "fried-special-rolls") friedSpecialCount += 1;

              validatedPieces.push({
                dishId: matchedPiece.id,
                dishName: matchedPiece.name,
                unitPrice: piecePrice,
              });
            }

            if (cfg.minRawSpecial !== undefined && rawSpecialCount < cfg.minRawSpecial) {
              return {
                errorStatus: 400,
                error: `${foundDish.name} requires at least ${cfg.minRawSpecial} Raw Special Rolls pieces.`,
              };
            }
            if (cfg.minFriedSpecial !== undefined && friedSpecialCount < cfg.minFriedSpecial) {
              return {
                errorStatus: 400,
                error: `${foundDish.name} requires at least ${cfg.minFriedSpecial} Fried Special Rolls pieces.`,
              };
            }

            resolvedPieces = validatedPieces;
          }

          if (!foundDish.comboConfig && isIndividualSushiCategory(foundCat)) {
            individualSushiCount += qty;
          }

          resolvedItems.push({
            dishId: foundDish.id,
            dishName: foundDish.name,
            categoryName: foundCat.name,
            variantLabel: resolvedPieces ? `${resolvedPieces.length} pcs custom` : variant.label,
            unitPrice: resolvedPrice,
            ...(offerEval.discountAmount > 0
              ? {
                  originalUnitPrice: baseUnitPrice,
                  appliedOfferTitle: offerEval.offer?.title,
                }
              : {}),
            quantity: qty,
            ...(resolvedPieces ? { selectedPieces: resolvedPieces } : {}),
          });
        }

        if (individualSushiCount > 0 && individualSushiCount < MINIMUM_SUSHI_PIECES) {
          return { errorStatus: 400, error: DRAGON_WARNING_MESSAGE };
        }

        const subtotal = resolvedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        if (settings.minimumOrderEgp > 0 && subtotal < settings.minimumOrderEgp) {
          return {
            errorStatus: 400,
            error: `Minimum order is ${settings.minimumOrderEgp.toLocaleString()} EGP.`,
          };
        }

        const deliveryFee =
          serviceType === "Delivery · Local Order" ? Math.max(0, settings.deliveryFeeEgp) : 0;
        const total = subtotal + deliveryFee;

        // Decrement stock on server atomically
        for (const cat of store.categories) {
          for (const dish of cat.dishes) {
            const used = dishRequestedTotals.get(dish.id);
            if (used) {
              dish.stock = Math.max(0, dish.stock - used);
            }
          }
        }

        const paymentStatus: PaymentStatus =
          paymentMethod === "cash_on_delivery" ? "cash_due" : "pending_verification";

        const nowIso = new Date().toISOString();
        const order: CustomerOrder = {
          id: `KS-${store.nextOrderNumber}`,
          createdAt: nowIso,
          updatedAt: nowIso,
          status: "pending",
          serviceType,
          customerName: customerName.slice(0, 80),
          customerPhone: customerPhone.slice(0, 32),
          ...(deliveryAddress ? { deliveryAddress: deliveryAddress.slice(0, 240) } : {}),
          ...(notes ? { notes: notes.slice(0, 300) } : {}),
          items: resolvedItems,
          subtotal,
          ...(discountTotal > 0 ? { discountTotal } : {}),
          deliveryFee,
          total,
          paymentMethod,
          paymentStatus,
          ...(paymentMethod !== "cash_on_delivery" && paymentReference
            ? { paymentReference: paymentReference.slice(0, 120) }
            : {}),
          ...(paymentMethod !== "cash_on_delivery" && rawScreenshotUrl
            ? { paymentScreenshotUrl: rawScreenshotUrl }
            : {}),
        };

        const targetWhatsapp = store.businessInfo.whatsapp || store.businessInfo.phone || "01155412188";
        const initialWaUrl = buildWhatsAppOrderUrl(
          targetWhatsapp,
          order,
          store.businessInfo.businessName,
        );
        order.whatsappDelivery = {
          status: "manual_link_required",
          recipient: formatWhatsAppInternational(targetWhatsapp),
          waMeUrl: initialWaUrl,
        };

        store.nextOrderNumber += 1;
        store.orders.unshift(order);

        return {
          errorStatus: null,
          order,
          estimatedPrepMinutes: settings.estimatedPrepMinutes,
          targetWhatsapp,
          businessName: store.businessInfo.businessName,
        };
      });

      if (result.errorStatus) {
        res.status(result.errorStatus).json({ error: result.error });
        return;
      }

      const { order, estimatedPrepMinutes, targetWhatsapp, businessName } = result;
      if (!order) {
        res.status(500).json({ error: "Failed to create order." });
        return;
      }

      const deliveryOutcome = await sendWhatsAppCloudOrder(targetWhatsapp, order, businessName);
      order.whatsappDelivery = deliveryOutcome;

      if (deliveryOutcome.status !== "manual_link_required") {
        await mutateStoreAtomic((store) => {
          const saved = store.orders.find((o) => o.id === order.id);
          if (saved) {
            saved.whatsappDelivery = deliveryOutcome;
          }
        });
      }

      res.status(201).json({
        order,
        estimatedPrepMinutes,
        whatsappDelivery: deliveryOutcome,
      });
    } catch (err) {
      console.error("Order submission error:", err);
      res.status(500).json({ error: "Unable to place order right now. Please try again." });
    }
  });

  // --- Admin Authentication Endpoints (Username/Email + Password) ---
  app.get("/api/admin/auth/status", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const store = await readStore();
      const creds = getActiveAdminCredentials(store);
      const { session, timedOut } = getValidSession(req, res, resolveSessionSecret(store));

      res.json({
        authenticated: Boolean(session),
        setupRequired: !creds.passwordHash,
        timedOut,
        inactivityTimeoutMs: INACTIVITY_TIMEOUT_MS,
        envManagedPassword: creds.envManaged,
        adminUsername: session ? creds.username : undefined,
      });
    } catch {
      res.status(500).json({ error: "Auth status check failed." });
    }
  });

  app.post("/api/admin/auth/setup", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      if (!isSameOriginOrXhr(req)) {
        res.status(403).json({ error: "Cross-origin setup request blocked." });
        return;
      }

      const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      if (!username || username.length < 3) {
        res.status(400).json({ error: "Admin email or username must be at least 3 characters." });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: "Password must be at least 8 characters long." });
        return;
      }

      const outcome = await mutateStoreAtomic((store) => {
        const creds = getActiveAdminCredentials(store);
        if (creds.passwordHash) {
          return { error: "Admin credentials are already configured." };
        }
        store.adminUsername = username;
        store.adminPasswordHash = hashPassword(password);
        return { error: null, username, secret: resolveSessionSecret(store) };
      });

      if (outcome.error) {
        res.status(403).json({ error: outcome.error });
        return;
      }

      setSessionCookie(req, res, outcome.username!, outcome.secret!);
      res.json({
        authenticated: true,
        adminUsername: outcome.username,
        inactivityTimeoutMs: INACTIVITY_TIMEOUT_MS,
      });
    } catch {
      res.status(500).json({ error: "Failed to save admin credentials." });
    }
  });

  app.post("/api/admin/auth/login", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      if (!isSameOriginOrXhr(req)) {
        res.status(403).json({ error: "Cross-origin login blocked." });
        return;
      }

      const ip = getClientIp(req);
      const rate = checkRateLimit(ip);
      if (!rate.allowed) {
        res.status(429).json({
          error: `Too many failed login attempts. Try again in ${rate.retryAfterSeconds} seconds.`,
        });
        return;
      }

      const usernameInput =
        typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      const store = await readStore();
      const creds = getActiveAdminCredentials(store);
      if (!creds.passwordHash || !creds.username) {
        res.status(400).json({ error: "Admin account setup is required first." });
        return;
      }

      const usernameOk =
        Boolean(usernameInput) && constantTimeEquals(usernameInput, creds.username.toLowerCase());
      const passwordOk = Boolean(password) && verifyPassword(password, creds.passwordHash);

      if (!usernameOk || !passwordOk) {
        recordFailedLogin(ip);
        res.status(401).json({ error: "Invalid email/username or password." });
        return;
      }

      clearFailedLogins(ip);
      setSessionCookie(req, res, creds.username, resolveSessionSecret(store));
      res.json({
        authenticated: true,
        adminUsername: creds.username,
        inactivityTimeoutMs: INACTIVITY_TIMEOUT_MS,
      });
    } catch {
      res.status(500).json({ error: "Authentication error." });
    }
  });

  app.post("/api/admin/auth/logout", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!isSameOriginOrXhr(req)) {
      res.status(403).json({ error: "Cross-origin logout blocked." });
      return;
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post("/api/admin/auth/ping", requireAdmin, (_req, res) => {
    res.json({ ok: true, inactivityTimeoutMs: INACTIVITY_TIMEOUT_MS });
  });

  app.post("/api/admin/auth/change-password", requireAdmin, wrapAsync(async (req, res) => {
    if (ENV_PASSWORD_HASH) {
      res.status(400).json({
        error:
          "Credentials are managed by server environment variables (ADMIN_USERNAME / ADMIN_PASSWORD).",
      });
      return;
    }

    const currentPassword =
      typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    const newUsername =
      typeof req.body?.newUsername === "string" ? req.body.newUsername.trim().toLowerCase() : "";

    const result = await mutateStoreAtomic((store) => {
      if (!store.adminPasswordHash || !verifyPassword(currentPassword, store.adminPasswordHash)) {
        return { errorStatus: 401, error: "Current password is incorrect." };
      }
      if (newPassword && newPassword.length < 8) {
        return { errorStatus: 400, error: "New password must be at least 8 characters." };
      }
      if (newUsername && newUsername.length < 3) {
        return { errorStatus: 400, error: "Username/email must be at least 3 characters." };
      }
      if (newPassword) {
        store.adminPasswordHash = hashPassword(newPassword);
      }
      if (newUsername) {
        store.adminUsername = newUsername;
      }
      return {
        errorStatus: null,
        adminUsername: store.adminUsername,
        secret: resolveSessionSecret(store),
      };
    });

    if (result.errorStatus) {
      res.status(result.errorStatus).json({ error: result.error });
      return;
    }

    if (result.adminUsername) {
      setSessionCookie(req, res, result.adminUsername, result.secret!);
    }
    res.json({ ok: true, adminUsername: result.adminUsername });
  }));

  // --- Protected Admin Endpoints ---
  app.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
    try {
      const store = await readStore();
      const creds = getActiveAdminCredentials(store);
      res.json({
        categories: store.categories,
        offers: store.offers,
        orders: store.orders,
        settings: store.settings,
        businessInfo: store.businessInfo,
        adminUsername: creds.username,
        storageDiagnostics: getStorageDiagnostics(),
      });
    } catch {
      res.status(500).json({ error: "Failed to load admin dashboard." });
    }
  });

  app.patch("/api/admin/orders/:orderId", requireAdmin, wrapAsync(async (req, res) => {
    const nextStatus = req.body?.status as OrderStatus | undefined;
    const nextPaymentStatus = req.body?.paymentStatus as PaymentStatus | undefined;
    const paymentNote = typeof req.body?.paymentNote === "string" ? req.body.paymentNote.trim() : undefined;

    if (nextStatus !== undefined && !VALID_ORDER_STATUSES.has(nextStatus)) {
      res.status(400).json({ error: "Invalid order status." });
      return;
    }
    if (nextPaymentStatus !== undefined && !VALID_PAYMENT_STATUSES.has(nextPaymentStatus)) {
      res.status(400).json({ error: "Invalid payment status." });
      return;
    }

    const updatedOrder = await mutateStoreAtomic((store) => {
      const order = store.orders.find((o) => o.id === req.params.orderId);
      if (!order) return null;

      const nowIso = new Date().toISOString();
      if (nextStatus !== undefined) {
        order.status = nextStatus;
      }
      if (nextPaymentStatus !== undefined) {
        order.paymentStatus = nextPaymentStatus;
        if (nextPaymentStatus === "approved" || nextPaymentStatus === "rejected") {
          order.paymentVerifiedAt = nowIso;
        }
      }
      if (paymentNote !== undefined) {
        order.paymentNote = paymentNote || undefined;
      }
      order.updatedAt = nowIso;
      return order;
    });

    if (!updatedOrder) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    res.json({ order: updatedOrder });
  }));

  app.delete("/api/admin/orders/:orderId", requireAdmin, wrapAsync(async (req, res) => {
    const deleted = await mutateStoreAtomic((store) => {
      const before = store.orders.length;
      store.orders = store.orders.filter((o) => o.id !== req.params.orderId);
      return store.orders.length < before;
    });
    if (!deleted) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    res.json({ ok: true });
  }));

  // --- Admin Offers & Discounts ---
  app.post("/api/admin/offers", requireAdmin, wrapAsync(async (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const description =
      typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const discountType = req.body?.discountType as OfferDiscountType;
    const discountValue = Number(req.body?.discountValue);
    const targetType = req.body?.targetType as OfferTargetType;
    const targetIds = Array.isArray(req.body?.targetIds)
      ? req.body.targetIds.map((id: unknown) => String(id).trim()).filter(Boolean)
      : [];
    const startsAt = typeof req.body?.startsAt === "string" ? req.body.startsAt.trim() : "";
    const expiresAt = typeof req.body?.expiresAt === "string" ? req.body.expiresAt.trim() : "";
    const active = typeof req.body?.active === "boolean" ? req.body.active : true;

    if (!title) {
      res.status(400).json({ error: "Offer title is required." });
      return;
    }
    if (discountType !== "percentage" && discountType !== "fixed") {
      res.status(400).json({ error: "Invalid discount type." });
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      res.status(400).json({ error: "Discount value must be greater than zero." });
      return;
    }
    if (discountType === "percentage" && discountValue > 95) {
      res.status(400).json({ error: "Percentage discount cannot exceed 95%." });
      return;
    }
    if (!["dish", "category", "combo"].includes(targetType) || targetIds.length === 0) {
      res.status(400).json({ error: "Select at least one dish, category, or combo box." });
      return;
    }

    if (startsAt && Number.isNaN(Date.parse(startsAt))) {
      res.status(400).json({ error: "Invalid offer start date." });
      return;
    }
    if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
      res.status(400).json({ error: "Invalid offer expiration date." });
      return;
    }

    const nowIso = new Date().toISOString();
    const newOffer: MenuOffer = {
      id: `offer-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      title,
      description: description || undefined,
      discountType,
      discountValue,
      targetType,
      targetIds,
      startsAt: startsAt || nowIso,
      expiresAt: expiresAt || "",
      active,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const offers = await mutateStoreAtomic((store) => {
      store.offers.unshift(newOffer);
      return store.offers;
    });

    res.status(201).json({ offer: newOffer, offers });
  }));

  app.patch("/api/admin/offers/:offerId", requireAdmin, wrapAsync(async (req, res) => {
    const result = await mutateStoreAtomic((store) => {
      const offer = store.offers.find((o) => o.id === req.params.offerId);
      if (!offer) return null;

      if (typeof req.body?.title === "string" && req.body.title.trim()) {
        offer.title = req.body.title.trim();
      }
      if (typeof req.body?.description === "string") {
        offer.description = req.body.description.trim() || undefined;
      }
      if (req.body?.discountType === "percentage" || req.body?.discountType === "fixed") {
        offer.discountType = req.body.discountType;
      }
      if (req.body?.discountValue !== undefined && Number.isFinite(Number(req.body.discountValue))) {
        const val = Number(req.body.discountValue);
        if (val > 0) {
          offer.discountValue = offer.discountType === "percentage" ? Math.min(95, val) : val;
        }
      }
      if (["dish", "category", "combo"].includes(req.body?.targetType)) {
        offer.targetType = req.body.targetType as OfferTargetType;
      }
      if (Array.isArray(req.body?.targetIds)) {
        const ids = req.body.targetIds.map((id: unknown) => String(id).trim()).filter(Boolean);
        if (ids.length > 0) offer.targetIds = ids;
      }
      if (typeof req.body?.startsAt === "string") {
        offer.startsAt = req.body.startsAt.trim();
      }
      if (typeof req.body?.expiresAt === "string") {
        offer.expiresAt = req.body.expiresAt.trim();
      }
      if (typeof req.body?.active === "boolean") {
        offer.active = req.body.active;
      }
      offer.updatedAt = new Date().toISOString();
      return { offer, offers: store.offers };
    });

    if (!result) {
      res.status(404).json({ error: "Offer not found." });
      return;
    }
    res.json(result);
  }));

  app.delete("/api/admin/offers/:offerId", requireAdmin, wrapAsync(async (req, res) => {
    const result = await mutateStoreAtomic((store) => {
      const before = store.offers.length;
      store.offers = store.offers.filter((o) => o.id !== req.params.offerId);
      if (store.offers.length === before) return null;
      return store.offers;
    });
    if (!result) {
      res.status(404).json({ error: "Offer not found." });
      return;
    }
    res.json({ offers: result });
  }));

  // --- Admin Categories & Dishes & Combo Config ---
  app.post("/api/admin/categories", requireAdmin, wrapAsync(async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const subtitle = typeof req.body?.subtitle === "string" ? req.body.subtitle.trim() : "";
    const rawCover = typeof req.body?.coverImage === "string" ? req.body.coverImage.trim() : "";
    const coverImage =
      rawCover && isSafeImageReference(rawCover)
        ? rawCover
        : "/src/assets/images/combo_kimura_box_1795699927136.jpg";

    if (!name) {
      res.status(400).json({ error: "Category name is required." });
      return;
    }

    const newCat: KimuraSushiCategory = {
      id: `cat-${Date.now()}`,
      name,
      subtitle: subtitle || undefined,
      coverImage,
      dishes: [],
    };

    const categories = await mutateStoreAtomic((store) => {
      store.categories.push(newCat);
      return store.categories;
    });

    res.status(201).json({ category: newCat, categories });
  }));

  app.patch("/api/admin/categories/:categoryId", requireAdmin, wrapAsync(async (req, res) => {
    const result = await mutateStoreAtomic((store) => {
      const cat = store.categories.find((c) => c.id === req.params.categoryId);
      if (!cat) return null;

      if (typeof req.body?.name === "string" && req.body.name.trim()) {
        cat.name = req.body.name.trim();
      }
      if (typeof req.body?.subtitle === "string") {
        cat.subtitle = req.body.subtitle.trim() || undefined;
      }
      if (typeof req.body?.coverImage === "string" && isSafeImageReference(req.body.coverImage)) {
        cat.coverImage = req.body.coverImage.trim();
      }
      return { category: cat, categories: store.categories };
    });

    if (!result) {
      res.status(404).json({ error: "Category not found." });
      return;
    }
    res.json(result);
  }));

  app.delete("/api/admin/categories/:categoryId", requireAdmin, wrapAsync(async (req, res) => {
    const result = await mutateStoreAtomic((store) => {
      if (store.categories.length <= 1) {
        return { error: "Cannot delete the last remaining category." };
      }
      const before = store.categories.length;
      store.categories = store.categories.filter((c) => c.id !== req.params.categoryId);
      if (store.categories.length === before) {
        return { error: "Category not found.", status: 404 };
      }
      return { categories: store.categories };
    });

    if ("error" in result) {
      res.status(result.status ?? 400).json({ error: result.error });
      return;
    }
    res.json(result);
  }));

  app.post("/api/admin/categories/:categoryId/dishes", requireAdmin, wrapAsync(async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "New Dish";
    const description =
      typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const piecesInfo = typeof req.body?.piecesInfo === "string" ? req.body.piecesInfo.trim() : "";
    const rawImage = typeof req.body?.image === "string" ? req.body.image.trim() : "";
    const priceDisplay =
      typeof req.body?.priceDisplay === "string" && req.body.priceDisplay.trim()
        ? req.body.priceDisplay.trim()
        : "100";
    const stock = Number.isFinite(Number(req.body?.stock))
      ? Math.max(0, Math.floor(Number(req.body.stock)))
      : 25;
    const available = typeof req.body?.available === "boolean" ? req.body.available : true;

    let variants: MenuDishVariant[] =
      Array.isArray(req.body?.variants) && req.body.variants.length > 0
        ? req.body.variants
        : parsePriceVariants(priceDisplay);

    if (variants.length === 0) {
      variants = [{ label: piecesInfo || "Regular", price: 100 }];
    }

    const result = await mutateStoreAtomic((store) => {
      const cat = store.categories.find((c) => c.id === req.params.categoryId);
      if (!cat) return null;

      const isComboCategory = cat.id === "combos";
      const newDish: KimuraSushiDish = {
        id: `${isComboCategory ? "combo" : "dish"}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name,
        description: description || undefined,
        piecesInfo: piecesInfo || undefined,
        image:
          rawImage && isSafeImageReference(rawImage) ? rawImage : cat.coverImage,
        priceDisplay,
        variants,
        available,
        stock,
        ...(isComboCategory
          ? {
              comboConfig: {
                requiredPieces: 10,
                minRawSpecial: 4,
                minFriedSpecial: 4,
                remainingCategoryId: "old-menu",
                allowedCategoryIds: ["raw-special-rolls", "fried-special-rolls", "old-menu"],
              },
            }
          : {}),
      };

      cat.dishes.unshift(newDish);
      return { dish: newDish, categories: store.categories };
    });

    if (!result) {
      res.status(404).json({ error: "Category not found." });
      return;
    }
    res.status(201).json(result);
  }));

  app.patch("/api/admin/dishes/:dishId", requireAdmin, wrapAsync(async (req, res) => {
    const result = await mutateStoreAtomic((store) => {
      let targetDish: KimuraSushiDish | undefined;
      for (const cat of store.categories) {
        const match = cat.dishes.find((d) => d.id === req.params.dishId);
        if (match) {
          targetDish = match;
          break;
        }
      }
      if (!targetDish) return null;

      if (typeof req.body?.name === "string" && req.body.name.trim()) {
        targetDish.name = req.body.name.trim();
      }
      if (typeof req.body?.description === "string") {
        targetDish.description = req.body.description.trim() || undefined;
      }
      if (typeof req.body?.piecesInfo === "string") {
        targetDish.piecesInfo = req.body.piecesInfo.trim() || undefined;
      }
      if (typeof req.body?.image === "string") {
        const trimmedImg = req.body.image.trim();
        targetDish.image = trimmedImg && isSafeImageReference(trimmedImg) ? trimmedImg : undefined;
      }
      if (typeof req.body?.available === "boolean") {
        targetDish.available = req.body.available;
      }
      if (req.body?.stock !== undefined && Number.isFinite(Number(req.body.stock))) {
        targetDish.stock = Math.max(0, Math.floor(Number(req.body.stock)));
      }
      if (typeof req.body?.priceDisplay === "string" && req.body.priceDisplay.trim()) {
        targetDish.priceDisplay = req.body.priceDisplay.trim();
        const parsedVariants = parsePriceVariants(targetDish.priceDisplay, targetDish.variants);
        if (parsedVariants.length > 0) {
          targetDish.variants = parsedVariants;
        }
      }
      if (Array.isArray(req.body?.variants) && req.body.variants.length > 0) {
        targetDish.variants = req.body.variants.map((v: MenuDishVariant) => ({
          label: String(v.label || "Regular"),
          price: Math.max(0, Number(v.price) || 0),
        }));
      }
      if (req.body?.comboConfig && typeof req.body.comboConfig === "object") {
        const rawCfg = req.body.comboConfig as Partial<ComboBoxConfig>;
        const requiredPieces = Math.max(1, Math.min(120, Math.floor(Number(rawCfg.requiredPieces) || 6)));
        const allowedCategoryIds = Array.isArray(rawCfg.allowedCategoryIds)
          ? rawCfg.allowedCategoryIds.map((c) => String(c).trim()).filter(Boolean)
          : ["raw-special-rolls", "fried-special-rolls", "old-menu"];

        const nextCfg: ComboBoxConfig = {
          requiredPieces,
          allowedCategoryIds:
            allowedCategoryIds.length > 0
              ? allowedCategoryIds
              : ["raw-special-rolls", "fried-special-rolls", "old-menu"],
        };

        if (rawCfg.exactPiecePrice !== undefined && rawCfg.exactPiecePrice !== null && Number(rawCfg.exactPiecePrice) > 0) {
          nextCfg.exactPiecePrice = Math.floor(Number(rawCfg.exactPiecePrice));
        } else {
          if (rawCfg.minRawSpecial !== undefined && Number.isFinite(Number(rawCfg.minRawSpecial))) {
            nextCfg.minRawSpecial = Math.max(0, Math.floor(Number(rawCfg.minRawSpecial)));
          }
          if (rawCfg.minFriedSpecial !== undefined && Number.isFinite(Number(rawCfg.minFriedSpecial))) {
            nextCfg.minFriedSpecial = Math.max(0, Math.floor(Number(rawCfg.minFriedSpecial)));
          }
          if (typeof rawCfg.remainingCategoryId === "string" && rawCfg.remainingCategoryId.trim()) {
            nextCfg.remainingCategoryId = rawCfg.remainingCategoryId.trim();
          }
        }
        targetDish.comboConfig = nextCfg;
      }

      return { dish: targetDish, categories: store.categories };
    });

    if (!result) {
      res.status(404).json({ error: "Dish not found." });
      return;
    }
    res.json(result);
  }));

  app.delete("/api/admin/dishes/:dishId", requireAdmin, wrapAsync(async (req, res) => {
    const categories = await mutateStoreAtomic((store) => {
      for (const cat of store.categories) {
        const before = cat.dishes.length;
        cat.dishes = cat.dishes.filter((d) => d.id !== req.params.dishId);
        if (cat.dishes.length < before) {
          return store.categories;
        }
      }
      return null;
    });
    if (!categories) {
      res.status(404).json({ error: "Dish not found." });
      return;
    }
    res.json({ categories });
  }));

  app.patch("/api/admin/settings", requireAdmin, wrapAsync(async (req, res) => {
    const body = (req.body ?? {}) as Partial<OrderSettings>;
    const settings = await mutateStoreAtomic((store) => {
      const s = store.settings;
      if (typeof body.orderingEnabled === "boolean") s.orderingEnabled = body.orderingEnabled;
      if (typeof body.closedMessage === "string") {
        s.closedMessage = body.closedMessage.trim() || DEFAULT_ORDER_SETTINGS.closedMessage;
      }
      if (typeof body.dineInEnabled === "boolean") s.dineInEnabled = body.dineInEnabled;
      if (typeof body.takeawayEnabled === "boolean") s.takeawayEnabled = body.takeawayEnabled;
      if (typeof body.deliveryEnabled === "boolean") s.deliveryEnabled = body.deliveryEnabled;
      if (
        body.estimatedPrepMinutes !== undefined &&
        Number.isFinite(Number(body.estimatedPrepMinutes))
      ) {
        s.estimatedPrepMinutes = Math.max(
          5,
          Math.min(180, Math.floor(Number(body.estimatedPrepMinutes))),
        );
      }
      if (body.deliveryFeeEgp !== undefined && Number.isFinite(Number(body.deliveryFeeEgp))) {
        s.deliveryFeeEgp = Math.max(0, Math.floor(Number(body.deliveryFeeEgp)));
      }
      if (body.minimumOrderEgp !== undefined && Number.isFinite(Number(body.minimumOrderEgp))) {
        s.minimumOrderEgp = Math.max(0, Math.floor(Number(body.minimumOrderEgp)));
      }
      return store.settings;
    });
    res.json({ settings });
  }));

  app.patch("/api/admin/business", requireAdmin, wrapAsync(async (req, res) => {
    const body = (req.body ?? {}) as Partial<BusinessInfo>;
    const businessInfo = await mutateStoreAtomic((store) => {
      const merged = normalizeBusinessInfo({
        ...store.businessInfo,
        ...body,
        branches: Array.isArray(body.branches) ? body.branches : store.businessInfo.branches,
      });
      store.businessInfo = merged;
      return store.businessInfo;
    });
    res.json({ businessInfo });
  }));

  app.post("/api/admin/menu/reset", requireAdmin, wrapAsync(async (_req, res) => {
    const data = await mutateStoreAtomic((store) => {
      store.menuVersion = MENU_VERSION;
      store.categories = cloneDefaultCategories();
      store.settings = { ...DEFAULT_ORDER_SETTINGS };
      return { categories: store.categories, settings: store.settings };
    });
    res.json(data);
  }));

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ error: "Invalid JSON payload." });
      return;
    }
    const status =
      typeof (err as { status?: unknown })?.status === "number"
        ? (err as { status: number }).status
        : 500;
    if (status === 413) {
      res.status(413).json({ error: "Uploaded payload is too large." });
      return;
    }
    console.error("Unhandled API error:", err);
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: "Unexpected server error. Please try again.",
    });
  });

  return app;
}
