"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
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
};

const fields: FieldConfig[] = [
  { key: "buyPrice", label: "仕入れ価格", unit: "円", placeholder: "3000", step: "1" },
  { key: "sellPrice", label: "販売価格", unit: "円", placeholder: "5000", step: "1" },
  { key: "feeRate", label: "販売手数料率", unit: "%", placeholder: "10", step: "0.1", max: 100 },
  { key: "shipping", label: "送料", unit: "円", placeholder: "500", step: "1" },
  { key: "otherCost", label: "その他費用", unit: "円", placeholder: "0", step: "1" },
  { key: "targetProfitRate", label: "目標利益率", unit: "%", placeholder: "20", step: "0.1", max: 100 },
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

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [result, setResult] = useState<CalcResult | null>(null);

  const handleChange = (key: FieldKey) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
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
  };

  const handleReset = () => {
    setForm(initialForm);
    setErrors({});
    setResult(null);
  };

  const isProfit = result !== null && result.profit >= 0;

  return (
    <main className="min-h-screen w-full overflow-x-hidden px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            せどり利益計算
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            仕入れる前に、利益が出るか30秒でチェック
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
            <div className="grid grid-cols-1 gap-4">
              {fields.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={field.key}
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    {field.label}
                  </label>
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
                      className={`w-full min-w-0 rounded-xl border bg-slate-50 px-3 py-3 pr-10 text-base text-slate-900 outline-none transition focus:bg-white focus:ring-2 ${
                        errors[field.key]
                          ? "border-loss focus:ring-loss/40"
                          : "border-slate-200 focus:ring-blue-400"
                      }`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
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
              className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white shadow-sm transition active:scale-[0.99] active:bg-blue-700"
            >
              計算する
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="w-full rounded-xl bg-slate-200 py-3 text-sm font-medium text-slate-600 transition active:scale-[0.99] active:bg-slate-300"
            >
              入力をリセット
            </button>
          </div>
        </form>

        {result && (
          <section className="mt-6 flex flex-col gap-4">
            <div
              className={`rounded-2xl p-5 text-center shadow-sm ring-1 ${
                isProfit
                  ? "bg-profit-light ring-profit/30"
                  : "bg-loss-light ring-loss/30"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  isProfit ? "text-profit-dark" : "text-loss-dark"
                }`}
              >
                {isProfit ? "✅ 利益が出ます" : "⚠️ このままでは赤字です"}
              </p>
              <p
                className={`mt-1 text-4xl font-bold ${
                  isProfit ? "text-profit-dark" : "text-loss-dark"
                }`}
              >
                {isProfit ? "+" : ""}
                {formatYen(result.profit)}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/70 py-3">
                  <p className="text-xs text-slate-500">利益率</p>
                  <p
                    className={`text-xl font-bold ${
                      isProfit ? "text-profit-dark" : "text-loss-dark"
                    }`}
                  >
                    {formatPercent(result.profitRate)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/70 py-3">
                  <p className="text-xs text-slate-500">ROI</p>
                  <p
                    className={`text-xl font-bold ${
                      isProfit ? "text-profit-dark" : "text-loss-dark"
                    }`}
                  >
                    {formatPercent(result.roi)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-blue-50 p-5 text-center shadow-sm ring-1 ring-blue-200">
              <p className="text-sm font-medium text-blue-700">
                目標利益率を達成できる仕入れ上限価格
              </p>
              <p className="mt-1 text-3xl font-bold text-blue-700">
                {result.maxBuyPrice >= 0 ? formatYen(result.maxBuyPrice) : "―"}
              </p>
              {result.maxBuyPrice < 0 && (
                <p className="mt-1 text-xs text-blue-700">
                  現在の条件では目標利益率を達成できません
                </p>
              )}
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
          </section>
        )}
      </div>
    
