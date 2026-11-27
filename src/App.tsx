import * as React from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  ChefHat,
  ChevronRight,
  Clock,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  Moon,
  Phone,
  Plus,
  ShoppingBag,
  Sun,
  Tag,
  Truck,
} from "lucide-react";
import SushiConveyorMenu from "@/components/ui/sushi-conveyor-menu";
import type { ConveyorDish } from "@/components/ui/sushi-conveyor-menu";
import {
  DEFAULT_BRAND_LOGO,
  DEFAULT_BUSINESS_INFO,
  DEFAULT_ORDER_SETTINGS,
  DEFAULT_KIMURA_CATEGORIES,
  MINIMUM_SUSHI_PIECES,
  formatTikTokHandle,
  formatWhatsAppInternational,
  getBestOfferForItem,
  isIndividualSushiCategory,
  isIndividualSushiCategoryName,
  isOfferCurrentlyActive,
  type BusinessInfo,
  type MenuDishVariant,
  type MenuOffer,
  type OrderSettings,
  type SelectedComboPiece,
  type KimuraSushiCategory,
  type KimuraSushiDish,
} from "@/lib/kimura-sushi-menu";
import { ComboBoxBuilder, type ActiveComboEdit } from "@/components/combo-box-builder";
import { DragonWarningModal } from "@/components/dragon-warning-modal";
import { OrderTrayDrawer, type OrderLine } from "@/components/order-tray-drawer";

const ADMIN_ROUTE_PATHS = new Set(["/admin", "/staff-portal-ks"]);
const LazyAdminPortal = React.lazy(() => import("@/components/admin-portal"));

function formatWhatsAppHref(rawPhone: string): string {
  const intl = formatWhatsAppInternational(rawPhone);
  return intl ? `https://wa.me/${intl}` : "#";
}

function getSafeExternalUrl(raw?: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? trimmed : null;
  } catch {
    return null;
  }
}

function TikTokIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

const SPEED_OPTIONS = [
  { label: "Slow", value: 16 },
  { label: "Standard", value: 26 },
  { label: "Brisk", value: 42 },
] as const;

function formatInstagramHandle(url: string): string {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").filter(Boolean)[0];
    return segment ? `@${segment}` : "Instagram";
  } catch {
    return "Instagram";
  }
}

const BELT_SHOWCASE_CONFIG: {
  categoryId: string;
  dishId: string;
  image: string;
  tier: 1 | 2 | 3 | 4 | 5;
}[] = [
  {
    categoryId: "kimura-noodles",
    dishId: "noodles-chicken",
    image: "/src/assets/images/cat_noodles_1795001031049.jpg",
    tier: 1,
  },
  {
    categoryId: "raw-special-rolls",
    dishId: "raw-green-dragon",
    image: "/src/assets/images/sushi_dragon_roll_1795000107444.jpg",
    tier: 2,
  },
  {
    categoryId: "raw-special-rolls",
    dishId: "raw-salmon-lava",
    image: "/src/assets/images/raw_salmon_lava_1795699866308.jpg",
    tier: 3,
  },
  {
    categoryId: "fried-special-rolls",
    dishId: "fried-kimura-special",
    image: "/src/assets/images/fried_kimura_special_1795699867236.jpg",
    tier: 2,
  },
  {
    categoryId: "kimura-noodles",
    dishId: "noodles-shrimp",
    image: "/src/assets/images/noodles_shrimp_1795699865212.jpg",
    tier: 4,
  },
  {
    categoryId: "raw-special-rolls",
    dishId: "raw-rainbow-roll",
    image: "/src/assets/images/raw_rainbow_roll_1795699866486.jpg",
    tier: 5,
  },
  {
    categoryId: "fried-special-rolls",
    dishId: "fried-cheese-bomb",
    image: "/src/assets/images/fried_cheese_bomb_1795699867791.jpg",
    tier: 1,
  },
  {
    categoryId: "raw-special-rolls",
    dishId: "raw-crab-volcano",
    image: "/src/assets/images/raw_crab_volcano_1795699866596.jpg",
    tier: 1,
  },
];

export default function App() {
  const currentPath =
    typeof window !== "undefined"
      ? window.location.pathname.replace(/\/+$/, "").toLowerCase()
      : "";
  const isPrivateAdminRoute = ADMIN_ROUTE_PATHS.has(currentPath);

  if (isPrivateAdminRoute) {
    return (
      <React.Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
            Loading...
          </div>
        }
      >
        <LazyAdminPortal />
      </React.Suspense>
    );
  }

  return <PublicStorefront />;
}

function PublicStorefront() {
  const [categories, setCategories] = React.useState<KimuraSushiCategory[]>(
    DEFAULT_KIMURA_CATEGORIES,
  );
  const [offers, setOffers] = React.useState<MenuOffer[]>([]);
  const [settings, setSettings] = React.useState<OrderSettings>(DEFAULT_ORDER_SETTINGS);
  const [businessInfo, setBusinessInfo] = React.useState<BusinessInfo>(DEFAULT_BUSINESS_INFO);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);
  const [comboPageOpen, setComboPageOpen] = React.useState<boolean>(false);
  const [orderLines, setOrderLines] = React.useState<OrderLine[]>([]);
  const [pendingSushi, setPendingSushi] = React.useState<
    Record<
      string,
      {
        dish: KimuraSushiDish;
        categoryId: string;
        categoryName: string;
        variant: MenuDishVariant;
        quantity: number;
      }
    >
  >({});
  const [dragonWarningOpen, setDragonWarningOpen] = React.useState(false);
  const [dragonWarningCount, setDragonWarningCount] = React.useState(0);
  const [trayOpen, setTrayOpen] = React.useState(false);
  const [activeComboEdit, setActiveComboEdit] = React.useState<ActiveComboEdit | null>(null);
  const [justAddedName, setJustAddedName] = React.useState<string | null>(null);
  const [beltSpeed, setBeltSpeed] = React.useState<number>(26);
  const [autoplay, setAutoplay] = React.useState<boolean>(true);
  const [activePlate, setActivePlate] = React.useState<number | null>(null);
  const [darkMode, setDarkMode] = React.useState<boolean>(false);
  const [logoFailed, setLogoFailed] = React.useState<boolean>(false);
  const flashTimer = React.useRef<number>(0);

  React.useEffect(() => {
    setLogoFailed(false);
  }, [businessInfo.logoUrl]);

  React.useEffect(() => {
    return () => window.clearTimeout(flashTimer.current);
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  React.useEffect(() => {
    document.title = businessInfo.slogan
      ? `${businessInfo.businessName} — ${businessInfo.slogan}`
      : `${businessInfo.businessName} — Official Menu & Ordering`;
  }, [businessInfo.businessName, businessInfo.slogan]);

  const refreshMenu = React.useCallback(async () => {
    try {
      const res = await fetch("/api/menu", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        categories?: KimuraSushiCategory[];
        offers?: MenuOffer[];
        settings?: OrderSettings;
        businessInfo?: BusinessInfo;
      };
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        setCategories(data.categories);
      }
      if (Array.isArray(data.offers)) {
        setOffers(data.offers);
      }
      if (data.settings) {
        setSettings(data.settings);
      }
      if (data.businessInfo) {
        setBusinessInfo(data.businessInfo);
      }
    } catch {
      // Keep current rendered menu if offline
    }
  }, []);

  React.useEffect(() => {
    void refreshMenu();
  }, [refreshMenu]);

  React.useEffect(() => {
    if (selectedCategoryId && !categories.some((c) => c.id === selectedCategoryId)) {
      setSelectedCategoryId(null);
    }
  }, [categories, selectedCategoryId]);

  const activeOffers = React.useMemo(
    () => offers.filter((offer) => isOfferCurrentlyActive(offer)),
    [offers],
  );

  const totalItems = React.useMemo(
    () => orderLines.reduce((sum, line) => sum + line.quantity, 0),
    [orderLines],
  );

  const cartIndividualSushiCount = React.useMemo(
    () =>
      orderLines
        .filter((line) => isIndividualSushiCategoryName(line.categoryName, Boolean(line.dish.comboConfig)))
        .reduce((sum, line) => sum + line.quantity, 0),
    [orderLines],
  );

  const pendingSushiEntries = React.useMemo(() => Object.entries(pendingSushi), [pendingSushi]);

  const pendingSushiCount = React.useMemo(
    () => pendingSushiEntries.reduce((sum, [, item]) => sum + item.quantity, 0),
    [pendingSushiEntries],
  );

  const pendingSushiTotalEgp = React.useMemo(
    () =>
      pendingSushiEntries.reduce((sum, [, item]) => {
        const evalRes = getBestOfferForItem({
          dishId: item.dish.id,
          categoryId: item.categoryId,
          isCombo: false,
          basePrice: item.variant.price,
          offers: activeOffers,
        });
        return sum + evalRes.finalPrice * item.quantity;
      }, 0),
    [pendingSushiEntries, activeOffers],
  );

  const totalSushiPiecesCount = cartIndividualSushiCount + pendingSushiCount;

  const showNotice = React.useCallback((message: string) => {
    setJustAddedName(message);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setJustAddedName(null), 2400);
  }, []);

  const handleAddVariantToOrder = React.useCallback(
    (dish: KimuraSushiDish, categoryId: string, categoryName: string, variant: MenuDishVariant) => {
      if (!dish.available || dish.stock <= 0) {
        showNotice(`${dish.name} is currently unavailable`);
        return;
      }

      const currentDishQty = orderLines
        .filter((line) => line.dish.id === dish.id)
        .reduce((sum, line) => sum + line.quantity, 0);
      const pendingDishQty = Object.values(pendingSushi)
        .filter((item) => item.dish.id === dish.id)
        .reduce((sum, item) => sum + item.quantity, 0);

      if (currentDishQty + pendingDishQty >= dish.stock) {
        showNotice(`Only ${dish.stock} left for ${dish.name}`);
        return;
      }

      const offerEval = getBestOfferForItem({
        dishId: dish.id,
        categoryId,
        isCombo: Boolean(dish.comboConfig),
        basePrice: variant.price,
        offers: activeOffers,
      });

      const key = `${dish.id}::${variant.label}`;
      setOrderLines((prev) => {
        const existing = prev.find((line) => line.key === key);
        if (existing) {
          return prev.map((line) =>
            line.key === key ? { ...line, quantity: line.quantity + 1 } : line,
          );
        }
        return [
          ...prev,
          {
            key,
            dish,
            categoryName,
            variantLabel: variant.label,
            unitPrice: offerEval.finalPrice,
            ...(offerEval.discountAmount > 0
              ? {
                  originalUnitPrice: offerEval.originalPrice,
                  appliedOfferTitle: offerEval.offer?.title,
                }
              : {}),
            quantity: 1,
          },
        ];
      });
      const labelNote = variant.label !== "Regular" ? ` (${variant.label})` : "";
      showNotice(`Added ${dish.name}${labelNote}`);
    },
    [orderLines, pendingSushi, activeOffers, showNotice],
  );

  const handleAdjustPendingSushi = React.useCallback(
    (
      dish: KimuraSushiDish,
      categoryId: string,
      categoryName: string,
      variant: MenuDishVariant,
      delta: number,
    ) => {
      if (!dish.available || dish.stock <= 0) {
        showNotice(`${dish.name} is currently unavailable`);
        return;
      }

      const key = `${dish.id}::${variant.label}`;
      const inCartQty = orderLines
        .filter((line) => line.dish.id === dish.id)
        .reduce((sum, line) => sum + line.quantity, 0);

      setPendingSushi((prev) => {
        const existing = prev[key];
        const currentQty = existing?.quantity ?? 0;
        const nextQty = currentQty + delta;

        if (delta > 0 && inCartQty + nextQty > dish.stock) {
          showNotice(`Only ${dish.stock} left for ${dish.name}`);
          return prev;
        }

        if (nextQty <= 0) {
          const rest = { ...prev };
          delete rest[key];
          return rest;
        }

        return {
          ...prev,
          [key]: {
            dish,
            categoryId,
            categoryName,
            variant,
            quantity: nextQty,
          },
        };
      });
    },
    [orderLines, showNotice],
  );

  const handleCommitPendingSushi = React.useCallback(() => {
    const totalAfterAdd = cartIndividualSushiCount + pendingSushiCount;
    if (totalAfterAdd < MINIMUM_SUSHI_PIECES) {
      setDragonWarningCount(totalAfterAdd);
      setDragonWarningOpen(true);
      return;
    }

    if (pendingSushiEntries.length === 0) return;

    setOrderLines((prev) => {
      const next = [...prev];
      for (const [key, item] of pendingSushiEntries) {
        const offerEval = getBestOfferForItem({
          dishId: item.dish.id,
          categoryId: item.categoryId,
          isCombo: false,
          basePrice: item.variant.price,
          offers: activeOffers,
        });
        const idx = next.findIndex((line) => line.key === key);
        if (idx >= 0) {
          next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity };
        } else {
          next.push({
            key,
            dish: item.dish,
            categoryName: item.categoryName,
            variantLabel: item.variant.label,
            unitPrice: offerEval.finalPrice,
            ...(offerEval.discountAmount > 0
              ? {
                  originalUnitPrice: offerEval.originalPrice,
                  appliedOfferTitle: offerEval.offer?.title,
                }
              : {}),
            quantity: item.quantity,
          });
        }
      }
      return next;
    });

    const addedCount = pendingSushiCount;
    setPendingSushi({});
    showNotice(`تمت إضافة ${addedCount} قطعة سوشي للسلة`);
    setTrayOpen(true);
  }, [cartIndividualSushiCount, pendingSushiCount, pendingSushiEntries, activeOffers, showNotice]);

  // Belt showcase items strictly limited to Noodles and Special Sushi Pieces
  const beltItems: ConveyorDish[] = React.useMemo(() => {
    const resolved: ConveyorDish[] = [];
    for (const slot of BELT_SHOWCASE_CONFIG) {
      const cat = categories.find((c) => c.id === slot.categoryId);
      const dish = cat?.dishes.find((d) => d.id === slot.dishId);
      if (cat && dish && dish.available && dish.stock > 0) {
        const basePrice = dish.variants[0]?.price ?? 0;
        const offerEval = getBestOfferForItem({
          dishId: dish.id,
          categoryId: cat.id,
          isCombo: false,
          basePrice,
          offers: activeOffers,
        });
        const details: string[] = [cat.name];
        if (dish.piecesInfo) details.push(dish.piecesInfo);
        if (offerEval.offer) details.push(offerEval.offer.title);
        resolved.push({
          id: dish.id,
          name: dish.name,
          description: dish.description,
          price:
            offerEval.discountAmount > 0
              ? `${offerEval.finalPrice} EGP (was ${offerEval.originalPrice})`
              : `${dish.priceDisplay} EGP`,
          tier: slot.tier,
          image: dish.image || slot.image,
          details,
        });
      }
    }
    if (resolved.length > 0) return resolved;

    const allowedBeltIds = new Set(["kimura-noodles", "raw-special-rolls", "fried-special-rolls"]);
    return categories
      .filter((cat) => allowedBeltIds.has(cat.id))
      .flatMap((cat) =>
        cat.dishes
          .filter((d) => d.available && d.stock > 0)
          .map((dish, idx) => ({
            id: dish.id,
            name: dish.name,
            description: dish.description,
            price: `${dish.priceDisplay} EGP`,
            tier: (((idx % 5) + 1) as 1 | 2 | 3 | 4 | 5),
            image: dish.image || cat.coverImage,
            details: [cat.name, ...(dish.piecesInfo ? [dish.piecesInfo] : [])],
          })),
      )
      .slice(0, 8);
  }, [categories, activeOffers]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleBeltAdd = React.useCallback(
    (beltDish: ConveyorDish) => {
      for (const cat of categories) {
        const match = cat.dishes.find((d) => d.id === beltDish.id);
        if (match) {
          if (match.comboConfig) {
            setSelectedCategoryId(null);
            setComboPageOpen(true);
            setActiveComboEdit({ comboDishId: match.id });
            scrollToSection("menu");
            return;
          }
          const variant = match.variants[0] ?? { label: "Regular", price: 0 };
          if (isIndividualSushiCategory(cat)) {
            if (cartIndividualSushiCount >= MINIMUM_SUSHI_PIECES) {
              handleAddVariantToOrder(match, cat.id, cat.name, variant);
              return;
            }
            const nextCount = totalSushiPiecesCount + 1;
            handleAdjustPendingSushi(match, cat.id, cat.name, variant, 1);
            if (nextCount < MINIMUM_SUSHI_PIECES) {
              showNotice(`تم اختيار ${nextCount} من ${MINIMUM_SUSHI_PIECES} قطع على الأقل`);
              setDragonWarningCount(nextCount);
              setDragonWarningOpen(true);
            } else {
              showNotice(`تم اختيار ${nextCount} قطع — اضغط أضف للسلة`);
            }
            return;
          }
          handleAddVariantToOrder(match, cat.id, cat.name, variant);
          return;
        }
      }
    },
    [
      categories,
      cartIndividualSushiCount,
      totalSushiPiecesCount,
      handleAddVariantToOrder,
      handleAdjustPendingSushi,
      showNotice,
    ],
  );

  const handleCompleteCombo = React.useCallback(
    (payload: {
      comboDish: KimuraSushiDish;
      categoryName: string;
      selectedPieces: SelectedComboPiece[];
      computedPrice: number;
      originalPrice?: number;
      appliedOfferTitle?: string;
      replaceLineKey?: string;
    }) => {
      const {
        comboDish,
        categoryName,
        selectedPieces,
        computedPrice,
        originalPrice,
        appliedOfferTitle,
        replaceLineKey,
      } = payload;
      const variantLabel = `${selectedPieces.length} pcs custom`;

      if (replaceLineKey) {
        setOrderLines((prev) =>
          prev.map((line) =>
            line.key === replaceLineKey
              ? {
                  ...line,
                  variantLabel,
                  unitPrice: computedPrice,
                  originalUnitPrice: originalPrice,
                  appliedOfferTitle,
                  selectedPieces,
                }
              : line,
          ),
        );
        showNotice(`Updated ${comboDish.name}`);
        setTrayOpen(true);
        return;
      }

      const currentDishQty = orderLines
        .filter((line) => line.dish.id === comboDish.id)
        .reduce((sum, line) => sum + line.quantity, 0);

      if (currentDishQty >= comboDish.stock) {
        showNotice(`Only ${comboDish.stock} left for ${comboDish.name}`);
        return;
      }

      const key = `${comboDish.id}::${Date.now()}::${Math.random().toString(36).slice(2, 6)}`;
      setOrderLines((prev) => [
        ...prev,
        {
          key,
          dish: comboDish,
          categoryName,
          variantLabel,
          unitPrice: computedPrice,
          ...(originalPrice ? { originalUnitPrice: originalPrice } : {}),
          ...(appliedOfferTitle ? { appliedOfferTitle } : {}),
          quantity: 1,
          selectedPieces,
        },
      ]);
      showNotice(`Added ${comboDish.name} (${selectedPieces.length} pcs)`);
      setTrayOpen(true);
    },
    [orderLines, showNotice],
  );

  const handleEditComboLine = React.useCallback((line: OrderLine) => {
    setTrayOpen(false);
    setSelectedCategoryId(null);
    setComboPageOpen(true);
    setActiveComboEdit({
      lineKey: line.key,
      comboDishId: line.dish.id,
      initialPieces: line.selectedPieces,
    });
    scrollToSection("menu");
  }, []);

  const handleUpdateQuantity = React.useCallback(
    (lineKey: string, delta: number) => {
      setOrderLines((prev) => {
        const target = prev.find((l) => l.key === lineKey);
        if (!target) return prev;
        if (delta > 0) {
          const liveDish = categories
            .flatMap((c) => c.dishes)
            .find((d) => d.id === target.dish.id);
          const maxStock = liveDish?.stock ?? target.dish.stock;
          const totalForDish = prev
            .filter((l) => l.dish.id === target.dish.id)
            .reduce((s, l) => s + l.quantity, 0);
          if (totalForDish >= maxStock) {
            showNotice(`Only ${maxStock} left for ${target.dish.name}`);
            return prev;
          }
        }
        return prev
          .map((line) =>
            line.key === lineKey ? { ...line, quantity: line.quantity + delta } : line,
          )
          .filter((line) => line.quantity > 0);
      });
    },
    [categories, showNotice],
  );

  const handleRemoveLine = React.useCallback((lineKey: string) => {
    setOrderLines((prev) => prev.filter((line) => line.key !== lineKey));
  }, []);

  const handleClearOrder = React.useCallback(() => {
    setOrderLines([]);
  }, []);

  const openCategoryView = (categoryId: string) => {
    if (categoryId === "combos") {
      setSelectedCategoryId(null);
      setComboPageOpen(true);
      setActiveComboEdit(null);
      scrollToSection("menu");
      return;
    }
    setComboPageOpen(false);
    setActiveComboEdit(null);
    setSelectedCategoryId(categoryId);
    scrollToSection("menu");
  };

  const openOfferTarget = (offer: MenuOffer) => {
    if (offer.targetType === "combo") {
      setSelectedCategoryId(null);
      setComboPageOpen(true);
      setActiveComboEdit(
        offer.targetIds[0] ? { comboDishId: offer.targetIds[0] } : null,
      );
      scrollToSection("menu");
      return;
    }
    if (offer.targetType === "category" && offer.targetIds[0]) {
      openCategoryView(offer.targetIds[0]);
      return;
    }
    const targetDishId = offer.targetIds[0];
    const ownerCat = categories.find((c) => c.dishes.some((d) => d.id === targetDishId));
    if (ownerCat) {
      openCategoryView(ownerCat.id);
    }
  };

  const resetToMainCategories = () => {
    setSelectedCategoryId(null);
    setComboPageOpen(false);
    setActiveComboEdit(null);
  };

  const activeCategory = React.useMemo(
    () => categories.find((cat) => cat.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const topCategories = React.useMemo(() => {
    const comboCat = categories.find((c) => c.id === "combos");
    const noodlesCat = categories.find((c) => c.id === "kimura-noodles");
    return [comboCat, noodlesCat].filter((c): c is KimuraSushiCategory => Boolean(c));
  }, [categories]);

  const specialPieceCategories = React.useMemo(() => {
    const rawSpecial = categories.find((c) => c.id === "raw-special-rolls");
    const friedSpecial = categories.find((c) => c.id === "fried-special-rolls");
    return [rawSpecial, friedSpecial].filter((c): c is KimuraSushiCategory => Boolean(c));
  }, [categories]);

  const extraCategories = React.useMemo(
    () =>
      categories.filter(
        (c) =>
          ![
            "combos",
            "kimura-noodles",
            "raw-special-rolls",
            "fried-special-rolls",
            "old-menu",
          ].includes(c.id),
      ),
    [categories],
  );

  const oldMenuCategory = React.useMemo(
    () => categories.find((c) => c.id === "old-menu") ?? null,
    [categories],
  );

  const totalDishesCount = React.useMemo(
    () => categories.reduce((sum, cat) => sum + cat.dishes.length, 0),
    [categories],
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground transition-colors duration-200">
      {/* Three-zone top navigation bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-6 px-3.5 sm:px-10 py-3 sm:py-4">
          <a
            href="#belt"
            onClick={resetToMainCategories}
            className="flex items-center gap-2 sm:gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
          >
            {!logoFailed && (businessInfo.logoUrl || DEFAULT_BRAND_LOGO) ? (
              <img
                src={businessInfo.logoUrl || DEFAULT_BRAND_LOGO}
                alt={`${businessInfo.businessName} dragon logo`}
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="h-9 w-auto sm:h-12 shrink-0 object-contain select-none transition-[filter,transform] duration-200 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.28)]"
              />
            ) : (
              <img
                src={DEFAULT_BRAND_LOGO}
                alt={`${businessInfo.businessName} dragon logo`}
                className="h-9 w-auto sm:h-12 shrink-0 object-contain select-none drop-shadow-sm"
              />
            )}
            <span className="flex flex-col">
              <span className="font-display text-base sm:text-xl font-medium leading-none tracking-tight text-foreground whitespace-nowrap">
                {businessInfo.businessName}
              </span>
              {businessInfo.slogan && (
                <span className="mt-1 text-[10px] sm:text-[11px] font-medium leading-none text-muted-foreground whitespace-nowrap">
                  {businessInfo.slogan}
                </span>
              )}
            </span>
          </a>

          <nav aria-label="Primary" className="hidden lg:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#belt" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">
              Showcase Belt
            </a>
            <a
              href="#menu"
              onClick={resetToMainCategories}
              className="hover:text-foreground transition-colors whitespace-nowrap shrink-0"
            >
              Menu Categories
            </a>
            <button
              type="button"
              onClick={() => openCategoryView("combos")}
              className="cursor-pointer hover:text-foreground transition-colors whitespace-nowrap shrink-0"
            >
              Combo Selection
            </button>
            <a href="#instagram" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">
              About &amp; Contact
            </a>
            <a href="#locations" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">
              Location
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {getSafeExternalUrl(businessInfo.instagramUrl) && (
              <a
                href={getSafeExternalUrl(businessInfo.instagramUrl)!}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${businessInfo.businessName} on Instagram`}
                title="Instagram"
                className="inline-flex size-9 sm:size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
              >
                <Instagram aria-hidden="true" className="size-4" />
              </a>
            )}
            {getSafeExternalUrl(businessInfo.tiktokUrl) && (
              <a
                href={getSafeExternalUrl(businessInfo.tiktokUrl)!}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${businessInfo.businessName} on TikTok (${formatTikTokHandle(businessInfo.tiktokUrl)})`}
                title={`TikTok ${formatTikTokHandle(businessInfo.tiktokUrl)}`}
                className="inline-flex size-9 sm:size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
              >
                <TikTokIcon className="size-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setTrayOpen(true)}
              aria-label={`Open order tray, ${totalItems} ${totalItems === 1 ? "item" : "items"}`}
              className="inline-flex h-9 sm:h-10 cursor-pointer items-center gap-1.5 sm:gap-2.5 rounded-full bg-foreground px-3 sm:px-4 text-xs sm:text-sm font-medium text-background shadow-sm transition-[translate,box-shadow] hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background whitespace-nowrap shrink-0"
            >
              <ShoppingBag aria-hidden="true" className="size-3.5 sm:size-4" />
              <span className="hidden sm:inline">Order Tray</span>
              <span className="sm:hidden">Tray</span>
              <span className="font-mono text-xs tabular-nums opacity-85">({totalItems})</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Conveyor Belt Showcase — Strictly Noodles & Special Sushi Pieces */}
        <section id="belt" className="border-b border-border">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 pt-5 sm:px-10">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{businessInfo.businessName}</span>
              {businessInfo.slogan && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{businessInfo.slogan}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{categories.length} menu categories</span>
              <span aria-hidden="true">·</span>
              <span>{totalDishesCount} dishes</span>
              {justAddedName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span aria-live="polite" className="font-medium text-foreground">
                    {justAddedName}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Belt speed"
                className="inline-flex items-center rounded-lg border border-border bg-card p-1"
              >
                {SPEED_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setBeltSpeed(option.value)}
                    className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      beltSpeed === option.value
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                aria-pressed={autoplay}
                onClick={() => setAutoplay((prev) => !prev)}
                className={`cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  autoplay
                    ? "bg-card text-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Spotlight: {autoplay ? "On" : "Off"}
              </button>

              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                aria-label={darkMode ? "Switch to light surface" : "Switch to dark surface"}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {darkMode ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              </button>
            </div>
          </div>

          <SushiConveyorMenu
            items={beltItems}
            legend={{}}
            eyebrow={
              businessInfo.slogan
                ? `${businessInfo.businessName} · ${businessInfo.slogan}`
                : `${businessInfo.businessName} · Signature Selection`
            }
            heading="Special sushi pieces & signature noodles."
            caption="Hover to pause a dish, flick to spin the lane, or pick a plate to inspect and order."
            speed={beltSpeed}
            autoplay={autoplay}
            active={activePlate}
            onActiveChange={setActivePlate}
            onAdd={handleBeltAdd}
            action={
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetToMainCategories();
                    scrollToSection("menu");
                  }}
                  className="inline-flex cursor-pointer items-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-sm outline-none transition-[translate,box-shadow] hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none whitespace-nowrap shrink-0"
                >
                  Browse menu categories
                </button>
                <button
                  type="button"
                  onClick={() => setTrayOpen(true)}
                  className="inline-flex cursor-pointer items-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap shrink-0"
                >
                  View order ({totalItems})
                </button>
              </div>
            }
          />
        </section>

        {/* Active Offers & Discounts Banner (Live Synced from Admin Dashboard) */}
        {activeOffers.length > 0 && !comboPageOpen && !activeCategory && (
          <section className="border-b border-border bg-secondary/25">
            <div className="mx-auto max-w-7xl px-6 py-10 sm:px-10">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium tracking-[0.2em] uppercase text-destructive">
                    Limited-Time Offers · عروض وخصومات
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-medium tracking-tight sm:text-3xl">
                    Active Discounts
                  </h2>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 auto-rows-fr gap-3 sm:gap-5 lg:grid-cols-3">
                {activeOffers.map((offer) => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => openOfferTarget(offer)}
                    className="flex h-full cursor-pointer flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md sm:p-5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-destructive">
                          <Tag className="size-3.5" />
                          {offer.discountType === "percentage"
                            ? `${offer.discountValue}% OFF`
                            : `-${offer.discountValue} EGP`}
                        </span>
                        {offer.expiresAt && (
                          <span className="text-[11px] text-muted-foreground">
                            Ends {new Date(offer.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-base font-medium text-foreground sm:text-lg">
                        {offer.title}
                      </h3>
                      {offer.description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {offer.description}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                      <span>View offer items</span>
                      <ChevronRight className="size-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Main Categories Overview OR Dedicated Single-Category View */}
        <section id="menu" className="mx-auto max-w-7xl px-4 py-14 sm:px-10 lg:py-20">
          {!settings.orderingEnabled && (
            <div className="mb-8 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{settings.closedMessage}</span>
            </div>
          )}

          {comboPageOpen && !activeCategory ? (
            <ComboBoxBuilder
              categories={categories}
              offers={activeOffers}
              businessName={businessInfo.businessName}
              orderingEnabled={settings.orderingEnabled}
              activeSelection={activeComboEdit}
              onSelectCombo={setActiveComboEdit}
              onBackToMenu={() => {
                resetToMainCategories();
                scrollToSection("menu");
              }}
              onCompleteCombo={handleCompleteCombo}
            />
          ) : !activeCategory ? (
            <>
              <div className="flex flex-col justify-between gap-4 border-b border-border pb-8 md:flex-row md:items-end">
                <div className="max-w-2xl">
                  <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
                    {businessInfo.businessName} Menu
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                    Combo Selection, Noodles, Special Pieces &amp; Old Menu
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Customize a Combo Box piece by piece, browse KIMURA NOODLES, or explore Special Pieces and the Old Menu below.
                  </p>
                </div>
              </div>

              {/* First Section: Combo Selection & KIMURA NOODLES side by side on mobile & desktop */}
              <div className="mt-8 grid grid-cols-2 auto-rows-fr gap-3 sm:mt-10 sm:gap-6">
                {topCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => openCategoryView(cat.id)}
                    className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card text-center transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-left"
                  >
                    <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full shrink-0 overflow-hidden bg-secondary/40">
                      <img
                        src={cat.coverImage}
                        alt={cat.name}
                        referrerPolicy="no-referrer"
                        className="size-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    </div>
                    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
                      <div className="min-w-0 w-full sm:w-auto">
                        <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
                          {cat.id === "combos"
                            ? `${cat.dishes.length} boxes`
                            : `${cat.dishes.length} ${cat.dishes.length === 1 ? "dish" : "dishes"}`}
                          {cat.subtitle ? ` · ${cat.subtitle}` : ""}
                        </p>
                        <h3 className="mt-1 font-display text-base leading-snug font-medium tracking-tight text-foreground sm:text-2xl">
                          {cat.name}
                        </h3>
                      </div>
                      <span className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:bg-foreground group-hover:text-background sm:inline-flex">
                        <ChevronRight className="size-4" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Dedicated Special Pieces Group: Raw Special Rolls & Fried Special Rolls */}
              {specialPieceCategories.length > 0 && (
                <div className="mt-12 border-t border-border pt-10">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
                        Signature Rolls · الأصناف المميزة
                      </p>
                      <h3 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
                        Special Pieces
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Raw Special Rolls &amp; Fried Special Rolls
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-2 auto-rows-fr gap-3 sm:gap-6">
                    {specialPieceCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => openCategoryView(cat.id)}
                        className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card text-center transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-left"
                      >
                        <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full shrink-0 overflow-hidden bg-secondary/40">
                          <img
                            src={cat.coverImage}
                            alt={cat.name}
                            referrerPolicy="no-referrer"
                            className="size-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        </div>
                        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
                          <div className="min-w-0 w-full sm:w-auto">
                            <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
                              {cat.dishes.length} {cat.dishes.length === 1 ? "piece" : "pieces"}
                              {cat.subtitle ? ` · ${cat.subtitle}` : ""}
                            </p>
                            <h4 className="mt-1 font-display text-base leading-snug font-medium tracking-tight text-foreground sm:text-xl">
                              {cat.name}
                            </h4>
                          </div>
                          <span className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:bg-foreground group-hover:text-background sm:inline-flex">
                            <ChevronRight className="size-4" />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Any Additional Admin-Created Categories */}
              {extraCategories.length > 0 && (
                <div className="mt-12 border-t border-border pt-10">
                  <div className="grid grid-cols-2 auto-rows-fr gap-3 sm:gap-6 lg:grid-cols-3">
                    {extraCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => openCategoryView(cat.id)}
                        className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card text-center transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-left"
                      >
                        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-secondary/40">
                          <img
                            src={cat.coverImage}
                            alt={cat.name}
                            referrerPolicy="no-referrer"
                            className="size-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        </div>
                        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
                          <div className="min-w-0 w-full sm:w-auto">
                            <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
                              {cat.dishes.length} {cat.dishes.length === 1 ? "dish" : "dishes"}
                              {cat.subtitle ? ` · ${cat.subtitle}` : ""}
                            </p>
                            <h4 className="mt-1 font-display text-base leading-snug font-medium tracking-tight text-foreground sm:text-xl">
                              {cat.name}
                            </h4>
                          </div>
                          <span className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:bg-foreground group-hover:text-background sm:inline-flex">
                            <ChevronRight className="size-4" />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dedicated Old Menu Cover Card */}
              {oldMenuCategory && (
                <div className="mt-12 border-t border-border pt-10">
                  <button
                    type="button"
                    onClick={() => openCategoryView(oldMenuCategory.id)}
                    aria-label={`Open ${oldMenuCategory.name} — ${oldMenuCategory.dishes.length} original pieces`}
                    className="group relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-stone-950 text-left shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full overflow-hidden">
                      <img
                        src={oldMenuCategory.coverImage}
                        alt={oldMenuCategory.name}
                        referrerPolicy="no-referrer"
                        className="size-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/15"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-end sm:p-8">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-stone-300 sm:text-xs">
                            Raw Rolls &amp; Fried Rolls
                          </p>
                          <div className="mt-1 flex flex-wrap items-baseline gap-3">
                            <h3 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                              {oldMenuCategory.name}
                            </h3>
                            <span
                              dir="rtl"
                              className="text-sm font-medium text-stone-200 sm:text-base"
                            >
                              اختيار حر
                            </span>
                          </div>
                        </div>
                        <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-stone-950 shadow-sm transition-transform duration-200 group-hover:translate-x-0.5 sm:px-5 sm:py-2.5 sm:text-sm">
                          <span>View Old Menu</span>
                          <ChevronRight className="size-4" />
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              )}

            </>
          ) : activeCategory ? (
            <div>
              {/* Navigation back to main categories & switcher between categories */}
              <div className="border-b border-border pb-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={resetToMainCategories}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowLeft className="size-4" />
                    All Categories
                  </button>
                </div>

                <div className="mt-5 flex gap-2 overflow-x-auto pb-2" role="navigation" aria-label="Switch category">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => openCategoryView(cat.id)}
                      className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        cat.id === activeCategory.id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
                      {businessInfo.businessName} · Category
                    </p>
                    <h2 className="mt-1.5 font-display text-3xl font-medium tracking-tight sm:text-4xl">
                      {activeCategory.name}
                    </h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {activeCategory.dishes.length}{" "}
                      {activeCategory.dishes.length === 1 ? "dish" : "dishes"}
                      {activeCategory.subtitle ? ` · ${activeCategory.subtitle}` : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dishes: 2-Column Equal-Size Card Grid on Mobile; Clean Horizontal List on Desktop */}
              {activeCategory.dishes.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-muted-foreground">
                    No dishes currently listed in {activeCategory.name}.
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-2 auto-rows-fr gap-3 sm:gap-4 md:mt-0 md:grid-cols-1 md:gap-0 md:divide-y md:divide-border">
                  {activeCategory.dishes.map((dish) => {
                    const isAvailable = dish.available && dish.stock > 0;
                    const isSushiCategory = isIndividualSushiCategory(activeCategory);
                    const baseFirstPrice = dish.variants[0]?.price ?? 0;
                    const firstOfferEval = getBestOfferForItem({
                      dishId: dish.id,
                      categoryId: activeCategory.id,
                      isCombo: false,
                      basePrice: baseFirstPrice,
                      offers: activeOffers,
                    });
                    const dishImage = dish.image || activeCategory.coverImage;

                    return (
                      <article
                        key={dish.id}
                        className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card md:h-auto md:flex-row md:items-center md:justify-between md:gap-6 md:rounded-none md:border-0 md:bg-transparent md:py-5"
                      >
                        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-secondary/40 md:size-20 md:rounded-xl">
                          <img
                            src={dishImage}
                            alt={dish.name}
                            referrerPolicy="no-referrer"
                            className="size-full object-cover object-center"
                          />
                          {firstOfferEval.offer && firstOfferEval.discountAmount > 0 && (
                            <span className="absolute top-2 left-2 rounded-md bg-destructive px-2 py-0.5 font-mono text-[10px] font-semibold text-white md:hidden">
                              {firstOfferEval.offer.discountType === "percentage"
                                ? `-${firstOfferEval.offer.discountValue}%`
                                : `-${firstOfferEval.offer.discountValue} EGP`}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col justify-between gap-2.5 p-3 md:flex-row md:items-center md:gap-8 md:p-0 min-w-0">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                              <h3 className="line-clamp-2 font-display text-sm font-medium leading-snug tracking-tight text-foreground sm:text-base md:text-xl">
                                {dish.name}
                              </h3>
                              {dish.piecesInfo && (
                                <span className="text-[11px] font-medium text-muted-foreground md:text-xs">
                                  {dish.piecesInfo}
                                </span>
                              )}
                              {firstOfferEval.offer && firstOfferEval.discountAmount > 0 && (
                                <span className="hidden md:inline-block font-mono text-xs font-semibold text-destructive">
                                  {firstOfferEval.offer.title}
                                </span>
                              )}
                              {!isAvailable && (
                                <span className="text-[11px] font-medium text-destructive md:text-xs">
                                  Unavailable
                                </span>
                              )}
                            </div>
                            {dish.description && (
                              <p className="line-clamp-2 max-w-2xl text-[11px] leading-relaxed text-muted-foreground md:text-sm">
                                {dish.description}
                              </p>
                            )}
                          </div>

                          <div className="mt-auto flex flex-col gap-2 border-t border-border pt-2.5 md:mt-0 md:flex-row md:items-center md:justify-end md:gap-4 md:border-t-0 md:pt-0 shrink-0">
                            <div className="flex items-baseline justify-between gap-2 md:justify-end">
                              {firstOfferEval.discountAmount > 0 && (
                                <span className="font-mono text-xs line-through tabular-nums text-muted-foreground">
                                  {firstOfferEval.originalPrice}
                                </span>
                              )}
                              <p className="font-mono text-sm font-semibold tabular-nums text-foreground md:text-lg">
                                {firstOfferEval.discountAmount > 0
                                  ? firstOfferEval.finalPrice
                                  : dish.priceDisplay}{" "}
                                <span className="text-[10px] font-normal text-muted-foreground md:text-xs">
                                  EGP
                                </span>
                              </p>
                            </div>

                            <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-2">
                              {isAvailable ? (
                                isSushiCategory ? (
                                  (() => {
                                    const variant = dish.variants[0] ?? { label: "Regular", price: 0 };
                                    const key = `${dish.id}::${variant.label}`;
                                    const selectedQty = pendingSushi[key]?.quantity ?? 0;

                                    return selectedQty > 0 ? (
                                      <div className="inline-flex w-full items-center justify-between gap-1 rounded-full border border-foreground bg-card p-1 md:w-auto">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleAdjustPendingSushi(
                                              dish,
                                              activeCategory.id,
                                              activeCategory.name,
                                              variant,
                                              -1,
                                            )
                                          }
                                          aria-label={`تقليل ${dish.name}`}
                                          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
                                        >
                                          <Minus className="size-3.5" />
                                        </button>
                                        <span className="min-w-[1.5rem] text-center font-mono text-xs font-semibold tabular-nums text-foreground">
                                          {selectedQty}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleAdjustPendingSushi(
                                              dish,
                                              activeCategory.id,
                                              activeCategory.name,
                                              variant,
                                              1,
                                            )
                                          }
                                          aria-label={`زيادة ${dish.name}`}
                                          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90"
                                        >
                                          <Plus className="size-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        dir="rtl"
                                        onClick={() =>
                                          handleAdjustPendingSushi(
                                            dish,
                                            activeCategory.id,
                                            activeCategory.name,
                                            variant,
                                            1,
                                          )
                                        }
                                        className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap md:w-auto md:px-4"
                                      >
                                        <Plus className="size-3.5" />
                                        <span>اختار قطعة</span>
                                      </button>
                                    );
                                  })()
                                ) : (
                                  dish.variants.map((variant) => {
                                    const varOffer = getBestOfferForItem({
                                      dishId: dish.id,
                                      categoryId: activeCategory.id,
                                      isCombo: false,
                                      basePrice: variant.price,
                                      offers: activeOffers,
                                    });
                                    return (
                                      <button
                                        key={variant.label}
                                        type="button"
                                        onClick={() =>
                                          handleAddVariantToOrder(
                                            dish,
                                            activeCategory.id,
                                            activeCategory.name,
                                            variant,
                                          )
                                        }
                                        className="inline-flex min-h-[38px] w-full cursor-pointer items-center justify-center gap-1 rounded-full bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-auto md:px-4 md:py-2 md:text-xs"
                                      >
                                        <Plus className="size-3 shrink-0" />
                                        <span className="truncate">
                                          {dish.variants.length > 1
                                            ? `${variant.label.split("–")[0].trim()} · ${varOffer.finalPrice}`
                                            : "Add to order"}
                                        </span>
                                      </button>
                                    );
                                  })
                                )
                              ) : (
                                <span className="inline-flex min-h-[38px] w-full items-center justify-center rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground md:w-auto md:px-4">
                                  Unavailable
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* Minimum 6-Piece Selection Action Bar inside Individual Sushi Categories */}
              {isIndividualSushiCategory(activeCategory) && (
                <div
                  dir="rtl"
                  className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-secondary/40 p-5 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1 text-right">
                    <p className="text-sm font-semibold text-foreground">
                      القطع المختارة: {totalSushiPiecesCount} / {MINIMUM_SUSHI_PIECES} قطع على الأقل
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {totalSushiPiecesCount < MINIMUM_SUSHI_PIECES
                        ? `متبقي ${MINIMUM_SUSHI_PIECES - totalSushiPiecesCount} قطعة للتمكن من الإضافة للسلة (تقدر تجمع من أي قسم سوشي).`
                        : `الاختيار جاهز للإضافة للسلة · إجمالي المختار حالياً: ${pendingSushiTotalEgp.toLocaleString()} EGP`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCommitPendingSushi}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
                  >
                    <ShoppingBag className="size-4" />
                    <span>
                      {pendingSushiCount > 0
                        ? `أضف للسلة (${pendingSushiCount} قطعة)`
                        : "أضف للسلة"}
                    </span>
                  </button>
                </div>
              )}

              {/* Quick Bottom Switcher */}
              <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
                <button
                  type="button"
                  onClick={() => {
                    resetToMainCategories();
                    scrollToSection("menu");
                  }}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <ArrowLeft className="size-4" />
                  Back to all categories
                </button>

                <button
                  type="button"
                  onClick={() => setTrayOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  <ShoppingBag className="size-4" />
                  View order tray ({totalItems})
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Dedicated Brand, Instagram, Contact & Location Section */}
        <section id="instagram" className="border-t border-border bg-secondary/30">
          <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:py-20">
            <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
              <div className="space-y-4">
                <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
                  About &amp; Connect
                </p>
                <h2 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                  {businessInfo.businessName}
                </h2>
                {businessInfo.slogan && (
                  <p className="text-base font-medium text-foreground">
                    {businessInfo.slogan}
                  </p>
                )}
                {businessInfo.instagramHandle && (
                  <p className="font-mono text-sm font-medium text-muted-foreground">
                    {businessInfo.instagramHandle}
                  </p>
                )}
                {businessInfo.aboutUs && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {businessInfo.aboutUs}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {getSafeExternalUrl(businessInfo.instagramUrl) && (
                    <a
                      href={getSafeExternalUrl(businessInfo.instagramUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background shadow-sm transition-[translate,box-shadow] hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 whitespace-nowrap"
                    >
                      <Instagram aria-hidden="true" className="size-4" />
                      <span>
                        {businessInfo.instagramHandle || businessInfo.businessName}
                      </span>
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </a>
                  )}
                  {getSafeExternalUrl(businessInfo.tiktokUrl) && (
                    <a
                      href={getSafeExternalUrl(businessInfo.tiktokUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
                    >
                      <TikTokIcon className="size-4" />
                      <span>Follow on TikTok · {formatTikTokHandle(businessInfo.tiktokUrl)}</span>
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </a>
                  )}
                  {(businessInfo.whatsapp || businessInfo.phone) && (
                    <a
                      href={formatWhatsAppHref(businessInfo.whatsapp || businessInfo.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary whitespace-nowrap"
                    >
                      <MessageCircle aria-hidden="true" className="size-4" />
                      <span>WhatsApp</span>
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </a>
                  )}
                  {getSafeExternalUrl(businessInfo.facebookUrl) && (
                    <a
                      href={getSafeExternalUrl(businessInfo.facebookUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      <span>Facebook</span>
                      <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </a>
                  )}
                </div>

                {(businessInfo.email ||
                  businessInfo.businessHours ||
                  businessInfo.deliveryInfo) && (
                  <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                    {businessInfo.email && (
                      <p className="flex items-center gap-2">
                        <Mail aria-hidden="true" className="size-3.5 shrink-0" />
                        <a
                          href={`mailto:${businessInfo.email}`}
                          className="text-foreground hover:underline"
                        >
                          {businessInfo.email}
                        </a>
                      </p>
                    )}
                    {businessInfo.businessHours && (
                      <p className="flex items-center gap-2">
                        <Clock aria-hidden="true" className="size-3.5 shrink-0" />
                        <span>{businessInfo.businessHours}</span>
                      </p>
                    )}
                    {businessInfo.deliveryInfo && (
                      <p className="flex items-center gap-2">
                        <Truck aria-hidden="true" className="size-3.5 shrink-0" />
                        <span>{businessInfo.deliveryInfo}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div id="locations" className="space-y-5">
                <div>
                  <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
                    Contact Us &amp; Location
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground">
                    Visit {businessInfo.businessName}
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {businessInfo.branches.map((loc) => {
                    const branchPhone = loc.phone || businessInfo.phone;
                    const branchWhatsapp = loc.whatsapp || businessInfo.whatsapp;
                    return (
                      <div
                        key={loc.id}
                        className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-card p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="space-y-2.5">
                          <p className="text-xs font-medium tracking-[0.18em] uppercase text-muted-foreground">
                            {businessInfo.businessName}
                          </p>
                          <div className="flex items-start gap-2.5">
                            <MapPin aria-hidden="true" className="mt-1 size-4.5 shrink-0 text-foreground" />
                            <div>
                              <p className="font-display text-xl font-medium tracking-tight text-foreground">
                                {loc.name}
                              </p>
                              {loc.address && (
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                  {loc.address}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {(branchPhone ||
                          branchWhatsapp ||
                          getSafeExternalUrl(loc.mapsUrl) ||
                          getSafeExternalUrl(businessInfo.instagramUrl)) && (
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-4">
                            {branchPhone && (
                              <a
                                href={`tel:${branchPhone}`}
                                className="inline-flex items-center gap-2 font-mono text-sm font-medium tabular-nums text-foreground transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                              >
                                <Phone aria-hidden="true" className="size-4 text-muted-foreground" />
                                <span>{branchPhone}</span>
                              </a>
                            )}
                            {branchWhatsapp && (
                              <a
                                href={formatWhatsAppHref(branchWhatsapp)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <MessageCircle aria-hidden="true" className="size-3.5" />
                                <span>WhatsApp: {branchWhatsapp}</span>
                              </a>
                            )}
                            {getSafeExternalUrl(loc.mapsUrl) && (
                              <a
                                href={getSafeExternalUrl(loc.mapsUrl)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground transition-colors hover:underline"
                              >
                                <MapPin aria-hidden="true" className="size-3.5" />
                                <span>Google Maps</span>
                                <ArrowUpRight aria-hidden="true" className="size-3" />
                              </a>
                            )}
                            {getSafeExternalUrl(businessInfo.instagramUrl) && (
                              <a
                                href={getSafeExternalUrl(businessInfo.instagramUrl)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <Instagram aria-hidden="true" className="size-3.5" />
                                <span>{businessInfo.instagramHandle || "Instagram"}</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Chef Attribution Section */}
        {businessInfo.chefName && (
          <section id="chef" className="border-t border-border bg-background">
            <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-12 sm:flex-row sm:items-center sm:px-10">
              <div className="flex items-center gap-5">
                {businessInfo.chefPhotoUrl ? (
                  <img
                    src={businessInfo.chefPhotoUrl}
                    alt={`Chef ${businessInfo.chefName}`}
                    referrerPolicy="no-referrer"
                    className="size-16 shrink-0 rounded-full border border-border object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground"
                  >
                    <ChefHat className="size-5" />
                  </span>
                )}
                <div>
                  <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
                    Created by
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
                    Chef {businessInfo.chefName}
                  </h2>
                </div>
              </div>

              {getSafeExternalUrl(businessInfo.chefInstagramUrl) && (
                <a
                  href={getSafeExternalUrl(businessInfo.chefInstagramUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-[translate,box-shadow,background-color] hover:-translate-y-px hover:bg-secondary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
                >
                  <Instagram aria-hidden="true" className="size-4" />
                  <span>{formatInstagramHandle(businessInfo.chefInstagramUrl)}</span>
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </a>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="font-display text-sm font-medium text-foreground">
              {businessInfo.businessName}
            </p>
            {businessInfo.slogan && (
              <>
                <span aria-hidden="true">·</span>
                <span>{businessInfo.slogan}</span>
              </>
            )}
            {businessInfo.branches.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>{businessInfo.branches.map((b) => b.name).join(" · ")}</span>
                </span>
              </>
            )}
            {businessInfo.phone && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={`tel:${businessInfo.phone}`}
                  className="inline-flex items-center gap-1.5 font-mono tabular-nums text-foreground hover:underline"
                >
                  <Phone aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>{businessInfo.phone}</span>
                </a>
              </>
            )}
            {businessInfo.chefName && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Created by Chef{" "}
                  {getSafeExternalUrl(businessInfo.chefInstagramUrl) ? (
                    <a
                      href={getSafeExternalUrl(businessInfo.chefInstagramUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground hover:underline"
                    >
                      {businessInfo.chefName}
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">{businessInfo.chefName}</span>
                  )}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <a href="#belt" className="hover:text-foreground transition-colors">
              Showcase Belt
            </a>
            <a
              href="#menu"
              onClick={resetToMainCategories}
              className="hover:text-foreground transition-colors"
            >
              Categories
            </a>
            <button
              type="button"
              onClick={() => openCategoryView("combos")}
              className="cursor-pointer hover:text-foreground transition-colors"
            >
              Combo Selection
            </button>
            <a href="#locations" className="hover:text-foreground transition-colors">
              Location
            </a>
            {getSafeExternalUrl(businessInfo.instagramUrl) && (
              <a
                href={getSafeExternalUrl(businessInfo.instagramUrl)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Instagram aria-hidden="true" className="size-3.5" />
                <span>{businessInfo.instagramHandle || "Instagram"}</span>
              </a>
            )}
            {getSafeExternalUrl(businessInfo.tiktokUrl) && (
              <a
                href={getSafeExternalUrl(businessInfo.tiktokUrl)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <TikTokIcon className="size-3.5" />
                <span>TikTok ({formatTikTokHandle(businessInfo.tiktokUrl)})</span>
              </a>
            )}
            <span className="tabular-nums">© 2026 {businessInfo.businessName}</span>
          </div>
        </div>
      </footer>

      {pendingSushiCount > 0 && !trayOpen && (
        <div
          dir="rtl"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 text-card-foreground shadow-2xl backdrop-blur-md sm:inset-x-6"
        >
          <div className="min-w-0 text-right">
            <p className="text-xs sm:text-sm font-semibold text-foreground">
              القطع المختارة: {totalSushiPiecesCount} / {MINIMUM_SUSHI_PIECES} قطع على الأقل
            </p>
            <p className="text-[11px] text-muted-foreground">
              {totalSushiPiecesCount < MINIMUM_SUSHI_PIECES
                ? `اختار ${MINIMUM_SUSHI_PIECES - totalSushiPiecesCount} قطعة كمان للإضافة للسلة`
                : `جاهز للإضافة · ${pendingSushiTotalEgp.toLocaleString()} EGP`}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCommitPendingSushi}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs sm:text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="size-3.5" />
            <span>أضف للسلة ({pendingSushiCount})</span>
          </button>
        </div>
      )}

      <OrderTrayDrawer
        open={trayOpen}
        onClose={() => setTrayOpen(false)}
        lines={orderLines}
        settings={settings}
        businessInfo={businessInfo}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveLine={handleRemoveLine}
        onEditComboLine={handleEditComboLine}
        onClearOrder={handleClearOrder}
        onOrderSuccess={refreshMenu}
        onMinimumSushiBlocked={(count) => {
          setDragonWarningCount(count);
          setDragonWarningOpen(true);
        }}
      />

      <DragonWarningModal
        open={dragonWarningOpen}
        currentCount={dragonWarningCount}
        logoUrl={businessInfo.logoUrl}
        onClose={() => setDragonWarningOpen(false)}
      />
    </div>
  );
}
