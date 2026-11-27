"use client";

import * as React from "react";
import {
  ArrowRight,
  Ban,
  Box,
  Check,
  CheckCircle2,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  getBestOfferForItem,
  type ComboBoxConfig,
  type MenuOffer,
  type SelectedComboPiece,
  type KimuraSushiCategory,
  type KimuraSushiDish,
} from "@/lib/kimura-sushi-menu";

export interface ActiveComboEdit {
  lineKey?: string;
  comboDishId: string;
  initialPieces?: SelectedComboPiece[];
}

interface ComboBoxBuilderProps {
  categories: KimuraSushiCategory[];
  offers: MenuOffer[];
  businessName: string;
  orderingEnabled: boolean;
  activeSelection: ActiveComboEdit | null;
  onSelectCombo: (selection: ActiveComboEdit | null) => void;
  onBackToMenu: () => void;
  onCompleteCombo: (payload: {
    comboDish: KimuraSushiDish;
    categoryName: string;
    selectedPieces: SelectedComboPiece[];
    computedPrice: number;
    originalPrice?: number;
    appliedOfferTitle?: string;
    replaceLineKey?: string;
  }) => void;
}

interface EligiblePieceOption {
  categoryId: string;
  categoryName: string;
  categoryCoverImage: string;
  dish: KimuraSushiDish;
  unitPrice: number;
}

type SlotGroupKind = "exact-30" | "raw-special" | "fried-special" | "old-menu";

interface SlotSectionDef {
  kind: SlotGroupKind;
  titleAr: string;
  tabLabel: string;
  subtitleAr: string;
  allowedCategoryIds: string[];
  exactPiecePrice?: number;
  minCount: number;
  isExpandable: boolean;
}

type SectionBuckets = Record<SlotGroupKind, SelectedComboPiece[]>;

interface ReplaceTarget {
  kind: SlotGroupKind;
  dishId: string;
  dishName: string;
}

interface GroupedSelectedDish {
  dishId: string;
  dishName: string;
  unitPrice: number;
  quantity: number;
}

interface BoxArabicGuide {
  howToOrder: string;
  whatsInside: string;
  availablePieces: string;
  unavailablePieces: string;
  ruleSummary: string;
  shortInsideAr: string;
}

const COMBO_BOX_IMAGES: Record<string, string> = {
  "combo-mini-box": "/src/assets/images/combo_mini_box_1795699926860.jpg",
  "combo-solo-box": "/src/assets/images/combo_solo_box_1795700046654.jpg",
  "combo-tokyo-box": "/src/assets/images/combo_tokyo_box_1795699926727.jpg",
  "combo-classic-box": "/src/assets/images/combo_classic_box_1795699927140.jpg",
  "combo-double-box": "/src/assets/images/combo_double_box_1795699927185.jpg",
  "combo-kimura-box": "/src/assets/images/combo_kimura_box_1795699927136.jpg",
  "combo-samurai-box": "/src/assets/images/combo_samurai_box_1795699927736.jpg",
  "combo-friends-box": "/src/assets/images/combo_friends_box_1795699926903.jpg",
  "combo-family-box": "/src/assets/images/combo_family_box_1795699927653.jpg",
  "combo-party-box": "/src/assets/images/combo_party_box_1795699986868.jpg",
};

function createEmptyBuckets(): SectionBuckets {
  return {
    "exact-30": [],
    "raw-special": [],
    "fried-special": [],
    "old-menu": [],
  };
}

function getMaxAllowedForSection(
  kind: SlotGroupKind,
  buckets: SectionBuckets,
  sections: SlotSectionDef[],
  requiredPieces: number,
): number {
  let otherCommitted = 0;
  for (const sec of sections) {
    if (sec.kind === kind) continue;
    otherCommitted += Math.max(sec.minCount, buckets[sec.kind].length);
  }
  return Math.max(0, requiredPieces - otherCommitted);
}

function resolveSectionForCategory(
  categoryId: string,
  sections: SlotSectionDef[],
): SlotGroupKind {
  const exact = sections.find((s) => s.kind === "exact-30");
  if (exact) return "exact-30";
  const matched = sections.find((s) => s.allowedCategoryIds.includes(categoryId));
  return matched?.kind ?? sections[0]?.kind ?? "old-menu";
}

function groupPiecesByDish(pieces: SelectedComboPiece[]): GroupedSelectedDish[] {
  const map = new Map<string, GroupedSelectedDish>();
  for (const piece of pieces) {
    const existing = map.get(piece.dishId);
    if (existing) {
      existing.quantity += 1;
    } else {
      map.set(piece.dishId, {
        dishId: piece.dishId,
        dishName: piece.dishName,
        unitPrice: piece.unitPrice,
        quantity: 1,
      });
    }
  }
  return Array.from(map.values());
}

function getBoxArabicGuide(
  combo: KimuraSushiDish,
  cfg: ComboBoxConfig,
  categories: KimuraSushiCategory[],
  effectivePriceDisplay: string,
): BoxArabicGuide {
  const total = cfg.requiredPieces;
  if (cfg.exactPiecePrice !== undefined) {
    const exactPrice = cfg.exactPiecePrice;
    const allowedSet = new Set(cfg.allowedCategoryIds);
    const eligible30Names: string[] = [];
    const excludedNames: string[] = [];

    for (const cat of categories) {
      if (!allowedSet.has(cat.id)) continue;
      for (const dish of cat.dishes) {
        const price = dish.variants[0]?.price ?? 0;
        if (price === exactPrice) {
          eligible30Names.push(dish.name);
        } else {
          excludedNames.push(`${dish.name} (${price} ج.م)`);
        }
      }
    }

    return {
      howToOrder: `اختار ${total} قطع بالظبط من القائمة المتاحة، وتقدر تكرر نفس القطعة أو تنوع بين القطع، ولما تكمل الـ ${total} قطع اضغط "أضف البوكس للسلة".`,
      whatsInside: `${combo.name} فيه ${total} قطع سوشي بسعر إجمالي ${effectivePriceDisplay} ج.م (الحد الأدنى والأقصى ${total} قطع).`,
      availablePieces: `متاح ليك فقط القطع اللي سعرها ${exactPrice} ج.م للقطعة (${eligible30Names.join("، ")}).`,
      unavailablePieces: `غير متاح في البوكس ده أي قطعة سعرها مختلف عن ${exactPrice} ج.م (مثل: ${excludedNames.join("، ")})، والنودلز مش متاحة جوه البوكس.`,
      ruleSummary: `${total} قطع بـ ${exactPrice} ج.م للقطعة`,
      shortInsideAr: `اختار ${total} قطع بسعر ${exactPrice} ج.م للقطعة فقط.`,
    };
  }

  const minRaw = cfg.minRawSpecial ?? 4;
  const minFried = cfg.minFriedSpecial ?? 4;
  const remainingFlex = Math.max(0, total - minRaw - minFried);

  return {
    howToOrder: `اختار إجمالي ${total} قطعة: على الأقل ${minRaw} قطع من Raw Special Rolls، وعلى الأقل ${minFried} قطع من Fried Special Rolls، وتقدر تزود 5 أو 6 قطع أو أكتر في أي قسم سبيشيال أو تكمل من Old Menu حسب السعة المتبقية.`,
    whatsInside: `${combo.name} بسعر ${effectivePriceDisplay} ج.م: الحد الأدنى ${minRaw} رو + الحد الأدنى ${minFried} فرايد سبيشيال، والحد الأقصى لإجمالي البوكس ${total} قطعة.`,
    availablePieces: `متاح ليك كل قطع Raw Special Rolls (حد أدنى ${minRaw})، وكل قطع Fried Special Rolls (حد أدنى ${minFried})، وكل قطع Old Menu لتكملة السعة المتبقية (${remainingFlex} قطعة إضافية أو أكثر حسب اختيارك).`,
    unavailablePieces: `ممنوع اختيار النودلز أو بوكسات تانية جوه البوكس، وممنوع يقل Raw Special أو Fried Special عن ${minRaw} قطع أو يزيد الإجمالي عن ${total} قطعة.`,
    ruleSummary: `حد أدنى ${minRaw} رو + ${minFried} فرايد · أقصى سعة ${total} قطعة`,
    shortInsideAr: `حد أدنى ${minRaw} رو سبيشيال + ${minFried} فرايد سبيشيال (${total} قطعة).`,
  };
}

function buildSlotSections(cfg: ComboBoxConfig): SlotSectionDef[] {
  if (cfg.exactPiecePrice !== undefined) {
    return [
      {
        kind: "exact-30",
        titleAr: `قطع بسعر ${cfg.exactPiecePrice} ج.م`,
        tabLabel: `قطع ${cfg.exactPiecePrice} ج.م`,
        subtitleAr: `مطلوب ${cfg.requiredPieces} قطع بسعر ${cfg.exactPiecePrice} ج.م فقط`,
        allowedCategoryIds: cfg.allowedCategoryIds,
        exactPiecePrice: cfg.exactPiecePrice,
        minCount: cfg.requiredPieces,
        isExpandable: false,
      },
    ];
  }

  const minRaw = cfg.minRawSpecial ?? 4;
  const minFried = cfg.minFriedSpecial ?? 4;
  const remainingFlex = Math.max(0, cfg.requiredPieces - minRaw - minFried);
  const remainingCat = cfg.remainingCategoryId ?? "old-menu";

  const sections: SlotSectionDef[] = [
    {
      kind: "raw-special",
      titleAr: "Raw Special Rolls",
      tabLabel: "Raw Special",
      subtitleAr: `الحد الأدنى ${minRaw} قطع — يمكنك الزيادة حسب السعة المتبقية`,
      allowedCategoryIds: ["raw-special-rolls"],
      minCount: minRaw,
      isExpandable: true,
    },
    {
      kind: "fried-special",
      titleAr: "Fried Special Rolls",
      tabLabel: "Fried Special",
      subtitleAr: `الحد الأدنى ${minFried} قطع — يمكنك الزيادة حسب السعة المتبقية`,
      allowedCategoryIds: ["fried-special-rolls"],
      minCount: minFried,
      isExpandable: true,
    },
  ];

  if (remainingFlex > 0) {
    sections.push({
      kind: "old-menu",
      titleAr: "Old Menu · اختيار حر",
      tabLabel: "Old Menu",
      subtitleAr: "اختيار حر للسعة المتبقية",
      allowedCategoryIds: [remainingCat],
      minCount: 0,
      isExpandable: true,
    });
  }

  return sections;
}

function buildInitialBuckets(
  cfg: ComboBoxConfig,
  sections: SlotSectionDef[],
  categories: KimuraSushiCategory[],
  initialPieces?: SelectedComboPiece[],
): { buckets: SectionBuckets; activeKind: SlotGroupKind } {
  const buckets = createEmptyBuckets();

  if (cfg.exactPiecePrice !== undefined) {
    buckets["exact-30"] = (initialPieces ?? []).slice(0, cfg.requiredPieces);
    return { buckets, activeKind: "exact-30" };
  }

  const dishCategoryMap = new Map<string, string>();
  for (const cat of categories) {
    for (const dish of cat.dishes) {
      dishCategoryMap.set(dish.id, cat.id);
    }
  }

  if (initialPieces && initialPieces.length > 0) {
    for (const piece of initialPieces) {
      const catId = dishCategoryMap.get(piece.dishId) ?? "";
      const secKind = resolveSectionForCategory(catId, sections);
      buckets[secKind].push(piece);
    }
  }

  return {
    buckets,
    activeKind: sections[0]?.kind ?? "raw-special",
  };
}

export function ComboBoxBuilder({
  categories,
  offers,
  businessName,
  orderingEnabled,
  activeSelection,
  onSelectCombo,
  onBackToMenu,
  onCompleteCombo,
}: ComboBoxBuilderProps) {
  const comboCategory = React.useMemo(
    () => categories.find((cat) => cat.id === "combos") ?? null,
    [categories],
  );

  const comboBoxes = React.useMemo(
    () => (comboCategory ? comboCategory.dishes.filter((d) => Boolean(d.comboConfig)) : []),
    [comboCategory],
  );

  const selectedComboDish = React.useMemo(() => {
    if (!activeSelection || !comboCategory) return null;
    return comboBoxes.find((d) => d.id === activeSelection.comboDishId) ?? null;
  }, [activeSelection, comboBoxes, comboCategory]);

  const comboConfig = selectedComboDish?.comboConfig;

  const slotSections = React.useMemo(
    () => (comboConfig ? buildSlotSections(comboConfig) : []),
    [comboConfig],
  );

  const [buckets, setBuckets] = React.useState<SectionBuckets>(createEmptyBuckets);
  const [activeKind, setActiveKind] = React.useState<SlotGroupKind>("raw-special");
  const [replaceTarget, setReplaceTarget] = React.useState<ReplaceTarget | null>(null);

  React.useEffect(() => {
    if (!selectedComboDish || !comboConfig) {
      setBuckets(createEmptyBuckets());
      setActiveKind("raw-special");
      setReplaceTarget(null);
      return;
    }

    const { buckets: initBuckets, activeKind: initKind } = buildInitialBuckets(
      comboConfig,
      slotSections,
      categories,
      activeSelection?.initialPieces,
    );
    setBuckets(initBuckets);
    setActiveKind(initKind);
    setReplaceTarget(null);
  }, [activeSelection, selectedComboDish, comboConfig, slotSections, categories]);

  const activeSection = React.useMemo(() => {
    return slotSections.find((sec) => sec.kind === activeKind) ?? slotSections[0] ?? null;
  }, [slotSections, activeKind]);

  const eligibleForActiveSection = React.useMemo<EligiblePieceOption[]>(() => {
    if (!comboConfig || !activeSection) return [];
    const allowedSet = new Set(activeSection.allowedCategoryIds);
    const list: EligiblePieceOption[] = [];

    for (const cat of categories) {
      if (!allowedSet.has(cat.id)) continue;
      for (const dish of cat.dishes) {
        if (!dish.available || dish.stock <= 0) continue;
        const unitPrice = dish.variants[0]?.price ?? 0;
        if (
          activeSection.exactPiecePrice !== undefined &&
          unitPrice !== activeSection.exactPiecePrice
        ) {
          continue;
        }
        list.push({
          categoryId: cat.id,
          categoryName: cat.name,
          categoryCoverImage: cat.coverImage,
          dish,
          unitPrice,
        });
      }
    }
    return list;
  }, [categories, comboConfig, activeSection]);

  const selectedOfferEval = React.useMemo(() => {
    if (!selectedComboDish || !comboCategory) return null;
    const basePrice = selectedComboDish.variants[0]?.price ?? 0;
    return getBestOfferForItem({
      dishId: selectedComboDish.id,
      categoryId: comboCategory.id,
      isCombo: true,
      basePrice,
      offers,
    });
  }, [selectedComboDish, comboCategory, offers]);

  const selectedGuide = React.useMemo(() => {
    if (!selectedComboDish || !comboConfig) return null;
    const effectiveDisplay = selectedOfferEval
      ? selectedOfferEval.finalPrice.toLocaleString()
      : selectedComboDish.priceDisplay;
    return getBoxArabicGuide(selectedComboDish, comboConfig, categories, effectiveDisplay);
  }, [selectedComboDish, comboConfig, categories, selectedOfferEval]);

  const requiredPieces = comboConfig?.requiredPieces ?? 0;

  const filledCount = React.useMemo(
    () => slotSections.reduce((sum, sec) => sum + buckets[sec.kind].length, 0),
    [slotSections, buckets],
  );

  const remainingPieces = Math.max(0, requiredPieces - filledCount);
  const computedPrice = selectedOfferEval?.finalPrice ?? selectedComboDish?.variants[0]?.price ?? 0;
  const originalComboPrice =
    selectedOfferEval && selectedOfferEval.discountAmount > 0
      ? selectedOfferEval.originalPrice
      : undefined;

  const allSelectedPiecesFlat = React.useMemo(() => {
    const out: SelectedComboPiece[] = [];
    for (const sec of slotSections) {
      out.push(...buckets[sec.kind]);
    }
    return out;
  }, [slotSections, buckets]);

  const isComplete = React.useMemo(() => {
    if (!selectedComboDish || !comboConfig || requiredPieces === 0) return false;
    if (filledCount !== requiredPieces) return false;
    if (comboConfig.exactPiecePrice !== undefined) {
      const exactList = buckets["exact-30"];
      return (
        exactList.length === requiredPieces &&
        exactList.every((p) => p.unitPrice === comboConfig.exactPiecePrice)
      );
    }
    const minRaw = comboConfig.minRawSpecial ?? 4;
    const minFried = comboConfig.minFriedSpecial ?? 4;
    return (
      buckets["raw-special"].length >= minRaw &&
      buckets["fried-special"].length >= minFried
    );
  }, [selectedComboDish, comboConfig, requiredPieces, filledCount, buckets]);

  if (!comboCategory || comboBoxes.length === 0) {
    return null;
  }

  const handleSelectSectionTab = (kind: SlotGroupKind) => {
    setActiveKind(kind);
    if (replaceTarget && replaceTarget.kind !== kind) {
      setReplaceTarget(null);
    }
  };

  const handleAddPieceFromCatalog = (option: EligiblePieceOption) => {
    if (!comboConfig || !activeSection || requiredPieces <= 0) return;
    const targetKind = resolveSectionForCategory(option.categoryId, slotSections);
    const piece: SelectedComboPiece = {
      dishId: option.dish.id,
      dishName: option.dish.name,
      unitPrice: option.unitPrice,
    };

    if (replaceTarget && replaceTarget.kind === targetKind) {
      const arr = [...buckets[targetKind]];
      const idx = arr.findIndex((p) => p.dishId === replaceTarget.dishId);
      if (idx >= 0) {
        arr[idx] = piece;
        setBuckets((prev) => ({ ...prev, [targetKind]: arr }));
        setReplaceTarget(null);
        return;
      }
      setReplaceTarget(null);
    }

    const maxForSec = getMaxAllowedForSection(targetKind, buckets, slotSections, requiredPieces);
    if (buckets[targetKind].length >= maxForSec) return;

    setBuckets((prev) => ({
      ...prev,
      [targetKind]: [...prev[targetKind], piece],
    }));
  };

  const handleIncrementSelectedDish = (kind: SlotGroupKind, item: GroupedSelectedDish) => {
    if (!comboConfig || requiredPieces <= 0) return;
    const maxForSec = getMaxAllowedForSection(kind, buckets, slotSections, requiredPieces);
    if (buckets[kind].length >= maxForSec) return;

    const piece: SelectedComboPiece = {
      dishId: item.dishId,
      dishName: item.dishName,
      unitPrice: item.unitPrice,
    };
    setBuckets((prev) => ({
      ...prev,
      [kind]: [...prev[kind], piece],
    }));
  };

  const handleDecrementSelectedDish = (kind: SlotGroupKind, dishId: string) => {
    const arr = [...buckets[kind]];
    const lastIdx = arr.map((p) => p.dishId).lastIndexOf(dishId);
    if (lastIdx < 0) return;
    arr.splice(lastIdx, 1);
    setBuckets((prev) => ({ ...prev, [kind]: arr }));
    if (replaceTarget && replaceTarget.kind === kind && replaceTarget.dishId === dishId) {
      if (!arr.some((p) => p.dishId === dishId)) {
        setReplaceTarget(null);
      }
    }
  };

  const handleRemoveAllOfSelectedDish = (kind: SlotGroupKind, dishId: string) => {
    const nextArr = buckets[kind].filter((p) => p.dishId !== dishId);
    setBuckets((prev) => ({ ...prev, [kind]: nextArr }));
    if (replaceTarget && replaceTarget.kind === kind && replaceTarget.dishId === dishId) {
      setReplaceTarget(null);
    }
  };

  const handleStartReplace = (kind: SlotGroupKind, item: GroupedSelectedDish) => {
    setActiveKind(kind);
    setReplaceTarget({
      kind,
      dishId: item.dishId,
      dishName: item.dishName,
    });
  };

  const handleResetAllSlots = () => {
    if (!comboConfig) return;
    setBuckets(createEmptyBuckets());
    setActiveKind(slotSections[0]?.kind ?? "raw-special");
    setReplaceTarget(null);
  };

  const handleSubmitBox = () => {
    if (!selectedComboDish || !comboConfig || !isComplete) return;
    if (allSelectedPiecesFlat.length !== comboConfig.requiredPieces) return;

    onCompleteCombo({
      comboDish: selectedComboDish,
      categoryName: comboCategory.name,
      selectedPieces: allSelectedPiecesFlat,
      computedPrice,
      originalPrice: originalComboPrice,
      appliedOfferTitle: selectedOfferEval?.offer?.title,
      replaceLineKey: activeSelection?.lineKey,
    });
    onSelectCombo(null);
  };

  const activeSectionCount = activeSection ? buckets[activeSection.kind].length : 0;
  const activeSectionMax = activeSection
    ? getMaxAllowedForSection(activeSection.kind, buckets, slotSections, requiredPieces)
    : 0;
  const isReplacingInActiveSection = Boolean(
    replaceTarget && activeSection && replaceTarget.kind === activeSection.kind,
  );
  const canAddInActiveSection =
    Boolean(activeSection) &&
    (isReplacingInActiveSection || activeSectionCount < activeSectionMax);

  const missingMinimumSection = slotSections.find(
    (s) => s.minCount > 0 && buckets[s.kind].length < s.minCount,
  );

  return (
    <div id="combo-boxes" className="space-y-6 sm:space-y-8">
      {!selectedComboDish || !comboConfig ? (
        <>
          <div className="border-b border-border pb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                dir="rtl"
                onClick={onBackToMenu}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowRight className="size-4" />
                <span>رجوع للمنيو الرئيسي</span>
              </button>

              <span
                dir="rtl"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground"
              >
                <Box aria-hidden="true" className="size-3.5 text-muted-foreground" />
                <span>{comboBoxes.length} بوكسات متاحة</span>
              </span>
            </div>

            <div dir="rtl" className="mt-6 max-w-3xl">
              <p className="text-xs font-medium tracking-wide text-muted-foreground">
                {businessName} · Combo Selection
              </p>
              <h2 className="mt-1.5 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                اختار البوكس المناسب ليك وركّب قطعه قطعة بقطعة
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                فوق كل بوكس هتلاقي شرح واضح بالعربي لطريقته والقطع المتاحة فيه. اضغط على أي بوكس لفتح صفحة اختيار القطع الخاصة بيه.
              </p>
            </div>
          </div>

          {/* 2-Column Equal-Size Mobile Grid of Combo Boxes */}
          <div className="grid grid-cols-2 auto-rows-fr gap-3 sm:gap-6 lg:grid-cols-3">
            {comboBoxes.map((combo) => {
              const cfg = combo.comboConfig!;
              const isAvailable = combo.available && combo.stock > 0;
              const basePrice = combo.variants[0]?.price ?? 0;
              const offerEval = getBestOfferForItem({
                dishId: combo.id,
                categoryId: comboCategory.id,
                isCombo: true,
                basePrice,
                offers,
              });
              const guide = getBoxArabicGuide(
                combo,
                cfg,
                categories,
                offerEval.finalPrice.toLocaleString(),
              );
              const boxImage = combo.image || COMBO_BOX_IMAGES[combo.id] || comboCategory.coverImage;

              return (
                <article
                  key={combo.id}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-secondary/40">
                    <img
                      src={boxImage}
                      alt={combo.name}
                      referrerPolicy="no-referrer"
                      className="size-full object-cover object-center transition-transform duration-300"
                    />
                    {offerEval.offer && offerEval.discountAmount > 0 && (
                      <span className="absolute top-2 left-2 rounded-md bg-destructive px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                        {offerEval.offer.discountType === "percentage"
                          ? `-${offerEval.offer.discountValue}%`
                          : `-${offerEval.offer.discountValue} EGP`}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between gap-2.5 p-3 sm:p-5">
                    <div dir="rtl" className="space-y-1.5 text-right">
                      <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
                        {cfg.requiredPieces} قطعة
                      </p>
                      <h3
                        dir="ltr"
                        className="font-display text-sm leading-snug font-medium tracking-tight text-foreground sm:text-xl text-right"
                      >
                        {combo.name}
                      </h3>
                      <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                        {guide.shortInsideAr}
                      </p>
                    </div>

                    <div className="mt-auto space-y-2.5 border-t border-border pt-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span dir="rtl" className="text-[11px] text-muted-foreground">
                          السعر
                        </span>
                        <div className="flex flex-wrap items-baseline justify-end gap-1.5">
                          {offerEval.discountAmount > 0 && (
                            <span className="font-mono text-[11px] line-through tabular-nums text-muted-foreground">
                              {offerEval.originalPrice.toLocaleString()}
                            </span>
                          )}
                          <p className="font-mono text-sm font-semibold tabular-nums text-foreground sm:text-lg">
                            {offerEval.finalPrice.toLocaleString()}{" "}
                            <span className="text-[10px] font-normal text-muted-foreground sm:text-xs">
                              EGP
                            </span>
                          </p>
                        </div>
                      </div>

                      {isAvailable ? (
                        <button
                          type="button"
                          dir="rtl"
                          onClick={() =>
                            onSelectCombo({
                              comboDishId: combo.id,
                            })
                          }
                          className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 sm:py-2.5 sm:text-sm"
                        >
                          <Plus className="size-3.5 shrink-0" />
                          <span>اختار القطع</span>
                        </button>
                      ) : (
                        <span
                          dir="rtl"
                          className="inline-flex min-h-[40px] w-full items-center justify-center rounded-full border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground sm:text-xs"
                        >
                          غير متاح حالياً
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Compact Top Navigation & Selected Box Header */}
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  dir="rtl"
                  onClick={() => onSelectCombo(null)}
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                >
                  <ArrowRight className="size-4" />
                  <span>قائمة البوكسات</span>
                </button>
                <button
                  type="button"
                  dir="rtl"
                  onClick={() => {
                    onSelectCombo(null);
                    onBackToMenu();
                  }}
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span>المنيو الرئيسي</span>
                </button>
              </div>

              {filledCount > 0 && (
                <button
                  type="button"
                  dir="rtl"
                  onClick={handleResetAllSlots}
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                  <span>مسح الكل</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div dir="rtl" className="text-right">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {activeSelection?.lineKey ? "تعديل اختيارات البوكس" : "تجهيز البوكس قطعة بقطعة"}
                </p>
                <h2 className="mt-0.5 font-display text-2xl font-medium tracking-tight text-foreground sm:text-4xl">
                  {selectedComboDish.name}
                </h2>
              </div>

              <div className="rounded-xl border border-border bg-card px-3.5 py-2 text-left sm:rounded-2xl sm:px-5 sm:py-3 sm:text-right">
                <p dir="rtl" className="text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                  سعر البوكس
                </p>
                <div className="flex items-baseline gap-1.5">
                  {originalComboPrice && (
                    <span className="font-mono text-xs line-through tabular-nums text-muted-foreground sm:text-sm">
                      {originalComboPrice.toLocaleString()}
                    </span>
                  )}
                  <p className="font-mono text-lg font-semibold tabular-nums text-foreground sm:text-2xl">
                    {computedPrice.toLocaleString()}{" "}
                    <span className="text-[11px] font-normal text-muted-foreground sm:text-xs">
                      EGP
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* A. Full-Width Ordering Instructions & Selection Conditions */}
          {selectedGuide && (
            <section
              dir="rtl"
              aria-label="تعليمات وشروط البوكس"
              className="w-full rounded-2xl border border-border bg-secondary/40 p-2.5 sm:p-5 text-right space-y-1.5 sm:space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 border-b border-border/70 pb-1.5 sm:pb-2">
                <span className="text-xs font-semibold text-foreground sm:text-sm">
                  تعليمات وشروط {selectedComboDish.name}
                </span>
                <span className="font-mono text-[11px] font-medium text-muted-foreground sm:text-xs">
                  {selectedGuide.ruleSummary}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1 sm:gap-2 sm:grid-cols-2 text-[11px] leading-snug sm:text-xs sm:leading-relaxed text-muted-foreground">
                <p>
                  <strong className="font-semibold text-foreground">طريقة الاختيار: </strong>
                  {selectedGuide.howToOrder}
                </p>
                <p>
                  <strong className="font-semibold text-foreground">الحد الأدنى والأقصى: </strong>
                  {selectedGuide.whatsInside}
                </p>
                <p>
                  <strong className="font-semibold text-foreground">القطع المتاحة: </strong>
                  {selectedGuide.availablePieces}
                </p>
                <p className="flex items-start gap-1.5">
                  <Ban className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  <span>
                    <strong className="font-semibold text-foreground">غير مسموح: </strong>
                    {selectedGuide.unavailablePieces}
                  </span>
                </p>
              </div>
            </section>
          )}

          {/* B. Full-Width Selected Pieces Counter Directly Below Instructions */}
          <section
            dir="rtl"
            aria-label="عداد القطع المختارة"
            className="w-full rounded-2xl border border-border bg-card p-3.5 sm:p-5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground sm:text-base">
                {isComplete ? (
                  <>
                    <CheckCircle2 className="size-4 shrink-0 text-chart-3" />
                    <span>
                      عدد القطع المختارة:{" "}
                      <span className="font-mono tabular-nums">
                        {filledCount} / {requiredPieces}
                      </span>{" "}
                      — البوكس مكتمل
                    </span>
                  </>
                ) : (
                  <span>
                    عدد القطع المختارة:{" "}
                    <span className="font-mono tabular-nums">
                      {filledCount} / {requiredPieces}
                    </span>
                  </span>
                )}
              </div>

              <span className="font-mono text-xs font-medium tabular-nums text-muted-foreground sm:text-sm">
                {remainingPieces > 0
                  ? `المتبقي: ${remainingPieces} قطعة`
                  : "اكتملت السعة"}
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-foreground transition-[width] duration-300"
                style={{
                  width: `${
                    requiredPieces > 0
                      ? Math.min(100, Math.round((filledCount / requiredPieces) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>

            {slotSections.length > 1 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                {slotSections.map((sec) => {
                  const secCount = buckets[sec.kind].length;
                  const minMet = secCount >= sec.minCount;
                  return (
                    <span key={`counter-${sec.kind}`} className="inline-flex items-center gap-1 tabular-nums">
                      {sec.minCount > 0 && minMet && (
                        <Check className="size-3 shrink-0 text-chart-3" />
                      )}
                      <span className={minMet && sec.minCount > 0 ? "font-medium text-foreground" : ""}>
                        {sec.tabLabel}: {secCount}
                        {sec.minCount > 0 ? ` (حد أدنى ${sec.minCount})` : ""}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </section>

          {/* C. Two Side-by-Side Selection Areas (Mobile 2-Column & Desktop 2-Column) */}
          <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] lg:items-start">
            {/* Area 1 – إضافة القطع (Available Pieces to Add) */}
            <section
              aria-label="إضافة القطع"
              className="min-w-0 rounded-2xl border border-border bg-card p-2.5 sm:p-5 space-y-3"
            >
              <div dir="rtl" className="space-y-2 border-b border-border pb-2.5 text-right">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-foreground sm:text-xl">
                    إضافة القطع
                  </h3>
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums sm:text-xs">
                    {eligibleForActiveSection.length} صنف
                  </span>
                </div>

                {slotSections.length > 1 && (
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {slotSections.map((sec) => {
                      const isTabActive = activeSection?.kind === sec.kind;
                      const countInSec = buckets[sec.kind].length;
                      return (
                        <button
                          key={`tab-${sec.kind}`}
                          type="button"
                          onClick={() => handleSelectSectionTab(sec.kind)}
                          className={`inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-xs ${
                            isTabActive
                              ? "bg-foreground text-background"
                              : "border border-border bg-background text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span>{sec.tabLabel}</span>
                          <span className="font-mono tabular-nums opacity-80">
                            ({countInSec})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {isReplacingInActiveSection && replaceTarget ? (
                  <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-foreground/40 bg-secondary/60 px-2.5 py-1.5 text-[11px] sm:text-xs">
                    <span className="font-medium text-foreground">
                      استبدال: {replaceTarget.dishName}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplaceTarget(null)}
                      className="inline-flex cursor-pointer items-center gap-1 font-semibold text-foreground underline underline-offset-2"
                    >
                      <X className="size-3" />
                      <span>إلغاء</span>
                    </button>
                  </div>
                ) : !canAddInActiveSection ? (
                  <p className="text-[11px] font-medium text-destructive sm:text-xs">
                    {remainingPieces === 0
                      ? "اكتملت سعة البوكس — احذف أو استبدل قطعة من القائمة المقابلة."
                      : missingMinimumSection
                        ? `السعة المتبقية (${remainingPieces}) محجوزة لاستكمال الحد الأدنى في ${missingMinimumSection.tabLabel}.`
                        : "وصلت للحد الأقصى المتاح لهذا القسم."}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground sm:text-xs">
                    {activeSection?.subtitleAr}
                  </p>
                )}
              </div>

              {eligibleForActiveSection.length === 0 ? (
                <p dir="rtl" className="py-4 text-center text-xs text-muted-foreground">
                  لا توجد قطع متاحة حالياً لهذا القسم.
                </p>
              ) : (
                <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-0.5 sm:max-h-[38rem] sm:space-y-2.5">
                  {eligibleForActiveSection.map((option) => {
                    const countInBox = allSelectedPiecesFlat.filter(
                      (s) => s.dishId === option.dish.id,
                    ).length;
                    const pieceImg = option.dish.image || option.categoryCoverImage;

                    return (
                      <article
                        key={option.dish.id}
                        className="flex flex-col overflow-hidden rounded-xl border border-border bg-background lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:p-2.5"
                      >
                        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-secondary/40 lg:size-14 lg:rounded-lg">
                          <img
                            src={pieceImg}
                            alt={option.dish.name}
                            referrerPolicy="no-referrer"
                            className="size-full object-cover object-center"
                          />
                          {countInBox > 0 && (
                            <span
                              dir="rtl"
                              className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 rounded-full bg-foreground px-1.5 py-0.5 font-mono text-[10px] font-semibold text-background tabular-nums"
                            >
                              <Check className="size-2.5" />
                              {countInBox}×
                            </span>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col justify-between gap-1.5 p-2 lg:flex-row lg:items-center lg:gap-3 lg:p-0 min-w-0">
                          <div className="min-w-0 flex-1">
                            <h4 className="line-clamp-2 text-[11px] leading-snug font-medium text-foreground sm:text-sm">
                              {option.dish.name}
                            </h4>
                            <p className="mt-0.5 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground sm:text-xs">
                              {option.unitPrice} EGP
                            </p>
                          </div>

                          <button
                            type="button"
                            dir="rtl"
                            disabled={!canAddInActiveSection}
                            onClick={() => handleAddPieceFromCatalog(option)}
                            className="inline-flex min-h-[38px] w-full shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-auto lg:px-3.5 sm:text-xs"
                          >
                            {isReplacingInActiveSection ? (
                              <>
                                <RefreshCw className="size-3 shrink-0" />
                                <span>استبدال</span>
                              </>
                            ) : (
                              <>
                                <Plus className="size-3 shrink-0" />
                                <span>إضافة</span>
                              </>
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Area 2 – القطع المختارة (Already Selected Pieces) */}
            <section
              aria-label="القطع المختارة"
              className="min-w-0 rounded-2xl border border-border bg-card p-2.5 sm:p-5 space-y-3 lg:sticky lg:top-24"
            >
              <div dir="rtl" className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
                <h3 className="font-display text-sm font-semibold text-foreground sm:text-xl">
                  القطع المختارة
                </h3>
                <span className="font-mono text-xs font-semibold tabular-nums text-foreground sm:text-sm">
                  {filledCount} / {requiredPieces}
                </span>
              </div>

              <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-0.5 sm:max-h-[32rem]">
                {slotSections.map((sec) => {
                  const secPieces = buckets[sec.kind];
                  const grouped = groupPiecesByDish(secPieces);
                  const maxForSec = getMaxAllowedForSection(
                    sec.kind,
                    buckets,
                    slotSections,
                    requiredPieces,
                  );
                  const remainingForSec = Math.max(0, maxForSec - secPieces.length);
                  const minMet = secPieces.length >= sec.minCount;
                  const missingForMin = Math.max(0, sec.minCount - secPieces.length);

                  return (
                    <div
                      key={`selected-sec-${sec.kind}`}
                      className="rounded-xl border border-border/80 bg-secondary/20 p-2 sm:p-3 space-y-2"
                    >
                      <div dir="rtl" className="flex flex-wrap items-center justify-between gap-1 text-right">
                        <span className="text-[11px] font-semibold text-foreground sm:text-xs">
                          {sec.titleAr}
                        </span>
                        <span
                          className={`font-mono text-[10px] font-medium tabular-nums sm:text-[11px] ${
                            sec.minCount > 0 && minMet
                              ? "text-chart-3"
                              : "text-muted-foreground"
                          }`}
                        >
                          {sec.minCount > 0
                            ? minMet
                              ? `${secPieces.length} ✓`
                              : `${secPieces.length} / ${sec.minCount}`
                            : `${secPieces.length} قطعة`}
                        </span>
                      </div>

                      {grouped.length === 0 ? (
                        <div dir="rtl" className="space-y-1.5 py-1 text-right">
                          <p className="text-[10px] leading-relaxed text-muted-foreground sm:text-xs">
                            {sec.minCount > 0
                              ? `اختار ${sec.minCount} قطع على الأقل من قائمة إضافة القطع`
                              : remainingForSec > 0
                                ? `تقدر تضيف حتى ${remainingForSec} قطعة من هنا`
                                : "اكتملت السعة في الأقسام الأخرى"}
                          </p>
                          {activeSection?.kind !== sec.kind && remainingForSec > 0 && (
                            <button
                              type="button"
                              onClick={() => handleSelectSectionTab(sec.kind)}
                              className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-foreground hover:bg-secondary sm:text-xs"
                            >
                              <Plus className="size-3" />
                              <span>عرض {sec.tabLabel}</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {grouped.map((item) => {
                            const isTargetReplace =
                              replaceTarget?.kind === sec.kind &&
                              replaceTarget?.dishId === item.dishId;

                            return (
                              <div
                                key={`${sec.kind}-${item.dishId}`}
                                className={`rounded-lg border p-2 transition-colors ${
                                  isTargetReplace
                                    ? "border-foreground bg-background ring-1 ring-foreground"
                                    : "border-border bg-background"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="min-w-0 flex-1">
                                    <p className="line-clamp-2 text-[11px] leading-snug font-medium text-foreground sm:text-xs">
                                      {item.dishName}
                                    </p>
                                    <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                                      الكمية: {item.quantity}×
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveAllOfSelectedDish(sec.kind, item.dishId)
                                    }
                                    aria-label={`حذف ${item.dishName}`}
                                    className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-border/60 pt-1.5">
                                  <div className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/30 p-0.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDecrementSelectedDish(sec.kind, item.dishId)
                                      }
                                      aria-label={`تقليل كمية ${item.dishName}`}
                                      className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-background"
                                    >
                                      <Minus className="size-3" />
                                    </button>
                                    <span className="min-w-[1.25rem] text-center font-mono text-[11px] font-semibold tabular-nums">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={remainingForSec <= 0}
                                      onClick={() => handleIncrementSelectedDish(sec.kind, item)}
                                      aria-label={`زيادة كمية ${item.dishName}`}
                                      className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Plus className="size-3" />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    dir="rtl"
                                    onClick={() => handleStartReplace(sec.kind, item)}
                                    className={`inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors sm:px-2.5 sm:text-[11px] ${
                                      isTargetReplace
                                        ? "border-foreground bg-foreground text-background"
                                        : "border-border bg-background text-foreground hover:bg-secondary"
                                    }`}
                                  >
                                    <RefreshCw className="size-2.5 shrink-0" />
                                    <span>استبدال</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {sec.isExpandable && remainingForSec > 0 && (
                            <button
                              type="button"
                              dir="rtl"
                              onClick={() => handleSelectSectionTab(sec.kind)}
                              className="inline-flex min-h-[34px] w-full cursor-pointer items-center justify-center gap-1 rounded-full border border-dashed border-border bg-background px-2.5 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary sm:text-xs"
                            >
                              <Plus className="size-3 shrink-0" />
                              <span>
                                {missingForMin > 0
                                  ? `إضافة (+${missingForMin} للحد الأدنى)`
                                  : `إضافة قطعة أخرى (متاح +${remainingForSec})`}
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border pt-3">
                <button
                  type="button"
                  dir="rtl"
                  disabled={!isComplete || !orderingEnabled}
                  onClick={handleSubmitBox}
                  className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-2.5 text-xs font-medium text-background shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5 sm:text-sm"
                >
                  <ShoppingBag className="size-4 shrink-0" />
                  <span>
                    {!orderingEnabled
                      ? "الطلب متوقف حالياً"
                      : !isComplete
                        ? missingMinimumSection
                          ? `باقي ${missingMinimumSection.minCount - buckets[missingMinimumSection.kind].length} في ${missingMinimumSection.tabLabel}`
                          : `باقي ${remainingPieces} قطعة لاكتمال البوكس`
                        : activeSelection?.lineKey
                          ? `حفظ التعديلات · ${computedPrice.toLocaleString()} EGP`
                          : `أضف للسلة · ${computedPrice.toLocaleString()} EGP`}
                  </span>
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
