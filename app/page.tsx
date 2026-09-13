"use client";

import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { calcSedoriProfit, type CalcResult } from "@/lib/calc";

type FieldKey =
  | "buyPrice"
  | "sellPrice"
  | "feeRate"
  | "shipping"
  | "otherCost"
  | "targetProfitRate";

type FormState = Record<FieldKey, string>;

const initialForm: FormState = {
  buyPrice: "",
  sellPrice: "",
  feeRate: "",
  shipping: "",
  otherCost: "",
  targetProfitRate: "",
};

type FieldConfig = {
  key: FieldKey;
  label: string;
  unit: string;
  placeholder: string;
  step: string;
  max?: number;
  description: string;
};

const fields: FieldConfig[] = [
  {
    key: "buyPrice",
    label: "仕入れ価格",
    unit: "円",
    placeholder: "3000",
    step: "1",
    description: "自分が商品を仕入れる価格",
  },
  {
    key: "sellPrice",
    label: "販売価格",
    unit: "円",
    placeholder: "5000",
    step: "1",
    description: "実際に売る予定の価格",
  },
  {
    key: "feeRate",
    label: "販売手数料率",
    unit: "%",
    placeholder: "10",
    step: "0.1",
    max: 100,
    description: "販売価格から引かれる手数料の割合",
  },
  {
    key: "shipping",
    label: "送料",
    unit: "円",
    placeholder: "500",
    step: "1",
    description: "購入者に発送するときの送料",
  },
  {
    key: "otherCost",
    label: "その他費用",
    unit: "円",
    placeholder: "0",
    step: "1",
    description: "梱包材などのその他の費用",
  },
  {
    key: "targetProfitRate",
    label: "目標利益率",
    unit: "%",
    placeholder: "20",
    step: "0.1",
    max: 100,
    description: "最低限確保したい利益率",
  },
];

type MarketplaceKey = "mercari" | "yahoo" | "rakuma" | "manual";

type MarketplaceOption = {
  key: MarketplaceKey;
  label: string;
  feeRate: number | null;
  note?: string;
};

const marketplaceOptions: MarketplaceOption[] = [
  { key: "mercari", label: "メルカリ", feeRate: 10 },
  { key: "yahoo", label: "Yahoo!フリマ", feeRate: 5 },
  { key: "rakuma", label: "楽天ラクマ", feeRate: 10, note: "販売実績で4.5%まで下がります" },
  { key: "manual", label: "手動入力", feeRate: null },
];

function formatYen(n: number): string {
  const rounded = Math.round(n);
  const value = Object.is(rounded, -0) ? 0 : rounded;
  return `${value.toLocaleString("ja-JP")}円`;
}

function formatPercent(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  const value = Object.is(rounded, -0) ? 0 : rounded;
  const text = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${text}%`;
}

function validate(form: FormState): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};

  for (const field of fields) {
    const raw = form[field.key].trim();

    if (raw === "") {
      errors[field.key] = "入力してください";
      continue;
    }

    const value = Number(raw);

    if (Number.isNaN(value)) {
      errors[field.key] = "数値を入力してください";
      continue;
    }

    if (value < 0) {
      errors[field.key] = "0以上の値を入力してください";
      continue;
    }

    if (field.max !== undefined && value > field.max) {
      errors[field.key] = `0〜${field.max}の範囲で入力してください`;
      continue;
    }
  }

  if (!errors.buyPrice && Number(form.buyPrice) === 0) {
    errors.buyPrice = "0より大きい値を入力してください";
  }
  if (!errors.sellPrice && Number(form.sellPrice) === 0) {
    errors.sellPrice = "0より大きい値を入力してください";
  }

  return errors;
}

type Judgment = {
  label: string;
  tone: "good" | "warn" | "bad";
};

function getJudgment(result: CalcResult, targetProfitRate: number): Judgment {
  if (result.profit < 0) {
    return { label: "× 仕入れNG", tone: "bad" };
  }
  if (result.profitRate >= targetProfitRate) {
    return { label: "◎ 仕入れおすすめ", tone: "good" };
  }
  return { label: "△ 利益率が低め", tone: "warn" };
}

const toneStyles: Record<
  Judgment["tone"],
  { border: string; text: string; solidBg: string }
> = {
  good: {
    border: "border-t-4 border-profit",
    text: "text-profit-dark",
    solidBg: "bg-profit",
  },
  warn: {
    border: "border-t-4 border-amber-400",
    text: "text-amber-700",
    solidBg: "bg-amber-400",
  },
  bad: {
    border: "border-t-4 border-loss",
    text: "text-loss-dark",
    solidBg: "bg-loss",
  },
};

type SavedItem = {
  id: string;
  productName: string;
  sellPrice: number;
  buyPrice: number;
  feeRate: number;
  shipping: number;
  otherCost: number;
  targetProfitRate: number;
  profit: number;
  profitRate: number;
  roi: number;
  maxBuyPrice: number;
  judgmentLabel: string;
  savedAt: string;
};

const STORAGE_KEY = "sedori-saved-items";

function loadSavedItems(): SavedItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedItems(items: SavedItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // 保存に失敗しても計算機能自体は継続できるようにする
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type CompareSortKey = "profit" | "profitRate" | "roi" | "maxBuyPrice";

const compareSortOptions: { key: CompareSortKey; label: string }[] = [
  { key: "profit", label: "利益額順" },
  { key: "profitRate", label: "利益率順" },
  { key: "roi", label: "ROI順" },
  { key: "maxBuyPrice", label: "上限価格順" },
];

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [result, setResult] = useState<CalcResult | null>(null);
  const [marketplace, setMarketplace] = useState<MarketplaceKey>("manual");

  const [view, setView] = useState<"calculator" | "list" | "compare">("calculator");
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [productName, setProductName] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [compareSelectedIds, setCompareSelectedIds] = useState<Set<string>>(new Set());
  const [compareSortKey, setCompareSortKey] = useState<CompareSortKey>("profit");

  useEffect(() => {
    setSavedItems(loadSavedItems());
  }, []);

  useEffect(() => {
    if (view === "compare") {
      setCompareSelectedIds(new Set(savedItems.map((item) => item.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const handleChange = (key: FieldKey) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSelectMarketplace = (option: MarketplaceOption) => {
    setMarketplace(option.key);
    if (option.feeRate !== null) {
      setForm((prev) => ({ ...prev, feeRate: String(option.feeRate) }));
      setErrors((prev) => ({ ...prev, feeRate: undefined }));
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationErrors = validate(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setResult(null);
      return;
    }

    const calcResult = calcSedoriProfit({
      buyPrice: Number(form.buyPrice),
      sellPrice: Number(form.sellPrice),
      feeRate: Number(form.feeRate),
      shipping: Number(form.shipping),
      otherCost: Number(form.otherCost),
      targetProfitRate: Number(form.targetProfitRate),
    });

    setResult(calcResult);
    setSaveMessage(null);
  };

  const handleReset = () => {
    setForm(initialForm);
    setErrors({});
    setResult(null);
    setMarketplace("manual");
    setProductName("");
    setSaveMessage(null);
  };

  const judgment = result
    ? getJudgment(result, Number(form.targetProfitRate) || 0)
    : null;
  const tone = judgment ? toneStyles[judgment.tone] : null;

  const handleSaveItem = () => {
    if (!result || !judgment) return;

    const newItem: SavedItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
