import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type PageContext = {
  title: string;
  description: string;
  text: string;
  fetchWarning: string;
};

type Analysis = {
  mode: "ai" | "heuristic";
  category: string;
  brand: string;
  model: string;
  sourcePlatform: string;
  seller: string;
  askingPrice: number | null;
  notes: string;
  url: string;
  confidence: Record<string, number>;
  warnings: string[];
};

const BRANDS = [
  "Orient", "Seiko", "Citizen", "Casio", "Bulova", "Mido", "Omega", "Rolex", "Tissot", "Technos", "Invicta", "Eterna", "Longines", "Hamilton", "Timex", "Fossil", "Cartier", "Nike", "Apple", "Motorola", "Samsung", "Sony", "Nintendo",
];

const PLATFORM_MAP: Array<[RegExp, string]> = [
  [/olx\./i, "OLX"],
  [/facebook\.com/i, "Facebook"],
  [/enjoei\.com/i, "Enjoei"],
  [/mercadolivre|mercadolibre/i, "Mercado Livre"],
  [/amazon\./i, "Amazon"],
  [/chrono24/i, "Chrono24"],
  [/antig\.com\.br/i, "Antig"],
  [/leiloesbr\.com\.br/i, "LeiloesBR"],
  [/superbid/i, "Superbid"],
];

function platformFromUrl(url: string) {
  return PLATFORM_MAP.find(([pattern]) => pattern.test(url))?.[1] || "";
}

function parseMoney(text: string): number | null {
  const matches = [...text.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:,[0-9]{2})?)/gi)];
  for (const match of matches) {
    const value = Number(match[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(value) && value >= 10) return value;
  }
  return null;
}

function brandFromText(text: string) {
  return BRANDS.find((brand) => new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) || "";
}

function referenceFromText(text: string, brand: string) {
  const upper = text.toUpperCase();
  const patterns = [
    /\b[A-Z]{1,6}-?\d{3,5}(?:[-./][A-Z0-9]{2,8}){0,3}[A-Z]{0,5}\b/g,
    /\b\d{4}[-.]\d{2,4}\b/g,
    /\b\d{4,5}\b/g,
  ];
  const ignored = new Set(["2024", "2025", "2026", "1970", "1980", "1990", "2000", "2010", "2020"]);
  for (const pattern of patterns) {
    for (const match of upper.matchAll(pattern)) {
      const candidate = match[0];
      if (ignored.has(candidate)) continue;
      if (brand && candidate === brand.toUpperCase()) continue;
      return candidate;
    }
  }
  return "";
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function titleFromHtml(html: string) {
  return meta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function isPrivateAddress(address: string) {
  if (address === "::1" || address === "0.0.0.0") return true;
  if (address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite)) {
    const [a, b] = parts;
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
  }
  return false;
}

async function safeListingUrl(raw: string) {
  if (!raw) return null;
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Use um link http:// ou https://.");
  if (["localhost", "localhost.localdomain"].includes(parsed.hostname) || parsed.hostname.endsWith(".local")) throw new Error("Endereço local não permitido.");

  if (isIP(parsed.hostname)) {
    if (isPrivateAddress(parsed.hostname)) throw new Error("Endereço privado não permitido.");
  } else {
    const addresses = await lookup(parsed.hostname, { all: true });
    if (addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Endereço privado não permitido.");
  }
  return parsed;
}

async function fetchPage(url: URL | null): Promise<PageContext> {
  if (!url) return { title: "", description: "", text: "", fetchWarning: "" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; RadarArbitrage/1.0; +https://vercel.app)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
      },
      cache: "no-store",
    });
    if (!response.ok) return { title: "", description: "", text: "", fetchWarning: `A página respondeu HTTP ${response.status}; use prints para completar a leitura.` };
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html")) return { title: "", description: "", text: "", fetchWarning: "O link não retornou uma página HTML legível." };
    const html = (await response.text()).slice(0, 900_000);
    const title = titleFromHtml(html);
    const description = meta(html, "og:description") || meta(html, "description");
    const text = stripHtml(html).slice(0, 14_000);
    return { title, description, text, fetchWarning: "" };
  } catch {
    return { title: "", description: "", text: "", fetchWarning: "Não consegui ler a página diretamente; os prints ainda podem ser analisados." };
  } finally {
    clearTimeout(timer);
  }
}

function heuristic(url: string, page: PageContext): Analysis {
  const compact = [page.title, page.description, page.text].filter(Boolean).join("\n");
  const brand = brandFromText(compact);
  const model = referenceFromText([page.title, page.description].join(" "), brand);
  const sourcePlatform = platformFromUrl(url);
  const askingPrice = parseMoney([page.title, page.description, page.text.slice(0, 2500)].join(" "));
  const warnings = [page.fetchWarning].filter(Boolean);
  if (!brand) warnings.push("Marca não confirmada automaticamente.");
  if (!model) warnings.push("Referência/modelo não confirmado; deixe em branco até haver evidência.");
  if (askingPrice === null) warnings.push("Preço atual não foi localizado com segurança.");
  return {
    mode: "heuristic",
    category: brand ? "Relógio" : "",
    brand,
    model,
    sourcePlatform,
    seller: "",
    askingPrice,
    notes: page.title ? `Título capturado: ${page.title}` : "",
    url,
    confidence: {
      brand: brand ? 70 : 0,
      model: model ? 55 : 0,
      askingPrice: askingPrice !== null ? 55 : 0,
      sourcePlatform: sourcePlatform ? 100 : 0,
      seller: 0,
    },
    warnings,
  };
}

async function fileToDataUrl(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

function outputText(result: any) {
  if (typeof result?.output_text === "string") return result.output_text;
  for (const item of result?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

async function analyzeWithAI(url: string, page: PageContext, images: File[], fallback: Analysis, runtimeOidcToken: string | null): Promise<Analysis> {
  const token = process.env.AI_GATEWAY_API_KEY || runtimeOidcToken || process.env.VERCEL_OIDC_TOKEN;
  if (!token) return { ...fallback, warnings: [...fallback.warnings, "IA sem credencial disponível no runtime; usei leitura básica."] };

  const content: any[] = [{
    type: "input_text",
    text: `Você extrai dados factuais de anúncios para o Radar Arbitrage.\n\nREGRAS:\n- Não estime valor de mercado, revenda, autenticidade, IAO, IAM, ICE ou lucro.\n- Não invente referência/modelo. Se não estiver legível ou explícito, deixe model vazio.\n- askingPrice é o preço ATUAL pedido pelo vendedor. Ignore preço riscado, MSRP, parcelas, cashback e cupom, a menos que seja claramente o preço final atual.\n- seller é somente o nome/identificador do anunciante se estiver explícito.\n- notes deve registrar apenas fatos úteis visíveis: funcionamento alegado, caixa/manual, pulseira, defeitos declarados, revisão alegada, referência gravada etc. Diferencie "alegado" de "visível".\n- confidence vai de 0 a 100 por campo.\n- Se houver conflito entre texto e imagem, registre em warnings.\n\nURL: ${url || "não informado"}\nPlataforma inferida pelo endereço: ${fallback.sourcePlatform || "não identificada"}\nTítulo da página: ${page.title || "indisponível"}\nDescrição da página: ${page.description || "indisponível"}\nTrecho da página: ${page.text || "indisponível"}\nAviso de captura: ${page.fetchWarning || "nenhum"}`,
  }];

  for (const image of images) {
    content.push({ type: "input_image", image_url: await fileToDataUrl(image), detail: "high" });
  }

  const schema = {
    type: "object",
    properties: {
      category: { type: "string" },
      brand: { type: "string" },
      model: { type: "string" },
      sourcePlatform: { type: "string" },
      seller: { type: "string" },
      askingPrice: { type: ["number", "null"] },
      notes: { type: "string" },
      confidence: {
        type: "object",
        properties: {
          brand: { type: "integer", minimum: 0, maximum: 100 },
          model: { type: "integer", minimum: 0, maximum: 100 },
          askingPrice: { type: "integer", minimum: 0, maximum: 100 },
          sourcePlatform: { type: "integer", minimum: 0, maximum: 100 },
          seller: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["brand", "model", "askingPrice", "sourcePlatform", "seller"],
        additionalProperties: false,
      },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: ["category", "brand", "model", "sourcePlatform", "seller", "askingPrice", "notes", "confidence", "warnings"],
    additionalProperties: false,
  };

  const response = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      model: process.env.RADAR_AI_MODEL || "openai/gpt-5.4",
      input: [{ role: "user", content }],
      reasoning: { effort: "low" },
      max_output_tokens: 1200,
      text: { format: { type: "json_schema", name: "radar_listing_extract", strict: true, schema } },
    }),
  });

  if (!response.ok) {
    const gatewayError = (await response.text()).slice(0, 800);
    console.warn("Radar AI Gateway error", response.status, gatewayError);
    return { ...fallback, warnings: [...fallback.warnings, `IA indisponível (${response.status}); usei leitura básica da página.`] };
  }
  const result = await response.json();
  const text = outputText(result);
  if (!text) return { ...fallback, warnings: [...fallback.warnings, "A IA não retornou dados estruturados; usei leitura básica."] };

  try {
    const parsed = JSON.parse(text);
    return {
      mode: "ai",
      category: parsed.category || fallback.category,
      brand: parsed.brand || fallback.brand,
      model: parsed.model || "",
      sourcePlatform: parsed.sourcePlatform || fallback.sourcePlatform,
      seller: parsed.seller || "",
      askingPrice: typeof parsed.askingPrice === "number" ? parsed.askingPrice : fallback.askingPrice,
      notes: parsed.notes || fallback.notes,
      url,
      confidence: parsed.confidence || fallback.confidence,
      warnings: [...new Set([page.fetchWarning, ...(parsed.warnings || [])].filter(Boolean))],
    };
  } catch {
    return { ...fallback, warnings: [...fallback.warnings, "Resposta da IA não pôde ser interpretada; usei leitura básica."] };
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const rawUrl = String(form.get("url") || "").trim();
    const files = form.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!rawUrl && files.length === 0) return NextResponse.json({ error: "Cole um link ou envie pelo menos um print." }, { status: 400 });
    if (files.length > 4) return NextResponse.json({ error: "Envie no máximo 4 imagens por análise." }, { status: 400 });

    let totalBytes = 0;
    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return NextResponse.json({ error: "Use imagens JPG, PNG ou WebP." }, { status: 400 });
      if (file.size > 5_000_000) return NextResponse.json({ error: `A imagem ${file.name || "enviada"} passa de 5 MB.` }, { status: 400 });
      totalBytes += file.size;
    }
    if (totalBytes > 12_000_000) return NextResponse.json({ error: "O conjunto de imagens passa de 12 MB. Envie menos prints ou arquivos menores." }, { status: 400 });

    const parsedUrl = rawUrl ? await safeListingUrl(rawUrl) : null;
    const canonicalUrl = parsedUrl?.href || "";
    const page = await fetchPage(parsedUrl);
    const fallback = heuristic(canonicalUrl, page);
    const runtimeOidcToken = request.headers.get("x-vercel-oidc-token");
    const result = await analyzeWithAI(canonicalUrl, page, files, fallback, runtimeOidcToken);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao analisar o anúncio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
