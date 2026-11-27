export interface MenuDishVariant {
  label: string;
  price: number;
}

export interface ComboBoxConfig {
  requiredPieces: number;
  exactPiecePrice?: number;
  minRawSpecial?: number;
  minFriedSpecial?: number;
  remainingCategoryId?: string;
  allowedCategoryIds: string[];
}

export interface SelectedComboPiece {
  dishId: string;
  dishName: string;
  unitPrice: number;
}

export interface KimuraSushiDish {
  id: string;
  name: string;
  description?: string;
  piecesInfo?: string;
  image?: string;
  priceDisplay: string;
  variants: MenuDishVariant[];
  available: boolean;
  stock: number;
  comboConfig?: ComboBoxConfig;
}

export interface KimuraSushiCategory {
  id: string;
  name: string;
  subtitle?: string;
  group?: "top" | "special-pieces" | "bottom";
  coverImage: string;
  dishes: KimuraSushiDish[];
}

export type OfferDiscountType = "percentage" | "fixed";
export type OfferTargetType = "dish" | "category" | "combo";

export interface MenuOffer {
  id: string;
  title: string;
  description?: string;
  discountType: OfferDiscountType;
  discountValue: number;
  targetType: OfferTargetType;
  targetIds: string[];
  startsAt: string;
  expiresAt: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export type ServiceType =
  | "Dine-in · Main Hall"
  | "Takeaway · Counter Pickup"
  | "Delivery · Local Order";

export type PaymentMethod = "vodafone_cash" | "instapay" | "cash_on_delivery";

export type PaymentStatus = "pending_verification" | "approved" | "rejected" | "cash_due";

export interface WhatsAppDeliveryInfo {
  status: "sent" | "manual_link_required" | "failed";
  recipient: string;
  waMeUrl: string;
  messageId?: string;
  reason?: string;
}

export interface CustomerOrderItem {
  dishId: string;
  dishName: string;
  categoryName: string;
  variantLabel: string;
  unitPrice: number;
  originalUnitPrice?: number;
  appliedOfferTitle?: string;
  quantity: number;
  selectedPieces?: SelectedComboPiece[];
}

export interface CustomerOrder {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  serviceType: ServiceType;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  notes?: string;
  items: CustomerOrderItem[];
  subtotal: number;
  discountTotal?: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  paymentScreenshotUrl?: string;
  paymentNote?: string;
  paymentVerifiedAt?: string;
  whatsappDelivery?: WhatsAppDeliveryInfo;
}

export interface OrderSettings {
  orderingEnabled: boolean;
  closedMessage: string;
  dineInEnabled: boolean;
  takeawayEnabled: boolean;
  deliveryEnabled: boolean;
  estimatedPrepMinutes: number;
  deliveryFeeEgp: number;
  minimumOrderEgp: number;
}

export interface BusinessBranch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  mapsUrl?: string;
}

export interface BusinessInfo {
  businessName: string;
  slogan: string;
  logoUrl: string;
  aboutUs: string;
  chefName: string;
  chefInstagramUrl: string;
  chefPhotoUrl: string;
  instagramHandle: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  phone: string;
  whatsapp: string;
  vodafoneCashNumber: string;
  instaPayIdentifier: string;
  email: string;
  businessHours: string;
  deliveryInfo: string;
  branches: BusinessBranch[];
}

export const DEFAULT_ORDER_SETTINGS: OrderSettings = {
  orderingEnabled: true,
  closedMessage: "Online ordering is temporarily paused. Please call us directly.",
  dineInEnabled: true,
  takeawayEnabled: true,
  deliveryEnabled: true,
  estimatedPrepMinutes: 25,
  deliveryFeeEgp: 0,
  minimumOrderEgp: 0,
};

export const DEFAULT_BRAND_LOGO = "/assets/kimura-dragon-logo.png";
export const DEFAULT_BUSINESS_PHONE = "01155412188";
export const MINIMUM_SUSHI_PIECES = 6;
export const DRAGON_WARNING_MESSAGE = "ممنوع الطلب لأقل من 6 قطع، من فضلك اختار 6 قطع أو أكثر";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { en: string; ar: string }> = {
  vodafone_cash: { en: "Vodafone Cash", ar: "فودافون كاش" },
  instapay: { en: "InstaPay", ar: "إنستاباي" },
  cash_on_delivery: { en: "Cash on Delivery", ar: "الدفع عند الاستلام" },
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, { en: string; ar: string }> = {
  pending_verification: { en: "Pending Payment Verification", ar: "قيد مراجعة الدفع" },
  approved: { en: "Payment Approved", ar: "تم تأكيد الدفع" },
  rejected: { en: "Payment Rejected", ar: "تم رفض الدفع" },
  cash_due: { en: "Cash on Delivery", ar: "الدفع عند الاستلام" },
};

export function isIndividualSushiCategory(category: Pick<KimuraSushiCategory, "id" | "name">): boolean {
  if (category.id === "combos" || category.id === "kimura-noodles") return false;
  if (category.name.toLowerCase().includes("noodle")) return false;
  return true;
}

export function isIndividualSushiCategoryName(categoryName: string, isCombo?: boolean): boolean {
  if (isCombo) return false;
  const lower = categoryName.toLowerCase();
  if (lower.includes("combo") || lower.includes("noodle")) return false;
  return true;
}

export function isOfferCurrentlyActive(offer: MenuOffer, nowMs = Date.now()): boolean {
  if (!offer.active) return false;
  const startMs = offer.startsAt ? Date.parse(offer.startsAt) : Number.NEGATIVE_INFINITY;
  const endMs = offer.expiresAt ? Date.parse(offer.expiresAt) : Number.POSITIVE_INFINITY;
  if (Number.isFinite(startMs) && nowMs < startMs) return false;
  if (Number.isFinite(endMs) && nowMs > endMs) return false;
  return true;
}

export function computeOfferDiscountedPrice(
  basePrice: number,
  offer: Pick<MenuOffer, "discountType" | "discountValue">,
): number {
  if (basePrice <= 0) return 0;
  if (offer.discountType === "percentage") {
    const pct = Math.max(0, Math.min(95, offer.discountValue));
    return Math.max(1, Math.round(basePrice * (1 - pct / 100)));
  }
  const fixed = Math.max(0, offer.discountValue);
  return Math.max(1, Math.round(basePrice - fixed));
}

export function getBestOfferForItem(params: {
  dishId: string;
  categoryId: string;
  isCombo: boolean;
  basePrice: number;
  offers: MenuOffer[];
  nowMs?: number;
}): {
  finalPrice: number;
  originalPrice: number;
  discountAmount: number;
  offer: MenuOffer | null;
} {
  const { dishId, categoryId, isCombo, basePrice, offers, nowMs = Date.now() } = params;
  let bestPrice = basePrice;
  let bestOffer: MenuOffer | null = null;

  for (const offer of offers) {
    if (!isOfferCurrentlyActive(offer, nowMs)) continue;
    const matches =
      (offer.targetType === "dish" && offer.targetIds.includes(dishId)) ||
      (offer.targetType === "combo" && isCombo && offer.targetIds.includes(dishId)) ||
      (offer.targetType === "category" && offer.targetIds.includes(categoryId));
    if (!matches) continue;

    const candidatePrice = computeOfferDiscountedPrice(basePrice, offer);
    if (candidatePrice < bestPrice) {
      bestPrice = candidatePrice;
      bestOffer = offer;
    }
  }

  return {
    finalPrice: bestPrice,
    originalPrice: basePrice,
    discountAmount: Math.max(0, basePrice - bestPrice),
    offer: bestOffer,
  };
}

export function formatWhatsAppInternational(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length === 11) {
    return `2${digits}`;
  }
  if (digits.startsWith("00")) {
    return digits.slice(2);
  }
  return digits;
}

export function formatTikTokHandle(url: string): string {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").filter(Boolean)[0];
    if (!segment) return "TikTok";
    return segment.startsWith("@") ? segment : `@${segment}`;
  } catch {
    return "TikTok";
  }
}

export function buildWhatsAppOrderMessage(order: CustomerOrder, businessName: string): string {
  const lines: string[] = [
    `*${businessName} — طلب جديد ${order.id}*`,
    `نوع الطلب: ${order.serviceType}`,
    `العميل: ${order.customerName}`,
    `رقم الهاتف: ${order.customerPhone}`,
  ];

  if (order.deliveryAddress) {
    lines.push(`عنوان التوصيل: ${order.deliveryAddress}`);
  }

  lines.push("", "*الأصناف المطلوبة:*");
  order.items.forEach((item, index) => {
    const lineTotal = item.unitPrice * item.quantity;
    const variantPart =
      item.variantLabel && item.variantLabel !== "Regular" ? ` (${item.variantLabel})` : "";
    lines.push(`${index + 1}. ${item.quantity}× ${item.dishName}${variantPart} — ${lineTotal} EGP`);
    if (item.selectedPieces && item.selectedPieces.length > 0) {
      const pieceSummary = item.selectedPieces
        .map((p, sIdx) => `#${sIdx + 1} ${p.dishName}`)
        .join("، ");
      lines.push(`   القطع المختارة: ${pieceSummary}`);
    }
  });

  lines.push("");
  if (order.discountTotal && order.discountTotal > 0) {
    lines.push(`الخصم (العروض): -${order.discountTotal} EGP`);
  }
  if (order.deliveryFee > 0) {
    lines.push(`رسوم التوصيل: ${order.deliveryFee} EGP`);
  }
  lines.push(`*الإجمالي: ${order.total} EGP*`);

  const methodLabel = PAYMENT_METHOD_LABELS[order.paymentMethod]?.ar ?? order.paymentMethod;
  const statusLabel = PAYMENT_STATUS_LABELS[order.paymentStatus]?.ar ?? order.paymentStatus;
  lines.push(`طريقة الدفع: ${methodLabel}`);
  lines.push(`حالة الدفع: ${statusLabel}`);
  if (order.paymentReference) {
    lines.push(`رقم مرجع التحويل: ${order.paymentReference}`);
  }
  if (order.paymentScreenshotUrl) {
    lines.push(`صورة التحويل: مرفقة بالطلب في لوحة التحكم`);
  }
  if (order.notes) {
    lines.push(`ملاحظات العميل: ${order.notes}`);
  }

  return lines.join("\n");
}

export function buildWhatsAppOrderUrl(
  rawPhone: string,
  order: CustomerOrder,
  businessName: string,
): string {
  const intl = formatWhatsAppInternational(rawPhone);
  if (!intl) return "#";
  const text = buildWhatsAppOrderMessage(order, businessName);
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  businessName: "Kimura Sushi",
  slogan: "",
  logoUrl: DEFAULT_BRAND_LOGO,
  aboutUs: "",
  chefName: "",
  chefInstagramUrl: "",
  chefPhotoUrl: "",
  instagramHandle: "@kimurasushi2025",
  instagramUrl: "https://www.instagram.com/kimurasushi2025?utm_source=ig_web_button_share_sheet&bqrl=ZDNlZDc0MzIxNw==",
  facebookUrl: "",
  tiktokUrl: "https://www.tiktok.com/@kimurasushi1",
  phone: DEFAULT_BUSINESS_PHONE,
  whatsapp: DEFAULT_BUSINESS_PHONE,
  vodafoneCashNumber: DEFAULT_BUSINESS_PHONE,
  instaPayIdentifier: DEFAULT_BUSINESS_PHONE,
  email: "",
  businessHours: "",
  deliveryInfo: "",
  branches: [
    {
      id: "branch-mansoura",
      name: "المنصورة | Mansoura",
      address: "",
      phone: DEFAULT_BUSINESS_PHONE,
      whatsapp: DEFAULT_BUSINESS_PHONE,
      mapsUrl: "",
    },
    {
      id: "branch-ras-el-bar",
      name: "رأس البر | Ras El Bar",
      address: "",
      phone: DEFAULT_BUSINESS_PHONE,
      whatsapp: DEFAULT_BUSINESS_PHONE,
      mapsUrl: "",
    },
  ],
};

function single(
  id: string,
  name: string,
  price: number,
  options?: {
    description?: string;
    piecesInfo?: string;
    image?: string;
    priceDisplay?: string;
    variantLabel?: string;
    comboConfig?: ComboBoxConfig;
  },
): KimuraSushiDish {
  return {
    id,
    name,
    description: options?.description,
    piecesInfo: options?.piecesInfo,
    image: options?.image,
    priceDisplay: options?.priceDisplay ?? String(price),
    variants: [{ label: options?.variantLabel ?? (options?.piecesInfo || "Regular"), price }],
    available: true,
    stock: 25,
    ...(options?.comboConfig ? { comboConfig: options.comboConfig } : {}),
  };
}

function noodleWithSpiceLevels(
  id: string,
  name: string,
  price: number,
  description: string,
  image: string,
): KimuraSushiDish {
  return {
    id,
    name,
    description,
    piecesInfo: "Original · Spicy · Extra Spicy",
    image,
    priceDisplay: String(price),
    variants: [
      { label: "Original – عادي", price },
      { label: "Spicy – حراق 🌶️", price },
      { label: "Extra Spicy – حراق جدًا 🌶️🌶️", price },
    ],
    available: true,
    stock: 25,
  };
}

function boxConfigForSize(requiredPieces: number): ComboBoxConfig {
  return {
    requiredPieces,
    minRawSpecial: 4,
    minFriedSpecial: 4,
    remainingCategoryId: "old-menu",
    allowedCategoryIds: ["raw-special-rolls", "fried-special-rolls", "old-menu"],
  };
}

export const DEFAULT_KIMURA_CATEGORIES: KimuraSushiCategory[] = [
  {
    id: "combos",
    name: "Combo Selection",
    subtitle: "اختار بوكسك قطعة بقطعة",
    group: "top",
    coverImage: "/src/assets/images/combo_kimura_box_1795699927136.jpg",
    dishes: [
      single("combo-mini-box", "Mini Box", 150, {
        piecesInfo: "6 قطع",
        image: "/src/assets/images/combo_mini_box_1795699926860.jpg",
        comboConfig: {
          requiredPieces: 6,
          exactPiecePrice: 30,
          allowedCategoryIds: ["raw-special-rolls", "fried-special-rolls", "old-menu"],
        },
      }),
      single("combo-solo-box", "Solo Box", 250, {
        piecesInfo: "10 قطع",
        image: "/src/assets/images/combo_solo_box_1795700046654.jpg",
        comboConfig: boxConfigForSize(10),
      }),
      single("combo-tokyo-box", "Tokyo Box", 290, {
        piecesInfo: "12 قطعة",
        image: "/src/assets/images/combo_tokyo_box_1795699926727.jpg",
        comboConfig: boxConfigForSize(12),
      }),
      single("combo-classic-box", "Classic Box", 430, {
        piecesInfo: "16 قطعة",
        image: "/src/assets/images/combo_classic_box_1795699927140.jpg",
        comboConfig: boxConfigForSize(16),
      }),
      single("combo-double-box", "Double Box", 490, {
        piecesInfo: "20 قطعة",
        image: "/src/assets/images/combo_double_box_1795699927185.jpg",
        comboConfig: boxConfigForSize(20),
      }),
      single("combo-kimura-box", "Kimura Box", 550, {
        piecesInfo: "24 قطعة",
        image: "/src/assets/images/combo_kimura_box_1795699927136.jpg",
        comboConfig: boxConfigForSize(24),
      }),
      single("combo-samurai-box", "Samurai Box", 700, {
        piecesInfo: "30 قطعة",
        image: "/src/assets/images/combo_samurai_box_1795699927736.jpg",
        comboConfig: boxConfigForSize(30),
      }),
      single("combo-friends-box", "Friends Box", 850, {
        piecesInfo: "36 قطعة",
        image: "/src/assets/images/combo_friends_box_1795699926903.jpg",
        comboConfig: boxConfigForSize(36),
      }),
      single("combo-family-box", "Family Box", 1100, {
        piecesInfo: "50 قطعة",
        priceDisplay: "1,100",
        image: "/src/assets/images/combo_family_box_1795699927653.jpg",
        comboConfig: boxConfigForSize(50),
      }),
      single("combo-party-box", "Party Box", 1500, {
        piecesInfo: "70 قطعة",
        priceDisplay: "1,500",
        image: "/src/assets/images/combo_party_box_1795699986868.jpg",
        comboConfig: boxConfigForSize(70),
      }),
    ],
  },
  {
    id: "kimura-noodles",
    name: "KIMURA NOODLES",
    subtitle: "Original · Spicy · Extra Spicy",
    group: "top",
    coverImage: "/src/assets/images/cat_noodles_1795001031049.jpg",
    dishes: [
      noodleWithSpiceLevels(
        "noodles-chicken",
        "Chicken Noodles – نودلز فراخ",
        150,
        "نودلز مع قطع الفراخ، خضار سوتيه، صويا صوص، ترياكي وسمسم.",
        "/src/assets/images/cat_noodles_1795001031049.jpg",
      ),
      noodleWithSpiceLevels(
        "noodles-beef",
        "Beef Noodles – نودلز لحمة",
        180,
        "نودلز مع شرائح اللحمة، فلفل ألوان، بصل وصوص كيمورا الخاص.",
        "/src/assets/images/noodles_beef_1795699865758.jpg",
      ),
      noodleWithSpiceLevels(
        "noodles-shrimp",
        "Shrimp Noodles – نودلز جمبري",
        200,
        "نودلز مع الجمبري، خضار سوتيه، صوص آسيوي وسمسم.",
        "/src/assets/images/noodles_shrimp_1795699865212.jpg",
      ),
    ],
  },
  {
    id: "raw-special-rolls",
    name: "Raw Special Rolls",
    subtitle: "Special Pieces · رو سبيشيال رولز",
    group: "special-pieces",
    coverImage: "/src/assets/images/raw_salmon_lava_1795699866308.jpg",
    dishes: [
      single("raw-salmon-lava", "Salmon Lava Roll – سالمون لافا", 40, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/raw_salmon_lava_1795699866308.jpg",
        description: "سالمون، أفوكادو، كريم تشيز، وتوبينج سالمون مع سبايسي مايو.",
      }),
      single("raw-rainbow-roll", "Rainbow Roll – رينبو رول", 45, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/raw_rainbow_roll_1795699866486.jpg",
        description: "كراب، خيار، أفوكادو، وتوبينج سالمون وتونة وجمبري مطهي.",
      }),
      single("raw-spicy-tuna", "Spicy Tuna Roll – سبايسي تونا", 35, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/raw_spicy_tuna_1795699867141.jpg",
        description: "تونة، خيار، سبايسي مايو، وسمسم.",
      }),
      single("raw-green-dragon", "Green Dragon – جرين دراجون", 35, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/sushi_dragon_roll_1795000107444.jpg",
        description: "جمبري تمبورا، كريم تشيز، وتوبينج أفوكادو وصوص أوناجي.",
      }),
      single("raw-crab-volcano", "Crab Volcano – كراب فولكانو", 30, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/raw_crab_volcano_1795699866596.jpg",
        description: "جمبري، خيار، وتوبينج ميكس كراب وسبايسي مايو.",
      }),
    ],
  },
  {
    id: "fried-special-rolls",
    name: "Fried Special Rolls",
    subtitle: "Special Pieces · فرايد سبيشيال رولز",
    group: "special-pieces",
    coverImage: "/src/assets/images/fried_kimura_special_1795699867236.jpg",
    dishes: [
      single("fried-fire-roll", "Fire Roll – فاير رول", 30, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/fried_fire_roll_1795699867021.jpg",
        description: "جمبري، كريم تشيز، شيتوس حار، وهوت صوص.",
      }),
      single("fried-kimura-special", "Kimura Special – كيمورا سبيشيال", 35, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/fried_kimura_special_1795699867236.jpg",
        description: "جمبري، كراب، كريم تشيز، وتوبينج كراب مع صوص كيمورا الخاص.",
      }),
      single("fried-cheese-bomb", "Cheese Bomb – تشيز بومب", 30, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/fried_cheese_bomb_1795699867791.jpg",
        description: "جمبري، موتزاريلا، كريم تشيز، وصوص شيدر.",
      }),
      single("fried-crunchy-monster", "Crunchy Monster – كرانشي مونستر", 30, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/fried_crunchy_monster_1795699869339.jpg",
        description: "جمبري، كراب، كريم تشيز، وكريسبي أونيون مع ترياكي صوص.",
      }),
      single("fried-salmon-bomb", "Salmon Bomb – سالمون بومب", 40, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/fried_salmon_bomb_1795699867772.jpg",
        description: "سالمون، كريم تشيز، وصوص سبايسي وأوناجي.",
      }),
    ],
  },
  {
    id: "old-menu",
    name: "Old Menu",
    subtitle: "القطع الفردية الأصلية (Raw Rolls & Fried Rolls)",
    group: "bottom",
    coverImage: "/src/assets/images/old_menu_cover_1795699864197.jpg",
    dishes: [
      single("old-philadelphia-roll", "Philadelphia Roll", 30, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/old_philadelphia_roll_1795699868310.jpg",
        description: "Raw Rolls · Old Menu",
      }),
      single("old-california-roll", "California Roll", 30, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/sushi_california_roll_1795000105866.jpg",
        description: "Raw Rolls · Old Menu",
      }),
      single("old-cheetos-roll", "Cheetos Roll", 25, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/old_cheetos_roll_1795699986710.jpg",
        description: "Raw Rolls · Old Menu",
      }),
      single("old-tiger-shrimp-roll", "Tiger Shrimp Roll", 25, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/old_tiger_shrimp_roll_1795699987192.jpg",
        description: "Raw Rolls · Old Menu",
      }),
      single("old-golden-roll", "Golden Roll", 25, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/old_golden_roll_1795699986685.jpg",
        description: "Raw Rolls · Old Menu",
      }),
      single("old-spicy-crab-roll", "Spicy Crab Roll", 30, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/old_spicy_crab_roll_1795699928110.jpg",
        description: "Raw Rolls · Old Menu",
      }),
      single("old-godzilla-roll", "Godzilla Roll", 30, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/old_godzilla_roll_1795699928842.jpg",
        description: "Fried Rolls · Old Menu",
      }),
      single("old-spicy-lemon-roll", "Spicy Lemon Roll", 30, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/old_spicy_lemon_roll_1795699873891.jpg",
        description: "Fried Rolls · Old Menu",
      }),
      single("old-volcano-roll", "Volcano Roll", 30, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/old_volcano_roll_1795699927749.jpg",
        description: "Fried Rolls · Old Menu",
      }),
      single("old-spider-roll", "Spider Roll", 30, {
        piecesInfo: "1 pc",
        image: "/src/assets/images/old_spider_roll_1795699926693.jpg",
        description: "Fried Rolls · Old Menu",
      }),
    ],
  },
];
