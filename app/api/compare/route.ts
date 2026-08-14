import { gateway, generateText } from "ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 45;

type SourcePage = {
  title: string;
  url: string;
  text: string;
};

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

function n(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0) || "";
}

function normalizeSearchOutput(output: unknown): SourcePage[] {
  if (!output || typeof output !== "object") return [];
  const record = output as Record<string, unknown>;
  const candidates = Array.isArray(record.results)
    ? record.results
    : Array.isArray(record.sources)
      ? record.sources
      : [];

  return candidates
    .filter((candidate): candidate is Record<string, unknown> => !!candidate && typeof candidate === "object")
    .map((candidate) => {
      const url = firstString(candidate.url, candidate.link, candidate.sourceUrl);
      if (!url) return null;
      return {
        title: firstString(candidate.title),
        url,
        text: firstString(candidate.excerpt, candidate.snippet, candidate.text, candidate.content).slice(0, 5500),
      };
    })
    .filter((page): page is SourcePage => page !== null)
    .slice(0, 8);
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

function buildQuery(payload: MarketPayload) {
  const item = [payload.brand, payload.model].filter(Boolean).join(" ").trim();
  const category = payload.category || "produto";
  const exactness = payload.model
    ? `Priorize o modelo/referência exatos: ${payload.model}.`
    : "A referência exata não foi confirmada; procure apenas comparáveis muito próximos e deixe clara a incerteza.";

  return [
    `Pesquise preços atuais e vendas realizadas de ${item || category}.`,
    exactness,
    "Priorize Brasil e preços em reais. Para relógios, diferencie referência exata de modelos apenas parecidos e considere originalidade/estado.",
    "Para cartas Pokémon, diferencie carta exata, idioma, edição, número e graduação; PSA/CGC/BGS e raw não são equivalentes.",
    "Priorize vendas concluídas quando existirem; depois anúncios ativos. Evite MSRP/preço de tabela como comparável de revenda.",
    "Retorne fontes com preços concretos, data/estado quando disponível e URL da página.",
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
    const query = buildQuery(payload);

    const search = await generateText({
      model: modelId,
      prompt: query,
      tools: {
        perplexity_search: gateway.tools.perplexitySearch({
          maxResults: 8,
          maxTokensPerPage: 1200,
          maxTokens: 9000,
          country: "BR",
          searchLanguageFilter: ["pt", "en"],
        }),
      },
      toolChoice: { type: "tool", toolName: "perplexity_search" },
    });

    const sources = search.toolResults
      .filter((result) => result.toolName === "perplexity_search")
      .flatMap((result) => normalizeSearchOutput(result.output));

    if (sources.length === 0) {
      return NextResponse.json({ error: "A pesquisa não encontrou fontes utilizáveis. Confirme a referência/modelo e tente novamente." }, { status: 422 });
    }

    const extractionConfidence = payload.extractionConfidence || {};
    const prompt = `
Você é o motor de avaliação do Radar Arbitrage. Analise SOMENTE as fontes de pesquisa fornecidas abaixo e produza JSON puro, sem markdown.

ITEM ANALISADO
Categoria: ${payload.category || "não informada"}
Marca: ${brand}
Modelo/referência: ${model || "não confirmada"}
Preço pedido: R$ ${askingPrice}
Frete/taxas de entrada: R$ ${fees}
Plataforma: ${payload.sourcePlatform || "não informada"}
Vendedor: ${payload.seller || "não informado"}
Notas do anúncio: ${payload.notes || "nenhuma"}
Confiança da extração: ${JSON.stringify(extractionConfidence)}

FONTES ENCONTRADAS
${JSON.stringify(sources, null, 2)}

REGRAS
1. Não use conhecimento de memória para preço. Use apenas as fontes acima.
2. Não trate MSRP/preço riscado como valor de mercado.
3. Vendas concluídas valem mais que anúncios ativos. Informe no campo kind: sold, asking ou unknown.
4. Só aceite como comparável forte o mesmo modelo/referência. Se a referência não estiver confirmada, reduza marketConfidence e explique.
5. Para Pokémon, mesma carta/edição/número/idioma/grade são essenciais. Uma carta raw não é comparável direto de PSA 9.
6. quickResale deve ser um preço conservador para vender relativamente rápido; likelyResale é preço provável com alguma espera. Ambos em BRL. Se não houver dados suficientes, use null.
7. desirability é 0-100 e representa procura/liquidez do ativo, apoiada pelas fontes; não confunda com desconto da oferta.
8. marketConfidence é 0-100. Abaixo de 50 significa que NÃO se deve comprar ainda com base nessa pesquisa.
9. riskFlags deve apontar problemas como referência incerta, autenticidade, graduação não comprovada, condição divergente ou comparáveis fracos.
10. Retorne no máximo 6 comparáveis, sempre usando URLs presentes nas fontes fornecidas.

Formato exato:
{
  "marketLow": number|null,
  "marketMedian": number|null,
  "marketHigh": number|null,
  "quickResale": number|null,
  "likelyResale": number|null,
  "desirability": number,
  "marketConfidence": number,
  "rationale": "texto curto",
  "riskFlags": ["..."],
  "comparables": [
    {"title":"...","url":"...","priceBRL":number|null,"kind":"sold|asking|unknown","match":"exact|close|weak","note":"..."}
  ]
}`.trim();

    const synthesis = await generateText({
      model: modelId,
      prompt,
      maxOutputTokens: 1800,
    });

    let market: any;
    try {
      market = parseJson(synthesis.text);
    } catch {
      console.warn("Radar compare JSON parse failed", synthesis.text.slice(0, 1200));
      return NextResponse.json({ error: "A pesquisa terminou, mas a avaliação não retornou dados estruturados. Tente novamente." }, { status: 502 });
    }

    const quickResale = n(market.quickResale);
    const likelyResale = n(market.likelyResale);
    const marketConfidence = clamp(Math.round(n(market.marketConfidence) ?? 0));
    const desirability = clamp(Math.round(n(market.desirability) ?? 50));
    const totalCost = askingPrice + fees;
    const maxPurchase = quickResale === null ? null : Math.max(0, Math.round(quickResale * 0.65 - fees));
    const discountToQuick = quickResale && quickResale > 0 ? (quickResale - totalCost) / quickResale : null;
    const iao = discountToQuick === null ? 0 : clamp(Math.round(25 + discountToQuick * 180));

    const extractionValues = Object.values(extractionConfidence).filter((value) => Number.isFinite(value));
    const extractionAvg = extractionValues.length
      ? extractionValues.reduce((sum, value) => sum + value, 0) / extractionValues.length
      : 60;
    const ice = clamp(Math.round(marketConfidence * 0.72 + extractionAvg * 0.28));
    const iam = desirability;
    const radarScore = Math.round((iao * 0.5 + iam * 0.3 + ice * 0.2) * 10) / 10;

    const exactComps = Array.isArray(market.comparables)
      ? market.comparables.filter((comp: any) => comp?.match === "exact").length
      : 0;
    const needsVerification = marketConfidence < 50 || quickResale === null || exactComps < (model ? 1 : 0);

    let verdict = "PASSAR";
    if (needsVerification) {
      verdict = "NEGOCIAR";
    } else if (maxPurchase !== null && totalCost <= maxPurchase && radarScore >= 78) {
      verdict = "COMPRAR";
    } else if (quickResale !== null && totalCost <= quickResale * 0.8) {
      verdict = "NEGOCIAR";
    }

    const riskFlags = Array.isArray(market.riskFlags) ? market.riskFlags.map(String).slice(0, 8) : [];
    if (needsVerification) riskFlags.unshift("Dados insuficientes para compra automática; aprofundar antes de pagar.");

    return NextResponse.json({
      marketLow: n(market.marketLow),
      marketMedian: n(market.marketMedian),
      marketHigh: n(market.marketHigh),
      quickResale,
      likelyResale,
      maxPurchase,
      iao,
      iam,
      ice,
      radarScore,
      verdict,
      needsVerification,
      marketConfidence,
      rationale: String(market.rationale || ""),
      riskFlags: [...new Set(riskFlags)],
      comparables: Array.isArray(market.comparables) ? market.comparables.slice(0, 6) : [],
      sourcesSearched: sources.length,
    });
  } catch (error) {
    console.error("Radar compare error", error);
    return NextResponse.json({ error: "Falha ao pesquisar comparáveis no momento." }, { status: 500 });
  }
}
