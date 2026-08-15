import { gateway, generateText, jsonSchema, Output, stepCountIs } from "ai";
import { NextResponse } from "next/server";
import { guardApiRequest } from "../../../lib/api-guard";
import { evaluateMarket, finiteNumber as n } from "../../../lib/radar-evaluation";

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
type MarketResearch = {
  marketLow: number | null;
  marketMedian: number | null;
  marketHigh: number | null;
  quickResale: number | null;
  likelyResale: number | null;
  desirability: number;
  marketConfidence: number;
  rationale: string;
  riskFlags: string[];
  comparables: Array<{
    title: string;
    url: string;
    priceBRL: number | null;
    kind: "sold" | "asking" | "unknown";
    match: "exact" | "close" | "weak";
    note: string;
  }>;
};

const marketOutputSchema = jsonSchema<MarketResearch>({
  type: "object",
  additionalProperties: false,
  required: ["marketLow", "marketMedian", "marketHigh", "quickResale", "likelyResale", "desirability", "marketConfidence", "rationale", "riskFlags", "comparables"],
  properties: {
    marketLow: { type: ["number", "null"] },
    marketMedian: { type: ["number", "null"] },
    marketHigh: { type: ["number", "null"] },
    quickResale: { type: ["number", "null"] },
    likelyResale: { type: ["number", "null"] },
    desirability: { type: "number" },
    marketConfidence: { type: "number" },
    rationale: { type: "string" },
    riskFlags: { type: "array", items: { type: "string" }, maxItems: 7 },
    comparables: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url", "priceBRL", "kind", "match", "note"],
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          priceBRL: { type: ["number", "null"] },
          kind: { type: "string", enum: ["sold", "asking", "unknown"] },
          match: { type: "string", enum: ["exact", "close", "weak"] },
          note: { type: "string" },
        },
      },
    },
  },
});

const firstString = (...values: unknown[]) => values.find((value): value is string => typeof value === "string" && value.trim().length > 0) || "";

function normalizeSearchOutput(output: unknown): SourcePage[] {
  if (!output || typeof output !== "object") return [];
  const record = output as Record<string, unknown>;
  const candidates = Array.isArray(record.results) ? record.results : Array.isArray(record.sources) ? record.sources : [];
  return candidates
    .filter((candidate): candidate is Record<string, unknown> => !!candidate && typeof candidate === "object")
    .map((candidate) => {
      const url = firstString(candidate.url, candidate.link, candidate.sourceUrl);
      if (!url) return null;
      return {
        title: firstString(candidate.title),
        url,
        text: firstString(candidate.excerpt, candidate.snippet, candidate.text, candidate.content).slice(0, 2_200),
      };
    })
    .filter((source): source is SourcePage => source !== null);
}

function sourceUrlKey(raw: string) {
  try {
    const url = new URL(raw);
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function uniqueSources(sources: SourcePage[]) {
  const byUrl = new Map<string, SourcePage>();
  for (const source of sources) {
    const key = sourceUrlKey(source.url);
    if (key && !byUrl.has(key)) byUrl.set(key, source);
  }
  return Array.from(byUrl.values()).slice(0, 5);
}

function searchPrompt(payload: MarketPayload, askingPrice: number, fees: number) {
  const brand = String(payload.brand || "").trim();
  const model = String(payload.model || "").trim();
  return `Você é o pesquisador do Radar Arbitrage.

Chame perplexity_search EXATAMENTE UMA VEZ, agora, com UMA consulta ampla sobre o item abaixo. Não responda com análise e não divida a busca em várias chamadas.

ITEM
Categoria: ${payload.category || "não informada"}
Marca: ${brand}
Modelo/referência: ${model || "não confirmada"}
Preço pedido: R$ ${askingPrice}
Frete/taxas de entrada: R$ ${fees}
Plataforma: ${payload.sourcePlatform || "não informada"}
Vendedor: ${payload.seller || "não informado"}
Notas: ${payload.notes || "nenhuma"}

REGRAS DA PESQUISA
- Priorize o modelo/referência exatos, vendas concluídas e Brasil.
- Ignore MSRP, preço riscado, parcelas, cupom e preço de tabela.
- Relógios: referência, originalidade e condição precisam ser comparáveis.
- Pokémon: carta, edição, número, idioma e grade precisam coincidir; raw não equivale a PSA 9.
- Aceite fontes internacionais somente quando o mercado brasileiro for escasso.`;
}

function evaluationPrompt(payload: MarketPayload, askingPrice: number, fees: number, sources: SourcePage[]) {
  return `Você é o avaliador conservador do Radar Arbitrage. Retorne somente JSON válido conforme o esquema solicitado.

Avalie o item abaixo usando SOMENTE as fontes fornecidas. Não use memória para preço.

ITEM
Categoria: ${payload.category || "não informada"}
Marca: ${payload.brand || "não informada"}
Modelo/referência: ${payload.model || "não confirmada"}
Preço pedido: R$ ${askingPrice}
Frete/taxas de entrada: R$ ${fees}
Plataforma: ${payload.sourcePlatform || "não informada"}
Notas: ${payload.notes || "nenhuma"}

FONTES
${JSON.stringify(sources)}

REGRAS DA AVALIAÇÃO
- Só marque match=exact quando o modelo/referência realmente coincide.
- kind=sold exige evidência de venda concluída; caso contrário use asking ou unknown.
- quickResale é preço conservador para venda rápida; likelyResale é preço provável com espera.
- desirability e marketConfidence vão de 0 a 100.
- URLs dos comparáveis devem ser copiadas exatamente das fontes acima.
- No máximo 5 comparáveis.
- Quando faltarem dados confiáveis, use null, reduza marketConfidence e explique em riskFlags.`;
}

export async function POST(request: Request) {
  const denied = guardApiRequest(request, "compare");
  if (denied) return denied;

  try {
    const payload = (await request.json()) as MarketPayload;
    const askingPrice = n(payload.askingPrice);
    const fees = n(payload.fees) ?? 0;
    const brand = String(payload.brand || "").trim();
    const model = String(payload.model || "").trim();

    if (!brand) return NextResponse.json({ error: "Confirme a marca antes de pesquisar comparáveis." }, { status: 400 });
    if (askingPrice === null || askingPrice <= 0) return NextResponse.json({ error: "Informe o preço pedido antes de avaliar a arbitragem." }, { status: 400 });

    const modelId = process.env.RADAR_AI_MODEL || "alibaba/qwen3.5-flash";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 70_000);

    let sources: SourcePage[] = [];
    let market: MarketResearch;
    try {
      const runSearch = () => generateText({
        model: modelId,
        prompt: searchPrompt(payload, askingPrice, fees),
        tools: {
          perplexity_search: gateway.tools.perplexitySearch({
            maxResults: 5,
            maxTokensPerPage: 500,
            maxTokens: 2_800,
            country: "BR",
            searchLanguageFilter: ["pt", "en"],
          }),
        },
        // Qwen's thinking mode rejects forced/required tool_choice. With only
        // the search tool available, `auto` remains portable.
        toolChoice: "auto" as const,
        stopWhen: stepCountIs(1),
        // Tool arguments share this budget with thinking tokens. A small
        // budget intermittently truncated the function-call JSON.
        maxOutputTokens: 600,
        abortSignal: controller.signal,
      });

      let search: Awaited<ReturnType<typeof runSearch>> | undefined;
      for (let attempt = 1; attempt <= 2 && !search; attempt += 1) {
        try {
          search = await runSearch();
        } catch (error) {
          if (controller.signal.aborted || attempt === 2) throw error;
          console.warn("Radar compare search retry", error);
        }
      }

      if (!search) throw new Error("Market search did not start.");

      sources = uniqueSources(
        search.steps.flatMap((step) => step.toolResults)
          .filter((result) => result.toolName === "perplexity_search")
          .flatMap((result) => normalizeSearchOutput(result.output)),
      );

      if (!sources.length) {
        return NextResponse.json({ error: "A pesquisa não encontrou comparáveis utilizáveis. Confirme a referência/modelo e tente novamente." }, { status: 422 });
      }

      const evaluation = await generateText({
        model: modelId,
        prompt: evaluationPrompt(payload, askingPrice, fees, sources),
        output: Output.object({
          name: "radar_market_evaluation",
          description: "Conservative resale market evidence and comparable listings for Radar Arbitrage.",
          schema: marketOutputSchema,
        }),
        // Thinking tokens count against this budget on Qwen. Leave enough room
        // for reasoning plus the complete validated object.
        maxOutputTokens: 3_200,
        abortSignal: controller.signal,
      });
      market = evaluation.output;
    } catch (error) {
      if (controller.signal.aborted) {
        return NextResponse.json({ error: "A pesquisa de mercado excedeu 70 segundos. Tente novamente." }, { status: 504 });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }

    const allowedUrls = new Set(sources.map((source) => sourceUrlKey(source.url)));
    const modelComparables = (Array.isArray(market.comparables) ? market.comparables : [])
      .filter((comparable: any) => comparable && allowedUrls.has(sourceUrlKey(String(comparable.url || ""))))
      .slice(0, 5);
    const representedUrls = new Set(modelComparables.map((comparable) => sourceUrlKey(comparable.url)));
    const comparables = [
      ...modelComparables,
      ...sources
        .filter((source) => !representedUrls.has(sourceUrlKey(source.url)))
        .map((source) => ({
          title: source.title || "Fonte pesquisada",
          url: source.url,
          priceBRL: null,
          kind: "unknown" as const,
          match: "weak" as const,
          note: source.text.slice(0, 180) || "Fonte consultada; preço e equivalência ainda precisam de confirmação.",
        })),
    ].slice(0, 5);

    const quickResale = n(market.quickResale);
    const likelyResale = n(market.likelyResale);
    const marketConfidence = Math.max(0, Math.min(100, Math.round(n(market.marketConfidence) ?? 0)));
    const evaluation = evaluateMarket({
      askingPrice,
      fees,
      modelConfirmed: Boolean(model),
      quickResale,
      desirability: n(market.desirability),
      marketConfidence,
      extractionConfidence: payload.extractionConfidence,
      comparables,
    });

    const riskFlags = Array.isArray(market.riskFlags) ? market.riskFlags.map(String).slice(0, 7) : [];
    if (evaluation.needsVerification) {
      riskFlags.unshift(
        `Compra automática bloqueada: exige 2 comparáveis exatos, incluindo 1 venda concluída; encontrados ${evaluation.exactComparables} exatos e ${evaluation.exactSoldComparables} vendidos.`,
      );
    }

    return NextResponse.json({
      marketLow: n(market.marketLow),
      marketMedian: n(market.marketMedian),
      marketHigh: n(market.marketHigh),
      quickResale,
      likelyResale,
      maxPurchase: evaluation.maxPurchase,
      iao: evaluation.iao,
      iam: evaluation.iam,
      ice: evaluation.ice,
      radarScore: evaluation.radarScore,
      verdict: evaluation.verdict,
      needsVerification: evaluation.needsVerification,
      marketConfidence,
      rationale: String(market.rationale || ""),
      riskFlags: [...new Set(riskFlags)],
      comparables,
      sourcesSearched: sources.length,
    });
  } catch (error) {
    console.error("Radar compare error", error);
    return NextResponse.json({ error: "Falha ao pesquisar comparáveis no momento." }, { status: 500 });
  }
}
