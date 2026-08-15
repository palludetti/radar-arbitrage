export type ComparableEvidence = {
  kind?: "sold" | "asking" | "unknown" | string;
  match?: "exact" | "close" | "weak" | string;
};

type EvaluationInput = {
  askingPrice: number;
  fees: number;
  modelConfirmed: boolean;
  quickResale: number | null;
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
  const totalCost = input.askingPrice + input.fees;
  const quickResale = input.quickResale;
  const maxPurchase = quickResale === null ? null : Math.max(0, Math.round(quickResale * 0.65 - input.fees));
  const discountToQuick = quickResale && quickResale > 0 ? (quickResale - totalCost) / quickResale : null;
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
  const needsVerification = !evidenceReady;
  const overpriced = quickResale !== null && quickResale > 0 && totalCost > quickResale * 0.8;

  let verdict: RadarEvaluation["verdict"] = "PASSAR";
  if (overpriced) verdict = "PASSAR";
  else if (!evidenceReady) verdict = "NEGOCIAR";
  else if (maxPurchase !== null && totalCost <= maxPurchase && radarScore >= 78) verdict = "COMPRAR";
  else if (quickResale !== null && totalCost <= quickResale * 0.8) verdict = "NEGOCIAR";

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
  };
}
