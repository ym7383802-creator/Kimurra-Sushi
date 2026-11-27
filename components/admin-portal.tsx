"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  ImagePlus,
  Lock,
  LogOut,
  MessageCircle,
  Minus,
  PackageCheck,
  Percent,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Upload,
  UtensilsCrossed,
  X,
  XCircle,
} from "lucide-react";
import {
  DEFAULT_BRAND_LOGO,
  DEFAULT_BUSINESS_INFO,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  buildWhatsAppOrderUrl,
  isOfferCurrentlyActive,
  type BusinessBranch,
  type BusinessInfo,
  type ComboBoxConfig,
  type CustomerOrder,
  type MenuOffer,
  type OfferDiscountType,
  type OfferTargetType,
  type OrderSettings,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type KimuraSushiCategory,
  type KimuraSushiDish,
} from "@/lib/kimura-sushi-menu";
import type { StorageDiagnostics } from "@/lib/store-adapter";

type AdminTab = "orders" | "menu" | "offers" | "business" | "settings";
type PaymentFilter = "all" | "pending_verification" | PaymentMethod;

const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoStringSafe(localValue: string): string {
  const trimmed = localValue.trim();
  if (!trimmed) return "";
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function getOfferStatusBadge(offer: MenuOffer): {
  label: "Active" | "Scheduled" | "Expired" | "Paused";
  className: string;
} {
  if (!offer.active) {
    return {
      label: "Paused",
      className: "border-border bg-secondary text-muted-foreground",
    };
  }
  const nowMs = Date.now();
  const startMs = offer.startsAt ? Date.parse(offer.startsAt) : Number.NEGATIVE_INFINITY;
  const endMs = offer.expiresAt ? Date.parse(offer.expiresAt) : Number.POSITIVE_INFINITY;
  if (Number.isFinite(startMs) && nowMs < startMs) {
    return {
      label: "Scheduled",
      className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    };
  }
  if (Number.isFinite(endMs) && nowMs > endMs) {
    return {
      label: "Expired",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
    };
  }
  return {
    label: "Active",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  };
}

export default function AdminPortal() {
  const [authLoading, setAuthLoading] = React.useState(true);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [setupRequired, setSetupRequired] = React.useState(false);
  const [envManagedPassword, setEnvManagedPassword] = React.useState(false);
  const [adminUsername, setAdminUsername] = React.useState<string>("");
  const [inactivityTimeoutMs, setInactivityTimeoutMs] = React.useState(15 * 60 * 1000);
  const [authError, setAuthError] = React.useState<string | null>(null);

  const [usernameInput, setUsernameInput] = React.useState("");
  const [passwordInput, setPasswordInput] = React.useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = React.useState("");
  const [authSubmitting, setAuthSubmitting] = React.useState(false);

  const [activeTab, setActiveTab] = React.useState<AdminTab>("orders");
  const [categories, setCategories] = React.useState<KimuraSushiCategory[]>([]);
  const [offers, setOffers] = React.useState<MenuOffer[]>([]);
  const [orders, setOrders] = React.useState<CustomerOrder[]>([]);
  const [settings, setSettings] = React.useState<OrderSettings | null>(null);
  const [businessInfo, setBusinessInfo] = React.useState<BusinessInfo>(DEFAULT_BUSINESS_INFO);
  const [businessDraft, setBusinessDraft] = React.useState<BusinessInfo>(DEFAULT_BUSINESS_INFO);
  const [storageDiagnostics, setStorageDiagnostics] = React.useState<StorageDiagnostics | null>(null);

  const [savingBusiness, setSavingBusiness] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [uploadingMediaId, setUploadingMediaId] = React.useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = React.useState<string>("");

  const [orderFilter, setOrderFilter] = React.useState<OrderStatus | "all">("all");
  const [paymentFilter, setPaymentFilter] = React.useState<PaymentFilter>("all");
  const [orderSearch, setOrderSearch] = React.useState("");
  const [screenshotModalUrl, setScreenshotModalUrl] = React.useState<string | null>(null);

  const [toastMsg, setToastMsg] = React.useState<string | null>(null);

  // Offer creation form state
  const [offerTitle, setOfferTitle] = React.useState("");
  const [offerDescription, setOfferDescription] = React.useState("");
  const [offerDiscountType, setOfferDiscountType] = React.useState<OfferDiscountType>("percentage");
  const [offerDiscountValue, setOfferDiscountValue] = React.useState("15");
  const [offerTargetType, setOfferTargetType] = React.useState<OfferTargetType>("category");
  const [offerTargetIds, setOfferTargetIds] = React.useState<string[]>([]);
  const [offerStartsAt, setOfferStartsAt] = React.useState("");
  const [offerExpiresAt, setOfferExpiresAt] = React.useState("");
  const [offerActive, setOfferActive] = React.useState(true);
  const [creatingOffer, setCreatingOffer] = React.useState(false);

  // Security update form state
  const [newUsernameInput, setNewUsernameInput] = React.useState("");
  const [currentPwd, setCurrentPwd] = React.useState("");
  const [newPwd, setNewPwd] = React.useState("");
  const [pwdMsg, setPwdMsg] = React.useState<string | null>(null);

  const inactivityTimerRef = React.useRef<number>(0);
  const lastPingRef = React.useRef<number>(0);
  const toastTimerRef = React.useRef<number>(0);
  const logoFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const showToast = React.useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  React.useEffect(() => {
    return () => window.clearTimeout(toastTimerRef.current);
  }, []);

  const handleUnauthorized = React.useCallback((reason?: string) => {
    setAuthenticated(false);
    setOrders([]);
    setCategories([]);
    setOffers([]);
    setSettings(null);
    setAuthError(reason || "Session expired. Please log in again.");
  }, []);

  const adminFetch = React.useCallback(
    async (url: string, init: RequestInit = {}) => {
      const res = await fetch(url, {
        ...init,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(init.headers || {}),
        },
      });
      if (res.status === 401) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        handleUnauthorized(data.error);
        return null;
      }
      return res;
    },
    [handleUnauthorized],
  );

  const loadDashboard = React.useCallback(async () => {
    const res = await fetch("/api/admin/dashboard", {
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    if (res.status === 401) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      handleUnauthorized(data.error);
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as {
      categories: KimuraSushiCategory[];
      offers?: MenuOffer[];
      orders: CustomerOrder[];
      settings: OrderSettings;
      businessInfo?: BusinessInfo;
      adminUsername?: string;
      storageDiagnostics?: StorageDiagnostics;
    };
    setCategories(data.categories);
    setOffers(Array.isArray(data.offers) ? data.offers : []);
    setOrders(data.orders);
    setSettings(data.settings);
    if (data.adminUsername) {
      setAdminUsername(data.adminUsername);
    }
    if (data.storageDiagnostics) {
      setStorageDiagnostics(data.storageDiagnostics);
    }
    if (data.businessInfo) {
      setBusinessInfo(data.businessInfo);
      setBusinessDraft(data.businessInfo);
    }
    setSelectedCatId((prev) =>
      prev && data.categories.some((c) => c.id === prev) ? prev : (data.categories[0]?.id ?? ""),
    );
  }, [handleUnauthorized]);

  const checkAuthStatus = React.useCallback(async () => {
    setAuthLoading(true);
    try {
      const res = await fetch("/api/admin/auth/status", { credentials: "same-origin" });
      const data = (await res.json()) as {
        authenticated: boolean;
        setupRequired: boolean;
        timedOut?: boolean;
        inactivityTimeoutMs?: number;
        envManagedPassword?: boolean;
        adminUsername?: string;
      };
      setSetupRequired(data.setupRequired);
      setAuthenticated(data.authenticated);
      setEnvManagedPassword(Boolean(data.envManagedPassword));
      if (data.adminUsername) setAdminUsername(data.adminUsername);
      if (data.inactivityTimeoutMs) setInactivityTimeoutMs(data.inactivityTimeoutMs);
      if (data.timedOut) {
        setAuthError("Logged out automatically due to inactivity.");
      }
      if (data.authenticated) {
        await loadDashboard();
      } else {
        const menuRes = await fetch("/api/menu", { cache: "no-store" }).catch(() => null);
        if (menuRes && menuRes.ok) {
          const menuData = (await menuRes.json()) as { businessInfo?: BusinessInfo };
          if (menuData.businessInfo) {
            setBusinessInfo(menuData.businessInfo);
            setBusinessDraft(menuData.businessInfo);
          }
        }
      }
    } catch {
      setAuthError("Unable to reach authentication server.");
    } finally {
      setAuthLoading(false);
    }
  }, [loadDashboard]);

  React.useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleLogout = React.useCallback(async (reason?: string) => {
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
    } catch {
      // Ignore network errors on logout
    }
    setAuthenticated(false);
    setOrders([]);
    setCategories([]);
    setOffers([]);
    setSettings(null);
    setPasswordInput("");
    if (reason) setAuthError(reason);
  }, []);

  // Automatic inactivity logout + keepalive ping
  React.useEffect(() => {
    if (!authenticated) return;

    const resetIdleTimer = () => {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = window.setTimeout(() => {
        handleLogout("Logged out automatically after inactivity.");
      }, inactivityTimeoutMs);

      const now = Date.now();
      if (now - lastPingRef.current > 60_000) {
        lastPingRef.current = now;
        fetch("/api/admin/auth/ping", {
          method: "POST",
          credentials: "same-origin",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        })
          .then((res) => {
            if (res.status === 401) {
              handleUnauthorized("Session expired due to inactivity.");
            }
          })
          .catch(() => {});
      }
    };

    const events = ["pointerdown", "keydown", "scroll", "mousemove"];
    events.forEach((evt) => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    const pollInterval = window.setInterval(() => {
      loadDashboard();
    }, 15_000);

    return () => {
      window.clearTimeout(inactivityTimerRef.current);
      window.clearInterval(pollInterval);
      events.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
    };
  }, [authenticated, inactivityTimeoutMs, handleLogout, handleUnauthorized, loadDashboard]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput,
        }),
      });
      const data = (await res.json()) as {
        authenticated?: boolean;
        adminUsername?: string;
        error?: string;
      };
      if (!res.ok || !data.authenticated) {
        setAuthError(data.error || "Invalid email/username or password.");
        return;
      }
      if (data.adminUsername) setAdminUsername(data.adminUsername);
      setPasswordInput("");
      setAuthenticated(true);
      await loadDashboard();
    } catch {
      setAuthError("Unable to authenticate. Please try again.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const trimmedUser = usernameInput.trim();
    if (trimmedUser.length < 3) {
      setAuthError("Admin email or username must be at least 3 characters.");
      return;
    }
    if (passwordInput.length < 8) {
      setAuthError("Password must be at least 8 characters long.");
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setAuthError("Passwords do not match.");
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await fetch("/api/admin/auth/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          username: trimmedUser,
          password: passwordInput,
        }),
      });
      const data = (await res.json()) as {
        authenticated?: boolean;
        adminUsername?: string;
        error?: string;
      };
      if (!res.ok || !data.authenticated) {
        setAuthError(data.error || "Unable to save admin credentials.");
        return;
      }
      if (data.adminUsername) setAdminUsername(data.adminUsername);
      setPasswordInput("");
      setConfirmPasswordInput("");
      setSetupRequired(false);
      setAuthenticated(true);
      await loadDashboard();
    } catch {
      setAuthError("Network error while saving admin credentials.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  // --- Orders actions ---
  const updateOrder = async (
    orderId: string,
    patch: { status?: OrderStatus; paymentStatus?: PaymentStatus; paymentNote?: string },
    feedback: string,
  ) => {
    const res = await adminFetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!res) return;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error || "Unable to update order.");
      return;
    }
    const data = (await res.json()) as { order: CustomerOrder };
    setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
    showToast(feedback);
  };

  const deleteOrder = async (orderId: string) => {
    const res = await adminFetch(`/api/admin/orders/${orderId}`, { method: "DELETE" });
    if (!res) return;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error || "Unable to remove order.");
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    showToast(`Order ${orderId} removed`);
  };

  // --- Menu, Stock & Combo rules actions ---
  const handleAddCategory = async () => {
    const res = await adminFetch("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({ name: "New Category" }),
    });
    if (!res) return;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error || "Unable to create category.");
      return;
    }
    const data = (await res.json()) as { category: KimuraSushiCategory; categories: KimuraSushiCategory[] };
    setCategories(data.categories);
    setSelectedCatId(data.category.id);
    showToast("Category created");
  };

  const handleUpdateCategory = async (
    categoryId: string,
    patch: { name?: string; subtitle?: string; coverImage?: string },
  ) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, ...patch } : c)),
    );
    const res = await adminFetch(`/api/admin/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!res) return;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error || "Unable to save category.");
      await loadDashboard();
      return;
    }
    const data = (await res.json()) as { categories?: KimuraSushiCategory[] };
    if (data.categories) setCategories(data.categories);
    showToast("Category saved");
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const res = await adminFetch(`/api/admin/categories/${categoryId}`, { method: "DELETE" });
    if (!res) return;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error || "Unable to delete category.");
      return;
    }
    const data = (await res.json()) as { categories: KimuraSushiCategory[] };
    setCategories(data.categories);
    setSelectedCatId(data.categories[0]?.id ?? "");
    showToast("Category deleted");
  };

  const handleAddDish = async (categoryId: string) => {
    const res = await adminFetch(`/api/admin/categories/${categoryId}/dishes`, {
      method: "POST",
      body: JSON.stringify({
        name: "New Dish",
        priceDisplay: "100",
        stock: 25,
        available: true,
      }),
    });
    if (!res) return;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error || "Unable to add dish.");
      return;
    }
    const data = (await res.json()) as { categories: KimuraSushiCategory[] };
    setCategories(data.categories);
    showToast("Dish added");
  };

  const handleUpdateDish = async (
    dishId: string,
    patch: Partial<KimuraSushiDish>,
    silentToast = false,
  ) => {
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        dishes: cat.dishes.map((d) => (d.id === dishId ? { ...d, ...patch } : d)),
      })),
    );
    const res = await adminFetch(`/api/admin/dishes/${dishId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!res) return;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error || "Unable to update dish.");
      await loadDashboard();
      return;
    }
    const data = (await res.json()) as { categories: KimuraSushiCategory[] };
    setCategories(data.categories);
    if (!silentToast) showToast("Dish updated");
  };

  const handleDeleteDish = async (dishId: string) => {
    const res = await adminFetch(`/api/admin/dishes/${dishId}`, { method: "DELETE" });
    if (!res) return;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error || "Unable to delete dish.");
      return;
    }
    const data = (await res.json()) as { categories: KimuraSushiCategory[] };
    setCategories(data.categories);
    showToast("Dish removed");
  };

  const uploadAdminMedia = async (
    file: File,
    prefix: string,
    targetKey: string,
  ): Promise<string | null> => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      showToast("Please select a PNG, JPG, or WebP image file.");
      return null;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast("Image file must be 4 MB or smaller.");
      return null;
    }
    setUploadingMediaId(targetKey);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const res = await adminFetch("/api/admin/media/upload", {
        method: "POST",
        body: JSON.stringify({ dataUrl, prefix }),
      });
      if (!res) return null;
      const payload = (await res.json()) as { mediaUrl?: string; error?: string };
      if (!res.ok || !payload.mediaUrl) {
        showToast(payload.error || "Upload failed.");
        return null;
      }
      return payload.mediaUrl;
    } catch {
      showToast("Unable to read selected image.");
      return null;
    } finally {
      setUploadingMediaId(null);
    }
  };

  // --- Offers actions ---
  const availableOfferTargets = React.useMemo(() => {
    if (offerTargetType === "category") {
      return categories.map((c) => ({ id: c.id, label: c.name }));
    }
    if (offerTargetType === "combo") {
      const comboCat = categories.find((c) => c.id === "combos");
      const comboDishes = comboCat
        ? comboCat.dishes
        : categories.flatMap((c) => c.dishes.filter((d) => Boolean(d.comboConfig)));
      return comboDishes.map((d) => ({
        id: d.id,
        label: `${d.name} (${d.priceDisplay} EGP)`,
      }));
    }
    return categories
      .filter((c) => c.id !== "combos")
      .flatMap((c) =>
        c.dishes.map((d) => ({
          id: d.id,
          label: `${d.name} · ${c.name} (${d.priceDisplay} EGP)`,
        })),
      );
  }, [categories, offerTargetType]);

  const toggleOfferTargetId = (id: string) => {
    setOfferTargetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerTitle.trim()) {
      showToast("Enter an offer title.");
      return;
    }
    const val = Number(offerDiscountValue);
    if (!Number.isFinite(val) || val <= 0) {
      showToast("Enter a valid discount value.");
      return;
    }
    if (offerTargetIds.length === 0) {
      showToast("Select at least one target item or category.");
      return;
    }

    setCreatingOffer(true);
    try {
      const res = await adminFetch("/api/admin/offers", {
        method: "POST",
        body: JSON.stringify({
          title: offerTitle.trim(),
          description: offerDescription.trim(),
          discountType: offerDiscountType,
          discountValue: val,
          targetType: offerTargetType,
          targetIds: offerTargetIds,
          startsAt: toIsoStringSafe(offerStartsAt) || new Date().toISOString(),
          expiresAt: toIsoStringSafe(offerExpiresAt),
          active: offerActive,
        }),
      });
      if (!res) return;
      const data = (await res.json()) as { offers?: MenuOffer[]; error?: string };
      if (!res.ok || !data.offers) {
        showToast(data.error || "Unable to create offer.");
        return;
      }
      setOffers(data.offers);
      setOfferTitle("");
      setOfferDescription("");
      setOfferTargetIds([]);
      setOfferStartsAt("");
      setOfferExpiresAt("");
      showToast("Offer published");
    } finally {
      setCreatingOffer(false);
    }
  };

  const handleUpdateOffer = async (offerId: string, patch: Partial<MenuOffer>) => {
    const res = await adminFetch(`/api/admin/offers/${offerId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!res) return;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error || "Unable to update offer.");
      return;
    }
    const data = (await res.json()) as { offers?: MenuOffer[] };
    if (data.offers) setOffers(data.offers);
    showToast("Offer updated");
  };

  const handleDeleteOffer = async (offerId: string) => {
    const res = await adminFetch(`/api/admin/offers/${offerId}`, { method: "DELETE" });
    if (!res) return;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error || "Unable to delete offer.");
      return;
    }
    const data = (await res.json()) as { offers?: MenuOffer[] };
    if (data.offers) setOffers(data.offers);
    showToast("Offer deleted");
  };

  // --- Settings & Business actions ---
  const handleUpdateSettings = async (patch: Partial<OrderSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    const res = await adminFetch("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!res) return;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error || "Unable to update settings.");
      await loadDashboard();
      return;
    }
    const data = (await res.json()) as { settings: OrderSettings };
    setSettings(data.settings);
    showToast("Order settings updated");
  };

  const handleSaveBusinessInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBusiness(true);
    try {
      const res = await adminFetch("/api/admin/business", {
        method: "PATCH",
        body: JSON.stringify(businessDraft),
      });
      if (!res) return;
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        showToast(err.error || "Unable to save business information.");
        return;
      }
      const data = (await res.json()) as { businessInfo: BusinessInfo };
      setBusinessInfo(data.businessInfo);
      setBusinessDraft(data.businessInfo);
      showToast("Business information saved");
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      showToast("Please select a PNG, JPG, or WebP logo file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast("Logo file must be 4 MB or smaller.");
      return;
    }

    setUploadingLogo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const res = await adminFetch("/api/admin/logo/upload", {
        method: "POST",
        body: JSON.stringify({ dataUrl, filename: file.name }),
      });
      if (!res) return;
      const payload = (await res.json()) as {
        logoUrl?: string;
        businessInfo?: BusinessInfo;
        error?: string;
      };
      if (!res.ok || !payload.businessInfo) {
        showToast(payload.error || "Unable to upload logo.");
        return;
      }
      setBusinessInfo(payload.businessInfo);
      setBusinessDraft(payload.businessInfo);
      showToast("Brand logo uploaded");
    } catch {
      showToast("Unable to read logo image file.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAddBranch = () => {
    const nextBranch: BusinessBranch = {
      id: `branch-${Date.now()}`,
      name: "New Branch",
      address: "",
      phone: businessDraft.phone || "",
      whatsapp: "",
      mapsUrl: "",
    };
    setBusinessDraft((prev) => ({
      ...prev,
      branches: [...prev.branches, nextBranch],
    }));
  };

  const handleUpdateBranch = (branchId: string, patch: Partial<BusinessBranch>) => {
    setBusinessDraft((prev) => ({
      ...prev,
      branches: prev.branches.map((b) => (b.id === branchId ? { ...b, ...patch } : b)),
    }));
  };

  const handleRemoveBranch = (branchId: string) => {
    setBusinessDraft((prev) => ({
      ...prev,
      branches: prev.branches.filter((b) => b.id !== branchId),
    }));
  };

  const handleResetMenu = async () => {
    const res = await adminFetch("/api/admin/menu/reset", { method: "POST", body: "{}" });
    if (!res || !res.ok) return;
    const data = (await res.json()) as { categories: KimuraSushiCategory[]; settings: OrderSettings };
    setCategories(data.categories);
    setSettings(data.settings);
    setSelectedCatId(data.categories[0]?.id ?? "");
    showToast("Restored official menu");
  };

  const handleChangeCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    const res = await adminFetch("/api/admin/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: currentPwd,
        newPassword: newPwd,
        ...(newUsernameInput.trim() ? { newUsername: newUsernameInput.trim() } : {}),
      }),
    });
    if (!res) return;
    const data = (await res.json()) as {
      ok?: boolean;
      adminUsername?: string;
      error?: string;
    };
    if (!res.ok) {
      setPwdMsg(data.error || "Unable to update credentials.");
      return;
    }
    if (data.adminUsername) setAdminUsername(data.adminUsername);
    setCurrentPwd("");
    setNewPwd("");
    setNewUsernameInput("");
    setPwdMsg("Administrator credentials updated.");
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Verifying session...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-background text-foreground">
              <Lock className="size-4" />
            </span>
            <div>
              <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                {businessInfo.businessName} · Restricted Portal
              </p>
              <h1 className="font-display text-2xl font-medium tracking-tight">
                {setupRequired ? "Create Admin Account" : "Admin Sign In"}
              </h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {setupRequired
              ? `Create the administrator email/username and password for ${businessInfo.businessName}. Credentials are salted and hashed on the server.`
              : "Sign in with your administrator email or username and password to manage orders, payment approvals, stock, offers, and store settings."}
          </p>

          {authError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form
            onSubmit={setupRequired ? handleSetupSubmit : handleLoginSubmit}
            className="mt-6 space-y-4"
          >
            <div>
              <label htmlFor="admin-username" className="block text-xs font-medium text-muted-foreground">
                Admin Email or Username
              </label>
              <input
                id="admin-username"
                type="text"
                required
                autoFocus
                autoComplete="username"
                placeholder="admin@kimurasushi.com"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-xs font-medium text-muted-foreground">
                {setupRequired ? "New Password (min 8 chars)" : "Password"}
              </label>
              <input
                id="admin-password"
                type="password"
                required
                minLength={8}
                autoComplete={setupRequired ? "new-password" : "current-password"}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {setupRequired && (
              <div>
                <label htmlFor="admin-password-confirm" className="block text-xs font-medium text-muted-foreground">
                  Confirm Password
                </label>
                <input
                  id="admin-password-confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full cursor-pointer rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {authSubmitting
                ? "Authenticating..."
                : setupRequired
                  ? "Create Admin Account & Sign In"
                  : "Sign In to Dashboard"}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-4 text-center">
            <a href="/" className="text-xs text-muted-foreground hover:text-foreground">
              Return to {businessInfo.businessName} website
            </a>
          </div>
        </div>
      </div>
    );
  }

  const activeCategory = categories.find((c) => c.id === selectedCatId) ?? categories[0];

  const searchLower = orderSearch.trim().toLowerCase();
  const filteredOrders = orders.filter((o) => {
    if (orderFilter !== "all" && o.status !== orderFilter) return false;
    if (paymentFilter === "pending_verification" && o.paymentStatus !== "pending_verification") {
      return false;
    }
    if (
      paymentFilter !== "all" &&
      paymentFilter !== "pending_verification" &&
      o.paymentMethod !== paymentFilter
    ) {
      return false;
    }
    if (!searchLower) return true;
    const haystack = [
      o.id,
      o.customerName,
      o.customerPhone,
      o.deliveryAddress || "",
      o.paymentReference || "",
      o.notes || "",
      ...o.items.map((item) => item.dishName),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(searchLower);
  });

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const pendingVerificationCount = orders.filter(
    (o) => o.paymentStatus === "pending_verification",
  ).length;
  const unavailableCount = categories.reduce(
    (sum, cat) => sum + cat.dishes.filter((d) => !d.available || d.stock <= 0).length,
    0,
  );
  const activeOffersCount = offers.filter((o) => isOfferCurrentlyActive(o)).length;

  const toggleComboAllowedCategory = (dish: KimuraSushiDish, catId: string) => {
    if (!dish.comboConfig) return;
    const current = dish.comboConfig.allowedCategoryIds ?? [];
    const nextAllowed = current.includes(catId)
      ? current.filter((id) => id !== catId)
      : [...current, catId];
    if (nextAllowed.length === 0) {
      showToast("Combo boxes must allow at least one category.");
      return;
    }
    handleUpdateDish(dish.id, {
      comboConfig: {
        ...dish.comboConfig,
        allowedCategoryIds: nextAllowed,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-foreground" />
            <div>
              <h1 className="font-display text-lg font-medium tracking-tight">
                {businessInfo.businessName} · Admin Console
              </h1>
              <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {adminUsername && <span>Signed in as {adminUsername}</span>}
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  Auto-locks after {Math.round(inactivityTimeoutMs / 60000)}m inactivity
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {toastMsg && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
                <Check className="size-3.5 text-emerald-500" />
                {toastMsg}
              </span>
            )}
            <a
              href="/"
              className="rounded-full border border-border px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Public Storefront
            </a>
            <button
              type="button"
              onClick={() => handleLogout("Signed out securely.")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
            >
              <LogOut className="size-3.5" />
              Log Out
            </button>
          </div>
        </div>

        {/* Admin Section Tabs */}
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === "orders"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <ShoppingBag className="size-3.5" />
            Orders &amp; Payments
            <span className="font-mono tabular-nums">({orders.length})</span>
            {(pendingCount > 0 || pendingVerificationCount > 0) && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-black tabular-nums">
                {pendingCount > 0 ? `${pendingCount} new` : `${pendingVerificationCount} verify`}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("menu")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === "menu"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <UtensilsCrossed className="size-3.5" />
            Menu, Stock &amp; Combo Rules
            {unavailableCount > 0 && (
              <span className="font-mono text-[11px] opacity-80 tabular-nums">
                ({unavailableCount} off)
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("offers")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === "offers"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Percent className="size-3.5" />
            Offers &amp; Discounts
            <span className="font-mono tabular-nums">({activeOffersCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("business")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === "business"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Building2 className="size-3.5" />
            Business &amp; Payment Info
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === "settings"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Settings className="size-3.5" />
            Settings &amp; Security
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Honest Persistence Warning on Vercel if external DB is missing */}
        {storageDiagnostics?.isVercelRuntime && !storageDiagnostics.persistentOnVercel && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="space-y-1">
              <p className="font-semibold">
                External database not configured for Vercel persistence
              </p>
              <p className="text-muted-foreground">
                Add <code className="font-mono">DATABASE_URL</code> (PostgreSQL) or{" "}
                <code className="font-mono">SUPABASE_URL</code> +{" "}
                <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in your Vercel
                Project Environment Variables so orders, payment screenshots, stock edits, and offers
                persist across deployments.
              </p>
            </div>
          </div>
        )}

        {/* TAB 1: ORDERS & PAYMENT VERIFICATION */}
        {activeTab === "orders" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search order ID, name, phone, address, or ref..."
                  className="w-full rounded-full border border-input bg-card py-2 pr-4 pl-10 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter by payment method or verification"
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
                  className="rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All Payment Methods</option>
                  <option value="pending_verification">
                    Pending Verification ({pendingVerificationCount})
                  </option>
                  <option value="vodafone_cash">Vodafone Cash</option>
                  <option value="instapay">InstaPay</option>
                  <option value="cash_on_delivery">Cash on Delivery</option>
                </select>

                <button
                  type="button"
                  onClick={loadDashboard}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <RefreshCw className="size-3.5" />
                  Refresh Orders
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOrderFilter("all")}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  orderFilter === "all"
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({orders.length})
              </button>
              {ORDER_STATUS_OPTIONS.map((opt) => {
                const count = orders.filter((o) => o.status === opt.value).length;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOrderFilter(opt.value)}
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      orderFilter === opt.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label} ({count})
                  </button>
                );
              })}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-12 text-center">
                <PackageCheck className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 font-display text-lg font-medium">No matching orders</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Incoming customer orders placed on {businessInfo.businessName} appear here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const methodInfo = PAYMENT_METHOD_LABELS[order.paymentMethod] ?? {
                    en: order.paymentMethod,
                    ar: order.paymentMethod,
                  };
                  const payStatusInfo = PAYMENT_STATUS_LABELS[order.paymentStatus] ?? {
                    en: order.paymentStatus,
                    ar: order.paymentStatus,
                  };
                  const waHref = buildWhatsAppOrderUrl(
                    businessInfo.whatsapp || businessInfo.phone,
                    order,
                    businessInfo.businessName,
                  );

                  const paymentBadgeClass =
                    order.paymentStatus === "approved"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                      : order.paymentStatus === "rejected"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : order.paymentStatus === "pending_verification"
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                          : "border-border bg-secondary text-foreground";

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-border bg-card p-5 sm:p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-base font-semibold tabular-nums">
                              {order.id}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(order.createdAt).toLocaleString()}
                            </span>
                            <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">
                              {order.serviceType}
                            </span>
                            <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">
                              {methodInfo.en}
                            </span>
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${paymentBadgeClass}`}
                            >
                              {payStatusInfo.en}
                            </span>
                          </div>

                          <p className="text-sm text-foreground">
                            <span className="font-medium">{order.customerName}</span>
                            <span className="mx-2 text-muted-foreground">·</span>
                            <span className="font-mono tabular-nums">{order.customerPhone}</span>
                          </p>
                          {order.deliveryAddress && (
                            <p className="text-xs text-foreground">
                              <span className="text-muted-foreground">Address: </span>
                              {order.deliveryAddress}
                            </p>
                          )}
                          {order.notes && (
                            <p className="text-xs text-muted-foreground">
                              Note: {order.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-600/20 dark:text-emerald-300"
                          >
                            <MessageCircle className="size-3.5" />
                            Send via WhatsApp
                            <ExternalLink className="size-3" />
                          </a>

                          <select
                            aria-label={`Status for order ${order.id}`}
                            value={order.status}
                            onChange={(e) =>
                              updateOrder(
                                order.id,
                                { status: e.target.value as OrderStatus },
                                `Order ${order.id} marked ${e.target.value}`,
                              )
                            }
                            className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {ORDER_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                Status: {opt.label}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => deleteOrder(order.id)}
                            aria-label={`Delete order ${order.id}`}
                            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Payment Proof & Verification Row for Wallet/InstaPay */}
                      {(order.paymentMethod === "vodafone_cash" ||
                        order.paymentMethod === "instapay" ||
                        order.paymentReference ||
                        order.paymentScreenshotUrl) && (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-background p-3.5">
                          <div className="flex flex-wrap items-center gap-4">
                            {order.paymentScreenshotUrl && (
                              <button
                                type="button"
                                onClick={() => setScreenshotModalUrl(order.paymentScreenshotUrl!)}
                                className="group relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border bg-card"
                                title="View full payment screenshot"
                              >
                                <img
                                  src={order.paymentScreenshotUrl}
                                  alt={`Payment proof for ${order.id}`}
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                />
                              </button>
                            )}
                            <div className="space-y-1 text-xs">
                              <p className="font-medium text-foreground">
                                {methodInfo.en} Verification Details
                              </p>
                              <p className="text-muted-foreground">
                                Reference:{" "}
                                <span className="font-mono font-semibold text-foreground">
                                  {order.paymentReference || "Not provided"}
                                </span>
                              </p>
                              {order.paymentScreenshotUrl && (
                                <button
                                  type="button"
                                  onClick={() => setScreenshotModalUrl(order.paymentScreenshotUrl!)}
                                  className="cursor-pointer font-medium text-foreground underline underline-offset-2"
                                >
                                  Inspect uploaded screenshot
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateOrder(
                                  order.id,
                                  {
                                    paymentStatus: "approved",
                                    status: order.status === "pending" ? "confirmed" : order.status,
                                  },
                                  `Payment approved for ${order.id}`,
                                )
                              }
                              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                order.paymentStatus === "approved"
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-300"
                              }`}
                            >
                              <CheckCircle2 className="size-3.5" />
                              Approve Payment
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateOrder(
                                  order.id,
                                  { paymentStatus: "rejected" },
                                  `Payment rejected for ${order.id}`,
                                )
                              }
                              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                order.paymentStatus === "rejected"
                                  ? "border-destructive bg-destructive text-white"
                                  : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                              }`}
                            >
                              <XCircle className="size-3.5" />
                              Reject
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                        <ul className="space-y-1.5 text-sm">
                          {order.items.map((item, idx) => (
                            <li key={`${item.dishId}-${idx}`} className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                                  {item.quantity}x
                                </span>
                                <span className="text-foreground">{item.dishName}</span>
                                {item.variantLabel !== "Regular" && (
                                  <span className="text-xs text-muted-foreground">
                                    ({item.variantLabel})
                                  </span>
                                )}
                                {item.appliedOfferTitle && (
                                  <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-500">
                                    Offer: {item.appliedOfferTitle}
                                  </span>
                                )}
                                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                  · {(item.unitPrice * item.quantity).toLocaleString()} EGP
                                </span>
                              </div>
                              {item.selectedPieces && item.selectedPieces.length > 0 && (
                                <p className="pl-6 text-xs text-muted-foreground">
                                  Pieces:{" "}
                                  {item.selectedPieces
                                    .map((p, sIdx) => `#${sIdx + 1} ${p.dishName}`)
                                    .join(", ")}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>

                        <div className="text-right space-y-0.5">
                          {order.discountTotal && order.discountTotal > 0 ? (
                            <p className="font-mono text-xs tabular-nums text-emerald-500">
                              Offer Savings: -{order.discountTotal.toLocaleString()} EGP
                            </p>
                          ) : null}
                          {order.deliveryFee > 0 && (
                            <p className="font-mono text-xs tabular-nums text-muted-foreground">
                              Delivery: {order.deliveryFee.toLocaleString()} EGP
                            </p>
                          )}
                          <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
                            Total: {order.total.toLocaleString()} EGP
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MENU, CATEGORIES, STOCK & COMBO BOX RULES */}
        {activeTab === "menu" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-border bg-card p-3 self-start">
              <div className="flex items-center justify-between px-2 pb-3">
                <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Categories ({categories.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background"
                >
                  <Plus className="size-3" />
                  Add
                </button>
              </div>
              <div className="max-h-[70vh] space-y-1 overflow-y-auto">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCatId(cat.id)}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      activeCategory?.id === cat.id
                        ? "bg-foreground font-medium text-background"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="ml-2 font-mono text-xs tabular-nums opacity-75">
                      {cat.dishes.length}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            {activeCategory && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-display text-xl font-medium">
                      Category: {activeCategory.name}
                    </h2>
                    {categories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(activeCategory.id)}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-destructive hover:underline"
                      >
                        <Trash2 className="size-3.5" />
                        Delete category
                      </button>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs text-muted-foreground">Category Name</label>
                      <input
                        type="text"
                        defaultValue={activeCategory.name}
                        key={`cat-name-${activeCategory.id}`}
                        onBlur={(e) => {
                          if (e.target.value.trim() && e.target.value !== activeCategory.name) {
                            handleUpdateCategory(activeCategory.id, { name: e.target.value });
                          }
                        }}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground">Pieces / Note</label>
                      <input
                        type="text"
                        defaultValue={activeCategory.subtitle ?? ""}
                        key={`cat-sub-${activeCategory.id}`}
                        onBlur={(e) => {
                          if (e.target.value !== (activeCategory.subtitle ?? "")) {
                            handleUpdateCategory(activeCategory.id, { subtitle: e.target.value });
                          }
                        }}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground">Cover Image</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="text"
                          defaultValue={activeCategory.coverImage}
                          key={`cat-img-${activeCategory.id}-${activeCategory.coverImage}`}
                          onBlur={(e) => {
                            if (
                              e.target.value.trim() &&
                              e.target.value !== activeCategory.coverImage
                            ) {
                              handleUpdateCategory(activeCategory.id, {
                                coverImage: e.target.value,
                              });
                            }
                          }}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary">
                          <ImagePlus className="size-3.5" />
                          <span>{uploadingMediaId === `cat-${activeCategory.id}` ? "..." : "Upload"}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              const url = await uploadAdminMedia(
                                file,
                                "category",
                                `cat-${activeCategory.id}`,
                              );
                              if (url) {
                                handleUpdateCategory(activeCategory.id, { coverImage: url });
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Dishes in {activeCategory.name} ({activeCategory.dishes.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleAddDish(activeCategory.id)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
                  >
                    <Plus className="size-3.5" />
                    Add Dish
                  </button>
                </div>

                <div className="space-y-4">
                  {activeCategory.dishes.map((dish) => {
                    const dishImagePreview = dish.image || activeCategory.coverImage;
                    return (
                      <div key={dish.id} className="rounded-2xl border border-border bg-card p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateDish(dish.id, { available: !dish.available })
                              }
                              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                dish.available && dish.stock > 0
                                  ? "border border-emerald-500/40 bg-emerald-500/15 text-foreground"
                                  : "border border-destructive/30 bg-destructive/15 text-destructive"
                              }`}
                            >
                              {dish.available
                                ? dish.stock > 0
                                  ? "Available"
                                  : "Out of Stock"
                                : "Marked Unavailable"}
                            </button>

                            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1">
                              <span className="pl-1.5 text-[11px] text-muted-foreground">Stock:</span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateDish(
                                    dish.id,
                                    { stock: Math.max(0, dish.stock - 1) },
                                    true,
                                  )
                                }
                                aria-label={`Decrease stock for ${dish.name}`}
                                className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-secondary"
                              >
                                <Minus className="size-3" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                defaultValue={dish.stock}
                                key={`d-stock-${dish.id}-${dish.stock}`}
                                onBlur={(e) => {
                                  const nextStock = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                  if (nextStock !== dish.stock) {
                                    handleUpdateDish(dish.id, { stock: nextStock }, true);
                                  }
                                }}
                                className="w-12 bg-transparent text-center font-mono text-xs font-semibold tabular-nums outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateDish(dish.id, { stock: dish.stock + 1 }, true)
                                }
                                aria-label={`Increase stock for ${dish.name}`}
                                className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-secondary"
                              >
                                <Plus className="size-3" />
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteDish(dish.id)}
                            aria-label={`Delete ${dish.name}`}
                            className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div>
                            <label className="block text-[11px] text-muted-foreground">
                              Dish Name
                            </label>
                            <input
                              type="text"
                              defaultValue={dish.name}
                              key={`d-name-${dish.id}-${dish.name}`}
                              onBlur={(e) => {
                                if (e.target.value.trim() && e.target.value !== dish.name) {
                                  handleUpdateDish(dish.id, { name: e.target.value });
                                }
                              }}
                              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-muted-foreground">
                              Price (EGP, e.g. 150)
                            </label>
                            <input
                              type="text"
                              defaultValue={dish.priceDisplay}
                              key={`d-price-${dish.id}-${dish.priceDisplay}`}
                              onBlur={(e) => {
                                if (e.target.value.trim() && e.target.value !== dish.priceDisplay) {
                                  handleUpdateDish(dish.id, { priceDisplay: e.target.value });
                                }
                              }}
                              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-muted-foreground">
                              Pieces / Note
                            </label>
                            <input
                              type="text"
                              defaultValue={dish.piecesInfo ?? ""}
                              key={`d-pcs-${dish.id}-${dish.piecesInfo ?? ""}`}
                              onBlur={(e) => {
                                if (e.target.value !== (dish.piecesInfo ?? "")) {
                                  handleUpdateDish(dish.id, { piecesInfo: e.target.value });
                                }
                              }}
                              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_20rem]">
                          <div>
                            <label className="block text-[11px] text-muted-foreground">
                              Description &amp; Ingredients
                            </label>
                            <input
                              type="text"
                              defaultValue={dish.description ?? ""}
                              key={`d-desc-${dish.id}-${dish.description ?? ""}`}
                              onBlur={(e) => {
                                if (e.target.value !== (dish.description ?? "")) {
                                  handleUpdateDish(dish.id, { description: e.target.value });
                                }
                              }}
                              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-muted-foreground">
                              Dish Image URL / Upload
                            </label>
                            <div className="mt-1 flex items-center gap-2">
                              <img
                                src={dishImagePreview}
                                alt={dish.name}
                                className="size-8 shrink-0 rounded-md border border-border object-cover"
                              />
                              <input
                                type="text"
                                defaultValue={dish.image ?? ""}
                                placeholder={activeCategory.coverImage}
                                key={`d-img-${dish.id}-${dish.image ?? ""}`}
                                onBlur={(e) => {
                                  if (e.target.value.trim() !== (dish.image ?? "")) {
                                    handleUpdateDish(dish.id, { image: e.target.value.trim() });
                                  }
                                }}
                                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                              <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">
                                <Upload className="size-3" />
                                <span>
                                  {uploadingMediaId === `dish-${dish.id}` ? "..." : "Upload"}
                                </span>
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (!file) return;
                                    const url = await uploadAdminMedia(
                                      file,
                                      "dish",
                                      `dish-${dish.id}`,
                                    );
                                    if (url) {
                                      handleUpdateDish(dish.id, { image: url });
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Combo Box Rules Editor */}
                        {(activeCategory.id === "combos" || dish.comboConfig) && dish.comboConfig && (
                          <div className="mt-4 rounded-xl border border-border bg-background p-4 space-y-3">
                            <p className="text-xs font-semibold text-foreground">
                              Combo Box Selection Rules
                            </p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              <div>
                                <label className="block text-[11px] text-muted-foreground">
                                  Required Pieces
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={120}
                                  defaultValue={dish.comboConfig.requiredPieces}
                                  key={`cc-req-${dish.id}-${dish.comboConfig.requiredPieces}`}
                                  onBlur={(e) =>
                                    handleUpdateDish(dish.id, {
                                      comboConfig: {
                                        ...dish.comboConfig!,
                                        requiredPieces: Math.max(
                                          1,
                                          Number(e.target.value) || dish.comboConfig!.requiredPieces,
                                        ),
                                      },
                                    })
                                  }
                                  className="mt-1 w-full rounded-lg border border-input bg-card px-2.5 py-1.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] text-muted-foreground">
                                  Exact Piece Price (0 = off)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  defaultValue={dish.comboConfig.exactPiecePrice ?? 0}
                                  key={`cc-exact-${dish.id}-${dish.comboConfig.exactPiecePrice ?? 0}`}
                                  onBlur={(e) => {
                                    const val = Math.max(0, Number(e.target.value) || 0);
                                    const nextCfg: ComboBoxConfig = {
                                      ...dish.comboConfig!,
                                    };
                                    if (val > 0) {
                                      nextCfg.exactPiecePrice = val;
                                    } else {
                                      delete nextCfg.exactPiecePrice;
                                    }
                                    handleUpdateDish(dish.id, { comboConfig: nextCfg });
                                  }}
                                  className="mt-1 w-full rounded-lg border border-input bg-card px-2.5 py-1.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] text-muted-foreground">
                                  Min Raw Special
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  defaultValue={dish.comboConfig.minRawSpecial ?? 0}
                                  key={`cc-raw-${dish.id}-${dish.comboConfig.minRawSpecial ?? 0}`}
                                  onBlur={(e) =>
                                    handleUpdateDish(dish.id, {
                                      comboConfig: {
                                        ...dish.comboConfig!,
                                        minRawSpecial: Math.max(0, Number(e.target.value) || 0),
                                      },
                                    })
                                  }
                                  className="mt-1 w-full rounded-lg border border-input bg-card px-2.5 py-1.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] text-muted-foreground">
                                  Min Fried Special
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  defaultValue={dish.comboConfig.minFriedSpecial ?? 0}
                                  key={`cc-fried-${dish.id}-${dish.comboConfig.minFriedSpecial ?? 0}`}
                                  onBlur={(e) =>
                                    handleUpdateDish(dish.id, {
                                      comboConfig: {
                                        ...dish.comboConfig!,
                                        minFriedSpecial: Math.max(0, Number(e.target.value) || 0),
                                      },
                                    })
                                  }
                                  className="mt-1 w-full rounded-lg border border-input bg-card px-2.5 py-1.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <span className="text-[11px] text-muted-foreground">
                                Allowed piece categories:
                              </span>
                              {categories
                                .filter((c) => c.id !== "combos" && c.id !== "kimura-noodles")
                                .map((c) => {
                                  const checked = dish.comboConfig!.allowedCategoryIds.includes(
                                    c.id,
                                  );
                                  return (
                                    <label
                                      key={c.id}
                                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px]"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleComboAllowedCategory(dish, c.id)}
                                      />
                                      <span>{c.name}</span>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: OFFERS & DISCOUNTS */}
        {activeTab === "offers" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <form
              onSubmit={handleCreateOffer}
              className="rounded-2xl border border-border bg-card p-6 space-y-4 self-start"
            >
              <div>
                <h2 className="font-display text-xl font-medium">Create Offer / Discount</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Active offers apply automatically across the storefront, rotating showcase, and
                  order totals.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">Offer Title</label>
                <input
                  type="text"
                  required
                  value={offerTitle}
                  onChange={(e) => setOfferTitle(e.target.value)}
                  placeholder="e.g. Weekend Noodles 15% Off"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={offerDescription}
                  onChange={(e) => setOfferDescription(e.target.value)}
                  placeholder="Shown in the offers banner"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Discount Type
                  </label>
                  <select
                    value={offerDiscountType}
                    onChange={(e) => setOfferDiscountType(e.target.value as OfferDiscountType)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (EGP)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Discount Value
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={offerDiscountType === "percentage" ? 95 : 5000}
                    required
                    value={offerDiscountValue}
                    onChange={(e) => setOfferDiscountValue(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">Applies To</label>
                <select
                  value={offerTargetType}
                  onChange={(e) => {
                    setOfferTargetType(e.target.value as OfferTargetType);
                    setOfferTargetIds([]);
                  }}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="category">Menu Categories</option>
                  <option value="combo">Combo Boxes</option>
                  <option value="dish">Specific Dishes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Select Targets ({offerTargetIds.length} selected)
                </label>
                <div className="mt-1.5 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2.5">
                  {availableOfferTargets.map((target) => {
                    const checked = offerTargetIds.includes(target.id);
                    return (
                      <label
                        key={target.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-secondary"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOfferTargetId(target.id)}
                        />
                        <span className="truncate">{target.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Starts At (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={offerStartsAt}
                    onChange={(e) => setOfferStartsAt(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Expires At (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={offerExpiresAt}
                    onChange={(e) => setOfferExpiresAt(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={offerActive}
                  onChange={(e) => setOfferActive(e.target.checked)}
                />
                <span>Activate immediately</span>
              </label>

              <button
                type="submit"
                disabled={creatingOffer}
                className="w-full cursor-pointer rounded-full bg-foreground px-4 py-2.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {creatingOffer ? "Saving Offer..." : "Create Offer"}
              </button>
            </form>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-medium">
                  Active &amp; Scheduled Offers ({offers.length})
                </h2>
              </div>

              {offers.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-10 text-center">
                  <Percent className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 font-display text-lg font-medium">No offers configured</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a percentage or fixed-amount offer on the left to discount dishes,
                    categories, or combo boxes automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {offers.map((offer) => {
                    const badge = getOfferStatusBadge(offer);
                    const targetNames = offer.targetIds.map((id) => {
                      const cat = categories.find((c) => c.id === id);
                      if (cat) return cat.name;
                      for (const c of categories) {
                        const d = c.dishes.find((item) => item.id === id);
                        if (d) return d.name;
                      }
                      return id;
                    });

                    return (
                      <div key={offer.id} className="rounded-2xl border border-border bg-card p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-display text-base font-medium text-foreground">
                                {offer.title}
                              </span>
                              <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-rose-500">
                                {offer.discountType === "percentage"
                                  ? `-${offer.discountValue}%`
                                  : `-${offer.discountValue} EGP`}
                              </span>
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                            {offer.description && (
                              <p className="text-xs text-muted-foreground">{offer.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Targets ({offer.targetType}):{" "}
                              <span className="text-foreground">{targetNames.join(", ")}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateOffer(offer.id, { active: !offer.active })
                              }
                              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                offer.active
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border bg-background text-foreground"
                              }`}
                            >
                              {offer.active ? "Active" : "Paused"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOffer(offer.id)}
                              aria-label={`Delete offer ${offer.title}`}
                              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div>
                            <label className="block text-[11px] text-muted-foreground">Title</label>
                            <input
                              type="text"
                              defaultValue={offer.title}
                              key={`of-title-${offer.id}-${offer.title}`}
                              onBlur={(e) => {
                                if (e.target.value.trim() && e.target.value !== offer.title) {
                                  handleUpdateOffer(offer.id, { title: e.target.value.trim() });
                                }
                              }}
                              className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-muted-foreground">
                              Value ({offer.discountType === "percentage" ? "%" : "EGP"})
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={offer.discountType === "percentage" ? 95 : 5000}
                              defaultValue={offer.discountValue}
                              key={`of-val-${offer.id}-${offer.discountValue}`}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isFinite(v) && v > 0 && v !== offer.discountValue) {
                                  handleUpdateOffer(offer.id, { discountValue: v });
                                }
                              }}
                              className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-muted-foreground">
                              Expires At (clear to keep open)
                            </label>
                            <input
                              type="datetime-local"
                              defaultValue={toDatetimeLocalValue(offer.expiresAt)}
                              key={`of-exp-${offer.id}-${offer.expiresAt}`}
                              onBlur={(e) => {
                                const nextIso = toIsoStringSafe(e.target.value);
                                if (nextIso !== offer.expiresAt) {
                                  handleUpdateOffer(offer.id, { expiresAt: nextIso });
                                }
                              }}
                              className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: BUSINESS INFO, PAYMENTS & BRANDING */}
        {activeTab === "business" && (
          <form onSubmit={handleSaveBusinessInfo} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-medium">
                  Business Information, Payments &amp; Branding
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Updates phone/WhatsApp, Vodafone Cash &amp; InstaPay numbers, social links,
                  branches, and branding across the site.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingBusiness}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Save className="size-3.5" />
                {savingBusiness ? "Saving..." : "Save Business Info"}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h3 className="font-display text-lg font-medium">Brand &amp; Social Media</h3>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={businessDraft.businessName}
                    onChange={(e) =>
                      setBusinessDraft((prev) => ({ ...prev, businessName: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Brand Slogan
                  </label>
                  <input
                    type="text"
                    value={businessDraft.slogan}
                    onChange={(e) =>
                      setBusinessDraft((prev) => ({ ...prev, slogan: e.target.value }))
                    }
                    placeholder="Optional brand slogan"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    About Us Description
                  </label>
                  <textarea
                    rows={3}
                    value={businessDraft.aboutUs}
                    onChange={(e) =>
                      setBusinessDraft((prev) => ({ ...prev, aboutUs: e.target.value }))
                    }
                    placeholder="Optional short description displayed on the storefront"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Instagram Handle
                    </label>
                    <input
                      type="text"
                      value={businessDraft.instagramHandle}
                      onChange={(e) =>
                        setBusinessDraft((prev) => ({ ...prev, instagramHandle: e.target.value }))
                      }
                      placeholder="@kimurasushi2025"
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Instagram Profile URL
                    </label>
                    <input
                      type="url"
                      value={businessDraft.instagramUrl}
                      onChange={(e) =>
                        setBusinessDraft((prev) => ({ ...prev, instagramUrl: e.target.value }))
                      }
                      placeholder="https://www.instagram.com/..."
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Facebook URL (optional)
                    </label>
                    <input
                      type="url"
                      value={businessDraft.facebookUrl}
                      onChange={(e) =>
                        setBusinessDraft((prev) => ({ ...prev, facebookUrl: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      TikTok URL (optional)
                    </label>
                    <input
                      type="url"
                      value={businessDraft.tiktokUrl}
                      onChange={(e) =>
                        setBusinessDraft((prev) => ({ ...prev, tiktokUrl: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h3 className="font-display text-lg font-medium">
                  Contact, Wallets &amp; Delivery
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Primary Phone Number
                    </label>
                    <input
                      type="text"
                      value={businessDraft.phone}
                      onChange={(e) =>
                        setBusinessDraft((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder="01155412188"
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      WhatsApp Order Number
                    </label>
                    <input
                      type="text"
                      value={businessDraft.whatsapp}
                      onChange={(e) =>
                        setBusinessDraft((prev) => ({ ...prev, whatsapp: e.target.value }))
                      }
                      placeholder="01155412188"
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Vodafone Cash Number
                    </label>
                    <input
                      type="text"
                      value={businessDraft.vodafoneCashNumber}
                      onChange={(e) =>
                        setBusinessDraft((prev) => ({
                          ...prev,
                          vodafoneCashNumber: e.target.value,
                        }))
                      }
                      placeholder="01155412188"
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      InstaPay Number / IPA Identifier
                    </label>
                    <input
                      type="text"
                      value={businessDraft.instaPayIdentifier}
                      onChange={(e) =>
                        setBusinessDraft((prev) => ({
                          ...prev,
                          instaPayIdentifier: e.target.value,
                        }))
                      }
                      placeholder="01155412188 or username@instapay"
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Email Address (optional)
                  </label>
                  <input
                    type="email"
                    value={businessDraft.email}
                    onChange={(e) =>
                      setBusinessDraft((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Business Hours (optional)
                  </label>
                  <input
                    type="text"
                    value={businessDraft.businessHours}
                    onChange={(e) =>
                      setBusinessDraft((prev) => ({ ...prev, businessHours: e.target.value }))
                    }
                    placeholder="e.g. Daily 1:00 PM – 1:00 AM"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Delivery &amp; Shipping Information (optional)
                  </label>
                  <input
                    type="text"
                    value={businessDraft.deliveryInfo}
                    onChange={(e) =>
                      setBusinessDraft((prev) => ({ ...prev, deliveryInfo: e.target.value }))
                    }
                    placeholder="Shown on storefront & checkout when filled"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-medium">Brand Logo (Navigation Bar)</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Displayed next to {businessDraft.businessName || "Kimura Sushi"} in the top
                    navigation bar.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => logoFileInputRef.current?.click()}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Upload className="size-3.5" />
                    {uploadingLogo ? "Uploading..." : "Upload Logo"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBusinessDraft((prev) => ({
                        ...prev,
                        logoUrl: DEFAULT_BRAND_LOGO,
                      }))
                    }
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    <RotateCcw className="size-3.5" />
                    Reset Default Logo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Logo Image URL or Uploaded Path
                  </label>
                  <input
                    type="text"
                    value={businessDraft.logoUrl}
                    onChange={(e) =>
                      setBusinessDraft((prev) => ({ ...prev, logoUrl: e.target.value }))
                    }
                    placeholder="/assets/... or https://..."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Supports transparent PNG, JPG, or WebP up to 4 MB. Click Save Business Info
                    after editing the URL manually.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-start justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900">
                    <span className="text-[10px] font-medium tracking-wider uppercase text-stone-500">
                      Light Theme
                    </span>
                    <div className="flex items-center gap-2.5">
                      {businessDraft.logoUrl && (
                        <img
                          src={businessDraft.logoUrl}
                          alt="Light theme logo preview"
                          className="h-9 w-auto shrink-0 object-contain"
                        />
                      )}
                      <span className="font-display text-sm font-medium leading-none truncate">
                        {businessDraft.businessName || "Kimura Sushi"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start justify-center gap-1.5 rounded-xl border border-stone-800 bg-stone-950 px-4 py-3 text-stone-50">
                    <span className="text-[10px] font-medium tracking-wider uppercase text-stone-400">
                      Dark Theme
                    </span>
                    <div className="flex items-center gap-2.5">
                      {businessDraft.logoUrl && (
                        <img
                          src={businessDraft.logoUrl}
                          alt="Dark theme logo preview"
                          className="h-9 w-auto shrink-0 object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.34)]"
                        />
                      )}
                      <span className="font-display text-sm font-medium leading-none truncate">
                        {businessDraft.businessName || "Kimura Sushi"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-medium">
                    Branch Locations ({businessDraft.branches.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Manage branch names, addresses, map links, and contact numbers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBranch}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <Plus className="size-3.5" />
                  Add Branch
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {businessDraft.branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="space-y-3 rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Branch Details</span>
                      {businessDraft.branches.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBranch(branch.id)}
                          className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground">Branch Name</label>
                      <input
                        type="text"
                        required
                        value={branch.name}
                        onChange={(e) => handleUpdateBranch(branch.id, { name: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground">
                        Street Address (optional)
                      </label>
                      <input
                        type="text"
                        value={branch.address ?? ""}
                        onChange={(e) => handleUpdateBranch(branch.id, { address: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-muted-foreground">Phone</label>
                        <input
                          type="text"
                          value={branch.phone ?? ""}
                          onChange={(e) => handleUpdateBranch(branch.id, { phone: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-1.5 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-muted-foreground">
                          Google Maps URL (optional)
                        </label>
                        <input
                          type="url"
                          value={branch.mapsUrl ?? ""}
                          onChange={(e) => handleUpdateBranch(branch.id, { mapsUrl: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-1.5 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </form>
        )}

        {/* TAB 5: ORDER SETTINGS & SECURITY */}
        {activeTab === "settings" && settings && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <div>
                <h2 className="font-display text-xl font-medium">Order &amp; Availability Settings</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Control public ordering status, allowed service channels, prep estimates, and fees.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
                <div>
                  <p className="text-sm font-medium">Accept Customer Orders</p>
                  <p className="text-xs text-muted-foreground">
                    Pause or resume online checkout across the website
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdateSettings({ orderingEnabled: !settings.orderingEnabled })}
                  className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    settings.orderingEnabled
                      ? "bg-foreground text-background"
                      : "border border-destructive/40 bg-destructive/10 text-destructive"
                  }`}
                >
                  {settings.orderingEnabled ? "Open" : "Paused"}
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Paused Ordering Notice
                </label>
                <input
                  type="text"
                  defaultValue={settings.closedMessage}
                  onBlur={(e) => handleUpdateSettings({ closedMessage: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-2.5">
                <p className="text-xs font-medium text-muted-foreground">Enabled Order Types</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateSettings({ dineInEnabled: !settings.dineInEnabled })}
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                      settings.dineInEnabled
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    Dine-in: {settings.dineInEnabled ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateSettings({ takeawayEnabled: !settings.takeawayEnabled })
                    }
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                      settings.takeawayEnabled
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    Takeaway: {settings.takeawayEnabled ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateSettings({ deliveryEnabled: !settings.deliveryEnabled })
                    }
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                      settings.deliveryEnabled
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    Delivery: {settings.deliveryEnabled ? "On" : "Off"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs text-muted-foreground">Prep Time (mins)</label>
                  <input
                    type="number"
                    min={5}
                    defaultValue={settings.estimatedPrepMinutes}
                    onBlur={(e) =>
                      handleUpdateSettings({ estimatedPrepMinutes: Number(e.target.value) || 25 })
                    }
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">Delivery Fee (EGP)</label>
                  <input
                    type="number"
                    min={0}
                    defaultValue={settings.deliveryFeeEgp}
                    onBlur={(e) =>
                      handleUpdateSettings({
                        deliveryFeeEgp: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">Minimum Order (EGP)</label>
                  <input
                    type="number"
                    min={0}
                    defaultValue={settings.minimumOrderEgp}
                    onBlur={(e) =>
                      handleUpdateSettings({
                        minimumOrderEgp: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-display text-xl font-medium">Admin Security</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {envManagedPassword
                    ? "Admin credentials are managed by server environment variables (ADMIN_USERNAME / ADMIN_PASSWORD)."
                    : "Update the administrator email/username or password. Stored as a salted scrypt hash on the server."}
                </p>

                {!envManagedPassword && (
                  <form onSubmit={handleChangeCredentials} className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs text-muted-foreground">
                        Current Password
                      </label>
                      <input
                        type="password"
                        required
                        value={currentPwd}
                        onChange={(e) => setCurrentPwd(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground">
                        New Email / Username (optional)
                      </label>
                      <input
                        type="text"
                        placeholder={adminUsername || "admin@kimurasushi.com"}
                        value={newUsernameInput}
                        onChange={(e) => setNewUsernameInput(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground">
                        New Password (min 8 chars, optional if only updating username)
                      </label>
                      <input
                        type="password"
                        minLength={8}
                        value={newPwd}
                        onChange={(e) => setNewPwd(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    {pwdMsg && <p className="text-xs font-medium text-foreground">{pwdMsg}</p>}
                    <button
                      type="submit"
                      className="cursor-pointer rounded-full bg-foreground px-5 py-2 text-xs font-medium text-background"
                    >
                      Update Credentials
                    </button>
                  </form>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-display text-lg font-medium">Reset Official Menu</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Restore all categories, dishes, descriptions, and default stock from the official
                  menu without deleting incoming orders.
                </p>
                <button
                  type="button"
                  onClick={handleResetMenu}
                  className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <RotateCcw className="size-3.5" />
                  Restore Default Menu &amp; Settings
                </button>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Lightbox Modal for Payment Proof Screenshots */}
      {screenshotModalUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Payment screenshot inspection"
          onClick={() => setScreenshotModalUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-2xl"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-medium text-foreground">
                Customer Payment Screenshot
              </span>
              <button
                type="button"
                onClick={() => setScreenshotModalUrl(null)}
                aria-label="Close screenshot preview"
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <img
              src={screenshotModalUrl}
              alt="Customer payment proof"
              className="max-h-[78vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
