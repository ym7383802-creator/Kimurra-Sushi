"use client";

import * as React from "react";
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  Copy,
  ImagePlus,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  DEFAULT_BRAND_LOGO,
  DEFAULT_BUSINESS_PHONE,
  DRAGON_WARNING_MESSAGE,
  MINIMUM_SUSHI_PIECES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  buildWhatsAppOrderUrl,
  isIndividualSushiCategoryName,
  type BusinessInfo,
  type CustomerOrder,
  type OrderSettings,
  type PaymentMethod,
  type SelectedComboPiece,
  type ServiceType,
  type KimuraSushiDish,
  type WhatsAppDeliveryInfo,
} from "@/lib/kimura-sushi-menu";

export interface OrderLine {
  key: string;
  dish: KimuraSushiDish;
  categoryName: string;
  variantLabel: string;
  unitPrice: number;
  originalUnitPrice?: number;
  appliedOfferTitle?: string;
  quantity: number;
  selectedPieces?: SelectedComboPiece[];
}

interface OrderTrayDrawerProps {
  open: boolean;
  onClose: () => void;
  lines: OrderLine[];
  settings: OrderSettings;
  businessInfo: BusinessInfo;
  onUpdateQuantity: (lineKey: string, delta: number) => void;
  onRemoveLine: (lineKey: string) => void;
  onEditComboLine?: (line: OrderLine) => void;
  onClearOrder: () => void;
  onOrderSuccess: () => void;
  onMinimumSushiBlocked?: (count: number) => void;
}

export function OrderTrayDrawer({
  open,
  onClose,
  lines,
  settings,
  businessInfo,
  onUpdateQuantity,
  onRemoveLine,
  onEditComboLine,
  onClearOrder,
  onOrderSuccess,
  onMinimumSushiBlocked,
}: OrderTrayDrawerProps) {
  const availableServiceOptions = React.useMemo<ServiceType[]>(() => {
    const opts: ServiceType[] = [];
    if (settings.dineInEnabled) opts.push("Dine-in · Main Hall");
    if (settings.takeawayEnabled) opts.push("Takeaway · Counter Pickup");
    if (settings.deliveryEnabled) opts.push("Delivery · Local Order");
    return opts;
  }, [settings.dineInEnabled, settings.takeawayEnabled, settings.deliveryEnabled]);

  const [serviceType, setServiceType] = React.useState<ServiceType>("Delivery · Local Order");
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [deliveryAddress, setDeliveryAddress] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash_on_delivery");
  const [paymentReference, setPaymentReference] = React.useState("");
  const [paymentScreenshotUrl, setPaymentScreenshotUrl] = React.useState("");
  const [uploadingProof, setUploadingProof] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = React.useState<CustomerOrder | null>(null);
  const [whatsappDelivery, setWhatsappDelivery] = React.useState<WhatsAppDeliveryInfo | null>(null);
  const [prepMinutes, setPrepMinutes] = React.useState<number>(settings.estimatedPrepMinutes);
  const closeBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const proofInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (availableServiceOptions.length > 0 && !availableServiceOptions.includes(serviceType)) {
      setServiceType(availableServiceOptions[0]);
    }
  }, [availableServiceOptions, serviceType]);

  React.useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  React.useEffect(() => {
    if (lines.length > 0 && confirmedOrder) {
      setConfirmedOrder(null);
      setWhatsappDelivery(null);
    }
  }, [lines.length, confirmedOrder]);

  if (!open) return null;

  const vodafoneNumber =
    businessInfo.vodafoneCashNumber || businessInfo.phone || DEFAULT_BUSINESS_PHONE;
  const instaPayIdentifier =
    businessInfo.instaPayIdentifier || businessInfo.phone || DEFAULT_BUSINESS_PHONE;

  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);
  const individualSushiCount = lines
    .filter((line) => isIndividualSushiCategoryName(line.categoryName, Boolean(line.dish.comboConfig)))
    .reduce((sum, line) => sum + line.quantity, 0);
  const belowMinSushi = individualSushiCount > 0 && individualSushiCount < MINIMUM_SUSHI_PIECES;

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const totalSavings = lines.reduce((sum, line) => {
    if (line.originalUnitPrice && line.originalUnitPrice > line.unitPrice) {
      return sum + (line.originalUnitPrice - line.unitPrice) * line.quantity;
    }
    return sum;
  }, 0);

  const deliveryFee =
    serviceType === "Delivery · Local Order" ? Math.max(0, settings.deliveryFeeEgp) : 0;
  const total = subtotal + deliveryFee;
  const belowMinimum = settings.minimumOrderEgp > 0 && subtotal < settings.minimumOrderEgp;
  const requiresTransferProof =
    paymentMethod === "vodafone_cash" || paymentMethod === "instapay";

  const handleCopyNumber = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(key);
      window.setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2200);
    } catch {
      // Fallback ignored if clipboard unavailable
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setErrorMsg("يرجى اختيار صورة التحويل بصيغة PNG أو JPG أو WebP.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg("حجم صورة التحويل يجب ألا يتعدى 4 ميجابايت.");
      return;
    }

    setErrorMsg(null);
    setUploadingProof(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/uploads/payment-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const payload = (await res.json()) as { mediaUrl?: string; error?: string };
      if (!res.ok || !payload.mediaUrl) {
        setErrorMsg(payload.error || "تعذر رفع صورة التحويل.");
        return;
      }
      setPaymentScreenshotUrl(payload.mediaUrl);
    } catch {
      setErrorMsg("حدث خطأ أثناء رفع صورة التحويل.");
    } finally {
      setUploadingProof(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0 || submitting || uploadingProof) return;

    if (belowMinSushi) {
      onMinimumSushiBlocked?.(individualSushiCount);
      setErrorMsg(DRAGON_WARNING_MESSAGE);
      return;
    }

    if (serviceType === "Delivery · Local Order" && !deliveryAddress.trim()) {
      setErrorMsg("يرجى كتابة عنوان التوصيل بالكامل.");
      return;
    }

    if (requiresTransferProof && paymentReference.trim().length < 4 && !paymentScreenshotUrl) {
      setErrorMsg("يرجى إدخال رقم مرجع التحويل أو إرفاق صورة التحويل أولاً.");
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          customerName,
          customerPhone,
          deliveryAddress: serviceType === "Delivery · Local Order" ? deliveryAddress : "",
          notes,
          paymentMethod,
          paymentReference: requiresTransferProof ? paymentReference : "",
          paymentScreenshotUrl: requiresTransferProof ? paymentScreenshotUrl : "",
          items: lines.map((line) => ({
            dishId: line.dish.id,
            variantLabel: line.variantLabel,
            quantity: line.quantity,
            ...(line.selectedPieces && line.selectedPieces.length > 0
              ? { selectedPieces: line.selectedPieces.map((p) => p.dishId) }
              : {}),
          })),
        }),
      });

      const payload = (await response.json()) as {
        order?: CustomerOrder;
        estimatedPrepMinutes?: number;
        whatsappDelivery?: WhatsAppDeliveryInfo;
        error?: string;
      };

      if (!response.ok || !payload.order) {
        setErrorMsg(payload.error || "Unable to place your order. Please try again.");
        setSubmitting(false);
        return;
      }

      setConfirmedOrder(payload.order);
      setWhatsappDelivery(payload.whatsappDelivery ?? payload.order.whatsappDelivery ?? null);
      setPrepMinutes(payload.estimatedPrepMinutes ?? settings.estimatedPrepMinutes);
      setNotes("");
      setPaymentReference("");
      setPaymentScreenshotUrl("");
      onClearOrder();
      onOrderSuccess();
    } catch {
      setErrorMsg("Network error while sending order. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const waFallbackHref = confirmedOrder
    ? whatsappDelivery?.waMeUrl ||
      buildWhatsAppOrderUrl(
        businessInfo.whatsapp || businessInfo.phone || DEFAULT_BUSINESS_PHONE,
        confirmedOrder,
        businessInfo.businessName,
      )
    : "#";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-tray-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-background/75 backdrop-blur-sm"
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 id="order-tray-title" className="font-display text-xl font-medium tracking-tight">
              {businessInfo.businessName} Order
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {totalItems} {totalItems === 1 ? "item" : "items"} selected
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close order tray"
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {confirmedOrder ? (
            <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-background p-6">
              <CheckCircle2 className="size-7 text-chart-3" />
              <div className="w-full space-y-2.5">
                <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
                  Ticket {confirmedOrder.id}
                </p>
                <h3 className="font-display text-xl font-medium">
                  Order saved at {businessInfo.businessName}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Thank you, <span className="font-medium text-foreground">{confirmedOrder.customerName}</span>. Total:{" "}
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    {confirmedOrder.total.toLocaleString()} EGP
                  </span>{" "}
                  ({confirmedOrder.serviceType}). Estimated prep: ~{prepMinutes} mins.
                </p>

                <div dir="rtl" className="rounded-xl border border-border bg-card p-3.5 text-right text-xs space-y-1">
                  <p className="font-medium text-foreground">
                    طريقة الدفع: {PAYMENT_METHOD_LABELS[confirmedOrder.paymentMethod].ar}
                  </p>
                  <p className="text-muted-foreground">
                    حالة الدفع:{" "}
                    <span className="font-semibold text-foreground">
                      {PAYMENT_STATUS_LABELS[confirmedOrder.paymentStatus].ar}
                    </span>
                  </p>
                  {confirmedOrder.paymentReference && (
                    <p className="font-mono text-muted-foreground">
                      المرجع: {confirmedOrder.paymentReference}
                    </p>
                  )}
                </div>

                {confirmedOrder.items.some((i) => i.selectedPieces && i.selectedPieces.length > 0) && (
                  <div className="space-y-2 border-t border-border pt-3 text-xs">
                    {confirmedOrder.items
                      .filter((i) => i.selectedPieces && i.selectedPieces.length > 0)
                      .map((item, idx) => (
                        <div key={`${item.dishId}-${idx}`}>
                          <p className="font-medium text-foreground">
                            {item.quantity}× {item.dishName} ({item.selectedPieces!.length} pcs):
                          </p>
                          <p className="mt-0.5 text-muted-foreground">
                            {item.selectedPieces!.map((p, sIdx) => `#${sIdx + 1} ${p.dishName}`).join(", ")}
                          </p>
                        </div>
                      ))}
                  </div>
                )}

                {/* Honest WhatsApp Delivery Status & One-Tap Prefilled Link */}
                <div dir="rtl" className="rounded-xl border border-border bg-secondary/40 p-3.5 text-right space-y-2.5">
                  {whatsappDelivery?.status === "sent" ? (
                    <p className="text-xs font-medium text-foreground">
                      تم إرسال تفاصيل طلبك تلقائياً إلى واتساب المطعم ({businessInfo.whatsapp || DEFAULT_BUSINESS_PHONE}).
                    </p>
                  ) : (
                    <>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        تم حفظ الطلب بنجاح في نظام المطعم. لإرسال نسخة كاملة فوراً إلى واتساب {businessInfo.businessName} ({businessInfo.whatsapp || DEFAULT_BUSINESS_PHONE}) اضغط الزر بالأسفل:
                      </p>
                      <a
                        href={waFallbackHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        <MessageCircle className="size-4" />
                        <span>إرسال الطلب عبر واتساب ({businessInfo.whatsapp || DEFAULT_BUSINESS_PHONE})</span>
                      </a>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setConfirmedOrder(null);
                  setWhatsappDelivery(null);
                  onClose();
                }}
                className="mt-1 inline-flex cursor-pointer items-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Back to menu
              </button>
            </div>
          ) : lines.length === 0 ? (
            <div className="flex h-full min-h-[16rem] flex-col items-center justify-center text-center">
              <p className="font-display text-lg font-medium text-foreground">Your order tray is empty</p>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                Pick any plate from the conveyor belt or open a category in the menu to add dishes to your order.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 inline-flex cursor-pointer items-center rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Browse menu
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <ul className="divide-y divide-border">
                {lines.map((line) => {
                  const lineTotal = line.unitPrice * line.quantity;
                  const isCustomCombo = Boolean(line.selectedPieces && line.selectedPieces.length > 0);
                  return (
                    <li key={line.key} className="flex items-start justify-between gap-4 py-4 first:pt-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{line.dish.name}</p>
                          <div className="text-right shrink-0">
                            {line.originalUnitPrice && line.originalUnitPrice > line.unitPrice && (
                              <span className="mr-1.5 font-mono text-[11px] line-through tabular-nums text-muted-foreground">
                                {(line.originalUnitPrice * line.quantity).toLocaleString()}
                              </span>
                            )}
                            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                              {lineTotal.toLocaleString()} EGP
                            </span>
                          </div>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {line.categoryName}
                          {isCustomCombo
                            ? ` · ${line.selectedPieces!.length} قطعة`
                            : line.variantLabel !== "Regular"
                              ? ` · ${line.variantLabel}`
                              : ""}
                          <span className="font-mono tabular-nums"> · {line.unitPrice.toLocaleString()} EGP each</span>
                        </p>
                        {line.appliedOfferTitle && (
                          <p className="mt-0.5 text-[11px] font-medium text-destructive">
                            Offer: {line.appliedOfferTitle}
                          </p>
                        )}

                        {isCustomCombo && (
                          <div dir="rtl" className="mt-2.5 rounded-xl border border-border bg-background/80 p-2.5 text-right">
                            <p className="text-[11px] font-medium text-muted-foreground">
                              القطع المختارة ({line.selectedPieces!.length} قطعة)
                            </p>
                            <ol className="mt-1.5 grid grid-cols-1 gap-1 text-xs text-foreground">
                              {line.selectedPieces!.map((piece, slotIdx) => (
                                <li key={`${line.key}-slot-${slotIdx}`} className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-mono text-[10px] font-semibold text-muted-foreground tabular-nums shrink-0">
                                    #{slotIdx + 1}
                                  </span>
                                  <span className="truncate">{piece.dishName}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="inline-flex items-center rounded-full border border-border bg-background">
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(line.key, -1)}
                                aria-label={`Decrease quantity of ${line.dish.name}`}
                                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <Minus className="size-3.5" />
                              </button>
                              <span className="w-7 text-center font-mono text-xs font-medium tabular-nums">
                                {line.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(line.key, 1)}
                                aria-label={`Increase quantity of ${line.dish.name}`}
                                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <Plus className="size-3.5" />
                              </button>
                            </div>

                            {isCustomCombo && onEditComboLine && (
                              <button
                                type="button"
                                dir="rtl"
                                onClick={() => onEditComboLine(line)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary"
                              >
                                <Pencil className="size-3" />
                                <span>تعديل القطع</span>
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => onRemoveLine(line.key)}
                            aria-label={`Remove ${line.dish.name}`}
                            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {!confirmedOrder && (
                <form onSubmit={handleSubmitOrder} className="border-t border-border pt-5 space-y-4">
                  {!settings.orderingEnabled ? (
                    <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{settings.closedMessage}</span>
                    </div>
                  ) : (
                    <>
                      {belowMinSushi && (
                        <div
                          dir="rtl"
                          className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/50 p-3.5 text-right"
                        >
                          <img
                            src={businessInfo.logoUrl || DEFAULT_BRAND_LOGO}
                            alt="تنين كيمورا سوشي"
                            className="h-14 w-auto shrink-0 object-contain select-none"
                          />
                          <p className="text-xs font-semibold leading-relaxed text-foreground">
                            {DRAGON_WARNING_MESSAGE}
                          </p>
                        </div>
                      )}

                      {errorMsg && !belowMinSushi && (
                        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                          <AlertCircle className="mt-0.5 size-4 shrink-0" />
                          <span>{errorMsg}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <div>
                          <label htmlFor="customer-name" className="block text-[11px] font-medium text-muted-foreground">
                            Your Name
                          </label>
                          <input
                            id="customer-name"
                            type="text"
                            required
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Full name"
                            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div>
                          <label htmlFor="customer-phone" className="block text-[11px] font-medium text-muted-foreground">
                            Phone Number
                          </label>
                          <input
                            id="customer-phone"
                            type="tel"
                            required
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="01xxxxxxxxx"
                            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="service-type-select" className="block text-[11px] font-medium text-muted-foreground">
                          Order Type
                        </label>
                        <select
                          id="service-type-select"
                          value={serviceType}
                          onChange={(e) => setServiceType(e.target.value as ServiceType)}
                          disabled={availableServiceOptions.length === 0}
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {availableServiceOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      {serviceType === "Delivery · Local Order" && (
                        <div>
                          <label htmlFor="delivery-address" className="block text-[11px] font-medium text-muted-foreground">
                            Delivery Address (Required)
                          </label>
                          <input
                            id="delivery-address"
                            type="text"
                            required
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Area, street, building, floor, apartment"
                            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          {businessInfo.deliveryInfo && (
                            <p className="mt-1 text-xs text-muted-foreground">{businessInfo.deliveryInfo}</p>
                          )}
                        </div>
                      )}

                      <div>
                        <label htmlFor="order-notes" className="block text-[11px] font-medium text-muted-foreground">
                          Notes / Special Requests (optional)
                        </label>
                        <input
                          id="order-notes"
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Extra soy sauce, ginger, chopstick count, etc."
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>

                      {/* Payment Method Selection */}
                      <div dir="rtl" className="space-y-3 rounded-2xl border border-border bg-background/80 p-3.5 text-right">
                        <p className="text-xs font-semibold text-foreground">طريقة الدفع</p>

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMethod("vodafone_cash");
                              setErrorMsg(null);
                            }}
                            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition-colors ${
                              paymentMethod === "vodafone_cash"
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-card text-foreground hover:bg-secondary"
                            }`}
                          >
                            <Smartphone className="size-4" />
                            <span>فودافون كاش</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMethod("instapay");
                              setErrorMsg(null);
                            }}
                            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition-colors ${
                              paymentMethod === "instapay"
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-card text-foreground hover:bg-secondary"
                            }`}
                          >
                            <Wallet className="size-4" />
                            <span>إنستاباي</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMethod("cash_on_delivery");
                              setErrorMsg(null);
                            }}
                            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition-colors ${
                              paymentMethod === "cash_on_delivery"
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-card text-foreground hover:bg-secondary"
                            }`}
                          >
                            <Banknote className="size-4" />
                            <span>عند الاستلام</span>
                          </button>
                        </div>

                        {paymentMethod === "vodafone_cash" && (
                          <div className="space-y-2.5 border-t border-border pt-3 text-xs">
                            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
                              <div>
                                <p className="text-[10px] text-muted-foreground">رقم فودافون كاش</p>
                                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                                  {vodafoneNumber}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyNumber("vc", vodafoneNumber)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-secondary"
                              >
                                {copiedId === "vc" ? (
                                  <>
                                    <Check className="size-3" />
                                    <span>تم النسخ</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3" />
                                    <span>نسخ الرقم</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <p className="leading-relaxed text-muted-foreground">
                              حوّل مبلغ <strong className="text-foreground">{total.toLocaleString()} ج.م</strong> على رقم فودافون كاش الموضح، ثم أدخل رقم مرجع العملية أو ارفع صورة التحويل. يظل الطلب قيد مراجعة الدفع حتى تأكيد الإدارة.
                            </p>
                          </div>
                        )}

                        {paymentMethod === "instapay" && (
                          <div className="space-y-2.5 border-t border-border pt-3 text-xs">
                            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
                              <div>
                                <p className="text-[10px] text-muted-foreground">الرقم المسجل على إنستاباي</p>
                                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                                  {instaPayIdentifier}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyNumber("ip", instaPayIdentifier)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-secondary"
                              >
                                {copiedId === "ip" ? (
                                  <>
                                    <Check className="size-3" />
                                    <span>تم النسخ</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3" />
                                    <span>نسخ الرقم</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <p className="leading-relaxed text-muted-foreground">
                              افتح تطبيق إنستاباي وحوّل مبلغ <strong className="text-foreground">{total.toLocaleString()} ج.م</strong> إلى الرقم الموضح أعلاه، ثم أدخل رقم مرجع التحويل أو ارفع صورة التحويل للمراجعة.
                            </p>
                          </div>
                        )}

                        {paymentMethod === "cash_on_delivery" && (
                          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                            الدفع نقداً عند استلام الطلب بدون أي تحويل مسبق أو رفع صور.
                          </p>
                        )}

                        {requiresTransferProof && (
                          <div className="space-y-2.5 pt-1">
                            <div>
                              <label htmlFor="payment-ref" className="block text-[11px] font-medium text-muted-foreground">
                                رقم مرجع العملية / التحويل
                              </label>
                              <input
                                id="payment-ref"
                                type="text"
                                value={paymentReference}
                                onChange={(e) => setPaymentReference(e.target.value)}
                                placeholder="مثال: 84920145"
                                className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </div>

                            <div className="space-y-2">
                              <input
                                ref={proofInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={handleScreenshotUpload}
                                className="hidden"
                              />
                              <button
                                type="button"
                                disabled={uploadingProof}
                                onClick={() => proofInputRef.current?.click()}
                                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                              >
                                <ImagePlus className="size-4" />
                                <span>
                                  {uploadingProof
                                    ? "جاري رفع صورة التحويل..."
                                    : paymentScreenshotUrl
                                      ? "تغيير صورة التحويل"
                                      : "رفع صورة التحويل (Screenshot)"}
                                </span>
                              </button>

                              {paymentScreenshotUrl && (
                                <div className="relative overflow-hidden rounded-xl border border-border bg-card p-2">
                                  <img
                                    src={paymentScreenshotUrl}
                                    alt="صورة التحويل المرفوعة"
                                    className="max-h-36 w-full rounded-lg object-contain"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setPaymentScreenshotUrl("")}
                                    aria-label="حذف صورة التحويل"
                                    className="absolute top-3 left-3 inline-flex size-7 cursor-pointer items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <dt>Subtotal</dt>
                      <dd className="font-mono tabular-nums">{subtotal.toLocaleString()} EGP</dd>
                    </div>
                    {totalSavings > 0 && (
                      <div className="flex justify-between text-destructive">
                        <dt>Offers Savings</dt>
                        <dd className="font-mono tabular-nums">-{totalSavings.toLocaleString()} EGP</dd>
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <dt>Delivery fee</dt>
                        <dd className="font-mono tabular-nums">{deliveryFee.toLocaleString()} EGP</dd>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-medium text-foreground">
                      <dt>Order Total</dt>
                      <dd className="font-mono tabular-nums">{total.toLocaleString()} EGP</dd>
                    </div>
                  </dl>

                  {belowMinimum && (
                    <p className="text-xs text-destructive">
                      Minimum order amount is {settings.minimumOrderEgp.toLocaleString()} EGP.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      !settings.orderingEnabled ||
                      availableServiceOptions.length === 0 ||
                      belowMinimum ||
                      submitting ||
                      uploadingProof
                    }
                    className="w-full cursor-pointer rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {submitting ? "Sending order..." : `Place order · ${total.toLocaleString()} EGP`}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
