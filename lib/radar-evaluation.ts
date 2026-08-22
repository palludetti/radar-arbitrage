export type ComparableEvidence = {
  kind?: "sold" | "asking" | "unknown" | string;
  match?: "exact" | "close" | "weak" | string;
};

type EvaluationInput = {
  askingPrice: number;
  acquisitionCosts: number;
  sellingCosts: number;
  modelConfirmed: boolean;
  authenticityRequired?: boolean;
  authGate?: string;
  capitalGate?: string;
  conditionGate?: string;
  quickResale: number | null;
  likelyResale?: number | null;
  desirability: number | null;
  marketConfidence: number | null;
  extractionConfidence?: Record<string, number>;
  comparables: ComparableEvidence[];
};

export type RadarEvaluation = {
  maxPurchase: number | null;
  iao: number;
  iam: number;
  ice: number;
  radarScore: number;
  verdict: "COMPRAR" | "NEGOCIAR" | "PASSAR";
  needsVerification: boolean;
  evidenceReady: boolean;
  exactComparables: number;
  exactSoldComparables: number;
  totalAcquisitionCost: number;
  quickNetProfit: number | null;
  likelyNetProfit: number | null;
  gateBlocks: string[];
};

export function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function evaluateMarket(input: EvaluationInput): RadarEvaluation {
  const marketConfidence = clamp(Math.round(input.marketConfidence ?? 0));
  const iam = clamp(Math.round(input.desirability ?? 50));
  const totalCost = input.askingPrice + input.acquisitionCosts;
  const quickResale = input.quickResale;
  const netQuickResale = quickResale === null ? null : Math.max(0, quickResale - input.sellingCosts);
  const maxPurchase = netQuickResale === null ? null : Math.max(0, Math.round(netQuickResale * 0.65 - input.acquisitionCosts));
  const quickNetProfit = netQuickResale === null ? null : Math.round((netQuickResale - totalCost) * 100) / 100;
  const likelyNetProfit = input.likelyResale === null || input.likelyResale === undefined
    ? null
    : Math.round((input.likelyResale - input.sellingCosts - totalCost) * 100) / 100;
  const discountToQuick = netQuickResale && netQuickResale > 0 ? (netQuickResale - totalCost) / netQuickResale : null;
  const iao = discountToQuick === null ? 0 : clamp(Math.round(25 + discountToQuick * 180));

  const confidenceValues = Object.values(input.extractionConfidence || {}).filter((value) => Number.isFinite(value));
  const extractionAverage = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
    : 60;
  const ice = clamp(Math.round(marketConfidence * 0.72 + extractionAverage * 0.28));
  const radarScore = Math.round((iao * 0.5 + iam * 0.3 + ice * 0.2) * 10) / 10;

  const exactComparables = input.comparables.filter((item) => item?.match === "exact").length;
  const exactSoldComparables = input.comparables.filter((item) => item?.match === "exact" && item?.kind === "sold").length;
  const evidenceReady = Boolean(
    input.modelConfirmed
    && quickResale !== null
    && quickResale > 0
    && marketConfidence >= 70
    && exactComparables >= 2
    && exactSoldComparables >= 1,
  );
  const authGate = (input.authGate || "N/A").toUpperCase();
  const capitalGate = (input.capitalGate || "N/A").toUpperCase();
  const conditionGate = (input.conditionGate || "PENDENTE").toUpperCase();
  const gateBlocks: string[] = [];
  if (input.authenticityRequired && authGate !== "OK") gateBlocks.push("Autenticidade pendente para item de alto risco");
  else if (["PENDENTE", "BLOQUEADO", "NÃO", "NAO"].includes(authGate)) gateBlocks.push("Autenticidade não confirmada");
  if (["NÃO", "NAO", "BLOQUEADO"].includes(capitalGate)) gateBlocks.push("Capital indisponível ou concentração excessiva");
  if (conditionGate !== "OK") gateBlocks.push("Condição/funcionamento não confirmados");
  const capitalBlocked = ["NÃO", "NAO", "BLOQUEADO"].includes(capitalGate);
  const purchaseGatesReady = gateBlocks.length === 0;
  const needsVerification = !evidenceReady || !purchaseGatesReady;
  const overpriced = netQuickResale !== null && netQuickResale > 0 && totalCost > netQuickResale * 0.8;

  let verdict: RadarEvaluation["verdict"] = "PASSAR";
  if (overpriced || capitalBlocked) verdict = "PASSAR";
  else if (!evidenceReady || !purchaseGatesReady) verdict = "NEGOCIAR";
  else if (maxPurchase !== null && totalCost <= maxPurchase && radarScore >= 78) verdict = "COMPRAR";
  else if (netQuickResale !== null && totalCost <= netQuickResale * 0.8) verdict = "NEGOCIAR";

  return {
    maxPurchase,
    iao,
    iam,
    ice,
    radarScore,
    verdict,
    needsVerification,
    evidenceReady,
    exactComparables,
    exactSoldComparables,
    totalAcquisitionCost: totalCost,
    quickNetProfit,
    likelyNetProfit,
    gateBlocks,
  };
}
