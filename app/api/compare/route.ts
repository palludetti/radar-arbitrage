import { gateway, generateText } from "ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 90;

type MarketPayload = {
  category?: string;
  brand?: string;
  model?: string;
  askingPrice?: number | null;
  fees?: number | null;
  sourcePlatform?: string;
  seller?: string;
  notes?: string;
  extractionConfidence?: Record<string, number>;
};

type SourcePage = { title: string; url: string; text: string };

const n = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const firstString = (...values: unknown[]) => values.find((v): v is string => typeof v === "string" && v.trim().length > 0) || "";

function normalizeSearchOutput(output: unknown): SourcePage[] {
  if (!output || typeof output !== "object") return [];
  const record = output as Record<string, unknown>;
  const candidates = Array.isArray(record.results) ? record.results : Array.isArray(record.sources) ? record.sources : [];
  return candidates
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => {
      const url = firstString(x.url, x.link, x.sourceUrl);
      if (!url) return null;
      return {
        title: firstString(x.title),
        url,
        text: firstString(x.excerpt, x.snippet, x.text, x.content).slice(0, 2600),
      };
    })
    .filter((x): x is SourcePage => x !== null)
    .slice(0, 5);
}

function parseJson(text: string) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
}

function queryFor(payload: MarketPayload) {
  const item = [payload.brand, payload.model].filter(Boolean).join(" ").trim();
  return [
    "Use perplexity_search para pesquisar comparáveis de preço; não responda só de memória.",
    `Item: ${item || payload.category || "produto"}.`,
    payload.model ? `Priorize exatamente a referência/modelo ${payload.model}.` : "A referência exata não foi confirmada; sinalize isso.",
    "Priorize vendas concluídas; depois anúncios ativos. Ignore MSRP e preço riscado.",
    "Para relógios, referência, originalidade e condição precisam ser comparáveis.",
    "Para Pokémon, carta, edição, número, idioma e grade precisam coincidir; raw e PSA 9 não são equivalentes.",
    "Priorize Brasil, mas aceite fontes internacionais quando o mercado brasileiro for escasso. Busque preços concretos e URLs.",
  ].join(" ");
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as MarketPayload;
    const askingPrice = n(payload.askingPrice);
    const fees = n(payload.fees) ?? 0;
    const brand = String(payload.brand || "").trim();
    const model = String(payload.model || "").trim();

    if (!brand) return NextResponse.json({ error: "Confirme a marca antes de pesquisar comparáveis." }, { status: 400 });
    if (askingPrice === null || askingPrice <= 0) return NextResponse.json({ error: "Informe o preço pedido antes de avaliar a arbitragem." }, { status: 400 });

    const modelId = process.env.RADAR_AI_MODEL || "alibaba/qwen3.5-flash";
    const search = await generateText({
      model: modelId,
      prompt: queryFor(payload),
      tools: {
        perplexity_search: gateway.tools.perplexitySearch({
          maxResults: 5,
          maxTokensPerPage: 650,
          maxTokens: 3500,
          country: "BR",
          searchLanguageFilter: ["pt", "en"],
        }),
      },
      maxOutputTokens: 180,
    });

    const sources = search.toolResults
      .filter((result) => result.toolName === "perplexity_search")
      .flatMap((result) => normalizeSearchOutput(result.output));

    if (!sources.length) {
      return NextResponse.json({ error: "A pesquisa não encontrou comparáveis utilizáveis. Confirme a referência/modelo e tente novamente." }, { status: 422 });
    }

    const prompt = `Você é o motor de avaliação do Radar Arbitrage. Use SOMENTE as fontes abaixo e retorne JSON puro, sem markdown.

ITEM
Categoria: ${payload.category || "não informada"}
Marca: ${brand}
Modelo/referência: ${model || "não confirmada"}
Preço pedido: R$ ${askingPrice}
Frete/taxas de entrada: R$ ${fees}
Plataforma: ${payload.sourcePlatform || "não informada"}
Vendedor: ${payload.seller || "não informado"}
Notas: ${payload.notes || "nenhuma"}

FONTES
${JSON.stringify(sources)}

REGRAS
- Não use memória para preço e não use MSRP/preço riscado como mercado.
- Venda concluída vale mais que anúncio ativo.
- Só marque match=exact se modelo/referência forem realmente os mesmos.
- Se a referência estiver incerta, reduza marketConfidence.
- Pokémon: carta/edição/número/idioma/grade devem coincidir; raw não equivale a PSA 9.
- quickResale = venda conservadora/rápida; likelyResale = provável com alguma espera; ambos BRL ou null.
- desirability 0-100 = procura/liquidez apoiada nas fontes.
- marketConfidence 0-100; abaixo de 50 não autoriza compra.
- No máximo 5 comparáveis e URLs somente das fontes fornecidas.

Formato:
{"marketLow":number|null,"marketMedian":number|null,"marketHigh":number|null,"quickResale":number|null,"likelyResale":number|null,"desirability":number,"marketConfidence":number,"rationale":"texto curto","riskFlags":["..."],"comparables":[{"title":"...","url":"...","priceBRL":number|null,"kind":"sold|asking|unknown","match":"exact|close|weak","note":"..."}]}`;

    const synthesis = await generateText({ model: modelId, prompt, maxOutputTokens: 1200 });
    let market: any;
    try {
      market = parseJson(synthesis.text);
    } catch {
      console.warn("Radar compare JSON parse failed", synthesis.text.slice(0, 1000));
      return NextResponse.json({ error: "A pesquisa terminou, mas a avaliação não retornou dados estruturados. Tente novamente." }, { status: 502 });
    }

    const quickResale = n(market.quickResale);
    const likelyResale = n(market.likelyResale);
    const marketConfidence = clamp(Math.round(n(market.marketConfidence) ?? 0));
    const iam = clamp(Math.round(n(market.desirability) ?? 50));
    const totalCost = askingPrice + fees;
    const maxPurchase = quickResale === null ? null : Math.max(0, Math.round(quickResale * 0.65 - fees));
    const discountToQuick = quickResale && quickResale > 0 ? (quickResale - totalCost) / quickResale : null;
    const iao = discountToQuick === null ? 0 : clamp(Math.round(25 + discountToQuick * 180));

    const extractionConfidence = payload.extractionConfidence || {};
    const values = Object.values(extractionConfidence).filter((v) => Number.isFinite(v));
    const extractionAvg = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 60;
    const ice = clamp(Math.round(marketConfidence * 0.72 + extractionAvg * 0.28));
    const radarScore = Math.round((iao * 0.5 + iam * 0.3 + ice * 0.2) * 10) / 10;

    const comps = Array.isArray(market.comparables) ? market.comparables.slice(0, 5) : [];
    const exactComps = comps.filter((comp: any) => comp?.match === "exact").length;
    const needsVerification = marketConfidence < 50 || quickResale === null || (model ? exactComps < 1 : true);

    let verdict: "COMPRAR" | "NEGOCIAR" | "PASSAR" = "PASSAR";
    if (needsVerification) verdict = "NEGOCIAR";
    else if (maxPurchase !== null && totalCost <= maxPurchase && radarScore >= 78) verdict = "COMPRAR";
    else if (quickResale !== null && totalCost <= quickResale * 0.8) verdict = "NEGOCIAR";

    const riskFlags = Array.isArray(market.riskFlags) ? market.riskFlags.map(String).slice(0, 7) : [];
    if (needsVerification) riskFlags.unshift("Dados insuficientes para compra automática; aprofundar antes de pagar.");

    return NextResponse.json({
      marketLow: n(market.marketLow), marketMedian: n(market.marketMedian), marketHigh: n(market.marketHigh),
      quickResale, likelyResale, maxPurchase, iao, iam, ice, radarScore, verdict, needsVerification,
      marketConfidence, rationale: String(market.rationale || ""), riskFlags: [...new Set(riskFlags)],
      comparables: comps, sourcesSearched: sources.length,
    });
  } catch (error) {
    console.error("Radar compare error", error);
    return NextResponse.json({ error: "Falha ao pesquisar comparáveis no momento." }, { status: 500 });
  }
}
