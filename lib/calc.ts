export type CalcInput = {
  buyPrice: number;
  sellPrice: number;
  feeRate: number;
  shipping: number;
  otherCost: number;
  targetProfitRate: number;
};

export type CalcResult = {
  fee: number;
  profit: number;
  profitRate: number;
  roi: number;
  maxBuyPrice: number;
  minSellPrice: number | null;
  minSellPriceError: string | null;
};

export function calcSedoriProfit(input: CalcInput): CalcResult {
  const { buyPrice, sellPrice, feeRate, shipping, otherCost, targetProfitRate } = input;

  const fee = sellPrice * (feeRate / 100);
  const profit = sellPrice - buyPrice - fee - shipping - otherCost;
  const profitRate = sellPrice !== 0 ? (profit / sellPrice) * 100 : 0;
  const roi = buyPrice !== 0 ? (profit / buyPrice) * 100 : 0;

  const maxBuyPrice = sellPrice - fee - shipping - otherCost - (sellPrice * (targetProfitRate / 100));

  const denom = 1 - feeRate / 100 - targetProfitRate / 100;
  let minSellPrice: number | null = null;
  let minSellPriceError: string | null = null;

  if (denom <= 0) {
    minSellPriceError = "販売手数料率と目標利益率の合計が100%以上のため、最低販売価格は計算できません";
  } else {
    minSellPrice = (buyPrice + shipping + otherCost) / denom;
  }

  return { fee, profit, profitRate, roi, maxBuyPrice, minSellPrice, minSellPriceError };
}
