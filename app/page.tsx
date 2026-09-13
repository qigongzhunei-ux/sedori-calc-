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
      productName: productName.trim() || "名称未設定の商品",
      sellPrice: Number(form.sellPrice),
      buyPrice: Number(form.buyPrice),
      feeRate: Number(form.feeRate),
      shipping: Number(form.shipping),
      otherCost: Number(form.otherCost),
      targetProfitRate: Number(form.targetProfitRate),
      profit: result.profit,
      profitRate: result.profitRate,
      roi: result.roi,
      maxBuyPrice: result.maxBuyPrice,
      judgmentLabel: judgment.label,
      savedAt: new Date().toISOString(),
    };

    const updated = [newItem, ...savedItems];
    setSavedItems(updated);
    persistSavedItems(updated);
    setProductName("");
    setSaveMessage("保存しました");
  };

  const handleDeleteItem = (id: string) => {
    const updated = savedItems.filter((item) => item.id !== id);
    setSavedItems(updated);
    persistSavedItems(updated);
  };

  const handleLoadItem = (item: SavedItem) => {
    setForm({
      buyPrice: String(item.buyPrice),
      sellPrice: String(item.sellPrice),
      feeRate: String(item.feeRate),
      shipping: String(item.shipping),
      otherCost: String(item.otherCost),
      targetProfitRate: String(item.targetProfitRate),
    });
    setErrors({});
    setMarketplace("manual");

    const calcResult = calcSedoriProfit({
      buyPrice: item.buyPrice,
      sellPrice: item.sellPrice,
      feeRate: item.feeRate,
      shipping: item.shipping,
      otherCost: item.otherCost,
      targetProfitRate: item.targetProfitRate,
    });
    setResult(calcResult);
    setProductName("");
    setSaveMessage(null);
    setView("calculator");
  };

  const toggleCompareSelected = (id: string) => {
    setCompareSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const compareItems = savedItems
    .filter((item) => compareSelectedIds.has(item.id))
    .slice()
    .sort((a, b) => b[compareSortKey] - a[compareSortKey]);

  const maxProfit = compareItems.length
    ? Math.max(...compareItems.map((i) => i.profit))
    : null;
  const maxProfitRate = compareItems.length
    ? Math.max(...compareItems.map((i) => i.profitRate))
    : null;
  const maxRoi = compareItems.length
    ? Math.max(...compareItems.map((i) => i.roi))
    : null;
  const maxBuyPriceValue = compareItems.length
    ? Math.max(...compareItems.map((i) => i.maxBuyPrice))
    : null;

  return (
    <main className="min-h-screen w-full overflow-x-hidden px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-4 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            せどり利益計算ツール
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            仕入れる前に、利益が出るか30秒でチェック
          </p>
          <p className="mt-1 text-xs text-slate-400">
            販売価格・仕入れ価格・送料・販売手数料を入力するだけ
          </p>
        </header>

        {view === "calculator" ? (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setView("list")}
              className="w-full rounded-xl bg-white py-3 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition active:bg-slate-100"
            >
              📋 保存した商品（{savedItems.length}件）
            </button>
            <button
              type="button"
              onClick={() => setView("compare")}
              className="w-full rounded-xl bg-white py-3 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition active:bg-slate-100"
            >
              📊 商品を比較する
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setView("calculator")}
            className="mb-4 w-full rounded-xl bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition active:bg-slate-100"
          >
            ← 計算画面に戻る
          </button>
        )}

        {view === "list" && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-slate-900">保存した商品</h2>

            {savedItems.length === 0 && (
              <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
                まだ保存された商品はありません
              </div>
            )}

            {savedItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-bold text-slate-900">
                    {item.productName}
                  </p>
                  <p className="shrink-0 text-xs text-slate-400">
                    {formatDateTime(item.savedAt)}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-blue-50 p-3 text-center">
                    <p className="text-xs text-blue-600">仕入れ上限価格</p>
                    <p className="mt-0.5 text-lg font-bold text-blue-700">
                      {item.maxBuyPrice >= 0 ? formatYen(item.maxBuyPrice) : "―"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">仕入れ判定</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-800">
                      {item.judgmentLabel}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">利益額</p>
                    <p className="mt-0.5 font-bold text-slate-800">
                      {item.profit >= 0 ? "+" : ""}
                      {formatYen(item.profit)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">利益率 / ROI</p>
                    <p className="mt-0.5 font-bold text-slate-800">
                      {formatPercent(item.profitRate)} / {formatPercent(item.roi)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadItem(item)}
                    className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition active:bg-blue-700"
                  >
                    計算画面に戻す
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-loss-dark transition active:bg-slate-200"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {view === "compare" && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-slate-900">商品比較</h2>

            {savedItems.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
                保存した商品がありません
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <p className="mb-2 text-sm font-semibold text-slate-700">
                    比較する商品を選ぶ
                  </p>
                  <div className="flex flex-col gap-2">
                    {savedItems.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                      >
                        <input
                          type="checkbox"
                          checked={compareSelectedIds.has(item.id)}
                          onChange={() => toggleCompareSelected(item.id)}
                          className="h-5 w-5 shrink-0"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          {item.productName}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <p className="mb-2 text-sm font-semibold text-slate-700">並び替え</p>
                  <div className="grid grid-cols-2 gap-2">
                    {compareSortOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setCompareSortKey(option.key)}
                        className={`rounded-xl py-2.5 text-sm font-medium transition ${
                          compareSortKey === option.key
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 active:bg-slate-200"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {compareItems.length === 0 ? (
                  <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
                    比較する商品にチェックを入れてください
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {compareItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <p className="text-base font-bold text-slate-900">
                            {item.productName}
                          </p>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-xl bg-slate-50 p-3 text-center">
                            <p className="text-xs text-slate-500">販売価格</p>
                            <p className="mt-0.5 font-bold text-slate-800">
                              {formatYen(item.sellPrice)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3 text-center">
                            <p className="text-xs text-slate-500">仕入れ価格</p>
                            <p className="mt-0.5 font-bold text-slate-800">
                              {formatYen(item.buyPrice)}
                            </p>
                          </div>

                          <div
                            className={`rounded-xl p-3 text-center ${
                              item.profit === maxProfit
                                ? "bg-profit-light ring-2 ring-profit/40"
                                : "bg-slate-50"
                            }`}
                          >
                            <p className="text-xs text-slate-500">
                              利益額{item.profit === maxProfit ? " 🏆" : ""}
                            </p>
                            <p
                              className={`mt-0.5 font-bold ${
                                item.profit === maxProfit
                                  ? "text-profit-dark"
                                  : "text-slate-800"
                              }`}
                            >
                              {item.profit >= 0 ? "+" : ""}
                              {formatYen(item.profit)}
                            </p>
                          </div>

                          <div
                            className={`rounded-xl p-3 text-center ${
                              item.profitRate === maxProfitRate
                                ? "bg-profit-light ring-2 ring-profit/40"
                                : "bg-slate-50"
                            }`}
                          >
                            <p className="text-xs text-slate-500">
                              利益率{item.profitRate === maxProfitRate ? " 🏆" : ""}
                            </p>
                            <p
                              className={`mt-0.5 font-bold ${
                                item.profitRate === maxProfitRate
                                  ? "text-profit-dark"
                                  : "text-slate-800"
                              }`}
                            >
                              {formatPercent(item.profitRate)}
                            </p>
                          </div>

                          <div
                            className={`rounded-xl p-3 text-center ${
                              item.roi === maxRoi
                                ? "bg-profit-light ring-2 ring-profit/40"
                                : "bg-slate-50"
                            }`}
                          >
                            <p className="text-xs text-slate-500">
                              ROI{item.roi === maxRoi ? " 🏆" : ""}
                            </p>
                            <p
                              className={`mt-0.5 font-bold ${
                                item.roi === maxRoi
                                  ? "text-profit-dark"
                                  : "text-slate-800"
                              }`}
                            >
                              {formatPercent(item.roi)}
                            </p>
                          </div>

                          <div
                            className={`col-span-2 rounded-xl p-3 text-center ${
                              item.maxBuyPrice === maxBuyPriceValue
                                ? "bg-blue-50 ring-2 ring-blue-300"
                                : "bg-slate-50"
                            }`}
                          >
                            <p className="text-xs text-slate-500">
                              仕入れ上限価格
                              {item.maxBuyPrice === maxBuyPriceValue ? " 🏆" : ""}
                            </p>
                            <p
                              className={`mt-0.5 text-lg font-bold ${
                                item.maxBuyPrice === maxBuyPriceValue
                                  ? "text-blue-700"
                                  : "text-slate-800"
                              }`}
                            >
                              {item.maxBuyPrice >= 0 ? formatYen(item.maxBuyPrice) : "―"}
                            </p>
                          </div>
                        </div>

                        <p className="mt-2 text-center text-sm font-semibold text-slate-700">
                          仕入れ判定: {item.judgmentLabel}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {view === "calculator" && (
          <>
            <div className="mb-4 rounded-2xl bg-blue-600 px-5 py-4 text-center shadow-sm">
              <p className="text-base font-bold text-white">
                結局、いくらまでなら仕入れていい?
              </p>
              <p className="mt-1 text-xs text-blue-100">
                このツールなら「仕入れ上限価格」がすぐ分かります
              </p>
            </div>

            <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="mb-2 text-sm font-semibold text-slate-700">使い方</p>
              <ol className="space-y-1 text-sm text-slate-600">
                <li>1. 販売価格を入力</li>
                <li>2. 仕入れ価格を入力</li>
                <li>3. 送料・販売手数料を入力</li>
                <li>4.「計算する」を押す</li>
              </ol>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
                <div className="grid grid-cols-1 gap-5">
                  {fields.map((field) => (
                    <div key={field.key}>
                      {field.key === "feeRate" && (
                        <div className="mb-3">
                          <label className="mb-2 block text-base font-medium text-slate-700">
                            販売先
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {marketplaceOptions.map((option) => (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => handleSelectMarketplace(option)}
                                className={`rounded-xl py-3 text-sm font-medium transition ${
                                  marketplace === option.key
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-100 text-slate-600 active:bg-slate-200"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          {marketplace !== "manual" && (
                            <p className="mt-2 text-xs text-slate-500">
                              {marketplaceOptions.find((o) => o.key === marketplace)?.label}
                              の標準手数料率を自動設定しました。
                              {marketplaceOptions.find((o) => o.key === marketplace)?.note}
                              変更する場合は「手動入力」を選んでください。
                            </p>
                          )}
                        </div>
                      )}

                      <label
                        htmlFor={field.key}
                        className="mb-0.5 block text-base font-medium text-slate-700"
                      >
                        {field.label}
                      </label>
                      <p className="mb-1 text-xs text-slate-400">{field.description}</p>
                      <div className="relative">
                        <input
                          id={field.key}
                          name={field.key}
                          type="number"
                          inputMode="decimal"
                          step={field.step}
                          min={0}
                          max={field.max}
                          placeholder={field.placeholder}
                          value={form[field.key]}
                          onChange={handleChange(field.key)}
                          disabled={field.key === "feeRate" && marketplace !== "manual"}
                          className={`w-full min-w-0 rounded-xl border px-4 py-4 pr-12 text-lg text-slate-900 outline-none transition focus:bg-white focus:ring-2 ${
                            field.key === "feeRate" && marketplace !== "manual"
                              ? "border-slate-200 bg-slate-100 text-slate-500"
                              : "bg-slate-50"
                          } ${
                            errors[field.key]
                              ? "border-loss focus:ring-loss/40"
                              : "border-slate-200 focus:ring-blue-400"
                          }`}
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-slate-400">
                          {field.unit}
                        </span>
                      </div>
                      {errors[field.key] && (
                        <p className="mt-1 text-xs text-loss">{errors[field.key]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white shadow-sm transition active:scale-[0.99] active:bg-blue-700"
                >
                  計算する
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full rounded-xl bg-slate-200 py-3.5 text-sm font-medium text-slate-600 transition active:scale-[0.99] active:bg-slate-300"
                >
                  入力をリセット
                </button>
              </div>
            </form>

            {result && judgment && tone && (
              <section className="mt-8 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-t border-slate-200 pt-6">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  <h2 className="text-lg font-bold text-slate-900">計算結果</h2>
                </div>

                <div className="rounded-3xl bg-blue-600 p-7 text-center shadow-lg">
                  <p className="text-sm font-medium text-blue-100">仕入れ上限価格</p>
                  <p className="mt-1 text-6xl font-extrabold text-white">
                    {result.maxBuyPrice >= 0
                      ? `¥${Math.round(result.maxBuyPrice).toLocaleString("ja-JP")}`
                      : "―"}
                  </p>
                  <p className="mt-2 text-sm font-medium text-blue-100">
                    目標利益率{form.targetProfitRate}%を達成できる上限
                  </p>
                  {result.maxBuyPrice < 0 && (
                    <p className="mt-1 text-xs text-blue-100">
                      現在の条件では目標利益率を達成できません
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-2xl bg-white p-4 text-center shadow-sm ${tone.border}`}>
                    <p className="text-xs font-medium text-slate-500">利益額</p>
                    <p className={`mt-1 text-3xl font-bold ${tone.text}`}>
                      {result.profit >= 0 ? "+" : ""}
                      {formatYen(result.profit)}
                    </p>
                  </div>
                  <div className="rounded-2xl border-t-4 border-slate-300 bg-white p-4 text-center shadow-sm">
                    <p className="text-xs font-medium text-slate-500">利益率</p>
                    <p className="mt-1 text-3xl font-bold text-slate-800">
                      {formatPercent(result.profitRate)}
                    </p>
                  </div>
                  <div className="rounded-2xl border-t-4 border-slate-300 bg-white p-4 text-center shadow-sm">
                    <p className="text-xs font-medium text-slate-500">ROI</p>
                    <p className="mt-1 text-3xl font-bold text-slate-800">
                      {formatPercent(result.roi)}
                    </p>
                  </div>
                  <div className={`rounded-2xl ${tone.solidBg} p-4 text-center shadow-sm`}>
                    <p className="text-xs font-medium text-white/80">仕入れ判定</p>
                    <p className="mt-1 text-xl font-extrabold text-white">{judgment.label}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <dl className="divide-y divide-slate-100 text-sm">
                    <div className="flex items-center justify-between py-2">
                      <dt className="text-slate-500">販売手数料</dt>
                      <dd className="font-medium text-slate-800">
                        {formatYen(result.fee)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <dt className="text-slate-500">
                        目標利益率を達成できる最低販売価格
                      </dt>
                      <dd className="text-right font-medium text-slate-800">
                        {result.minSellPriceError
                          ? "計算不能"
                          : formatYen(result.minSellPrice as number)}
                      </dd>
                    </div>
                  </dl>
                  {result.minSellPriceError && (
                    <p className="mt-2 text-xs text-loss">{result.minSellPriceError}</p>
                  )}
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <label
                    htmlFor="productName"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    商品名(任意)
                  </label>
                  <input
                    id="productName"
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="例: ○○フィギュア"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveItem}
                    className="mt-3 w-full rounded-xl bg-slate-800 py-3.5 text-base font-semibold text-white transition active:scale-[0.99] active:bg-slate-900"
                  >
                    この商品を保存
                  </button>
                  {saveMessage && (
                    <p className="mt-2 text-center text-sm font-medium text-profit-dark">
                      {saveMessage}
                    </p>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
