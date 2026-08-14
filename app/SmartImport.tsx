"use client";

import { useState, type RefObject } from "react";

type AnalysisResult = {
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

type Comparable = {
  title: string;
  url: string;
  priceBRL: number | null;
  kind: "sold" | "asking" | "unknown";
  match: "exact" | "close" | "weak";
  note: string;
};

type MarketResult = {
  marketLow: number | null;
  marketMedian: number | null;
  marketHigh: number | null;
  quickResale: number | null;
  likelyResale: number | null;
  maxPurchase: number | null;
  iao: number;
  iam: number;
  ice: number;
  radarScore: number;
  verdict: "COMPRAR" | "NEGOCIAR" | "PASSAR";
  needsVerification: boolean;
  marketConfidence: number;
  rationale: string;
  riskFlags: string[];
  comparables: Comparable[];
  sourcesSearched: number;
};

type Props = {
  formRef: RefObject<HTMLFormElement | null>;
};

const labels: Record<string, string> = {
  brand: "Marca",
  model: "Modelo",
  askingPrice: "Preço",
  sourcePlatform: "Plataforma",
  seller: "Vendedor",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function SmartImport({ formRef }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [marketBusy, setMarketBusy] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [market, setMarket] = useState<MarketResult | null>(null);

  function field(name: string) {
    return formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`) || null;
  }

  function value(name: string) {
    return field(name)?.value?.trim() || "";
  }

  function setField(name: string, next: string | number | null | undefined) {
    if (next === null || next === undefined || next === "") return;
    const target = field(name);
    if (target) target.value = String(next);
  }

  function appendNotes(lines: string[]) {
    const target = field("notes");
    if (!target) return;
    const extra = lines.filter(Boolean).join("\n");
    if (!extra) return;
    target.value = [target.value.trim(), extra].filter(Boolean).join("\n\n");
  }

  async function analyze() {
    const form = formRef.current;
    if (!form) return;
    const payload = new FormData(form);
    const url = String(payload.get("url") || "").trim();
    const images = payload.getAll("images").filter((x) => x instanceof File && x.size > 0);

    if (!url && images.length === 0) {
      setError("Cole um link ou envie pelo menos um print do anúncio.");
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);
    setMarket(null);
    setMarketError("");

    try {
      const response = await fetch("/api/analyze", { method: "POST", body: payload });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Não foi possível analisar este anúncio.");

      const analysis = data as AnalysisResult;
      setField("url", analysis.url);
      setField("category", analysis.category);
      setField("brand", analysis.brand);
      setField("model", analysis.model);
      setField("sourcePlatform", analysis.sourcePlatform);
      setField("seller", analysis.seller);
      setField("askingPrice", analysis.askingPrice);

      const notes = [analysis.notes, ...(analysis.warnings || []).map((w) => `⚠ ${w}`)].filter(Boolean).join("\n");
      setField("notes", notes);
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao analisar o anúncio.");
    } finally {
      setBusy(false);
    }
  }

  async function researchMarket() {
    const brand = value("brand");
    const askingPrice = Number(value("askingPrice"));
    if (!brand) {
      setMarketError("Confirme a marca antes de pesquisar comparáveis.");
      return;
    }
    if (!Number.isFinite(askingPrice) || askingPrice <= 0) {
      setMarketError("Informe o preço pedido antes de avaliar a arbitragem.");
      return;
    }

    setMarketBusy(true);
    setMarketError("");
    setMarket(null);

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: value("category"),
          brand,
          model: value("model"),
          askingPrice,
          fees: Number(value("fees")) || 0,
          sourcePlatform: value("sourcePlatform"),
          seller: value("seller"),
          notes: value("notes"),
          extractionConfidence: result?.confidence || {},
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Não foi possível pesquisar comparáveis.");

      const analysis = data as MarketResult;
      setField("maxPurchase", analysis.maxPurchase);
      setField("quickResale", analysis.quickResale);
      setField("likelyResale", analysis.likelyResale);
      setField("iao", analysis.iao);
      setField("iam", analysis.iam);
      setField("ice", analysis.ice);
      setField("verdict", analysis.verdict);
      setField("status", analysis.needsVerification ? "Aprofundar" : "Analisado");

      appendNotes([
        `RADAR MERCADO — ${analysis.verdict} · Score ${analysis.radarScore.toFixed(1)} · confiança ${analysis.marketConfidence}%`,
        analysis.rationale,
        analysis.riskFlags?.length ? `Riscos: ${analysis.riskFlags.join(" | ")}` : "",
        analysis.comparables?.length
          ? `Comparáveis:\n${analysis.comparables.map((comp) => `- ${comp.kind === "sold" ? "VENDA" : comp.kind === "asking" ? "ANÚNCIO" : "FONTE"} · ${comp.match} · ${comp.priceBRL ? brl.format(comp.priceBRL) : "preço não extraído"} · ${comp.title} · ${comp.url}`).join("\n")}`
          : "",
      ]);
      setMarket(analysis);
    } catch (err) {
      setMarketError(err instanceof Error ? err.message : "Falha ao pesquisar comparáveis.");
    } finally {
      setMarketBusy(false);
    }
  }

  const confidenceEntries = result
    ? Object.entries(result.confidence || {}).filter(([key, confidence]) => labels[key] && confidence > 0)
    : [];

  return (
    <section className="smart-import">
      <div className="smart-import-heading">
        <div>
          <p className="section-kicker">CAPTURA INTELIGENTE</p>
          <h3>Link + prints → campos preenchidos</h3>
          <p>Cole o anúncio e/ou envie screenshots. O Radar extrai dados factuais; você revisa antes de salvar.</p>
        </div>
        <span className="ai-pill">IA + leitura da página</span>
      </div>

      <div className="smart-import-grid">
        <label className="field smart-url">
          <span>Link do anúncio</span>
          <input name="url" type="url" placeholder="https://..." />
        </label>
        <label className="field smart-images">
          <span>Prints / fotos</span>
          <input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple />
        </label>
        <button className="button smart-analyze" type="button" onClick={analyze} disabled={busy}>
          {busy ? "Analisando…" : "✦ Analisar automaticamente"}
        </button>
      </div>

      {error && <div className="smart-message error">{error}</div>}
      {result && (
        <div className="smart-result">
          <div className="smart-result-top">
            <strong>{result.mode === "ai" ? "Análise visual + página concluída" : "Leitura automática do link concluída"}</strong>
            <span>{result.mode === "ai" ? "IA ativa" : "modo básico"}</span>
          </div>
          {confidenceEntries.length > 0 && (
            <div className="confidence-list">
              {confidenceEntries.map(([key, confidence]) => (
                <span key={key}>{labels[key]} <b>{Math.round(confidence)}%</b></span>
              ))}
            </div>
          )}
          {result.warnings?.length > 0 && <p>{result.warnings.join(" · ")}</p>}
          <small>Os campos abaixo foram preenchidos quando havia evidência suficiente. Referência incerta fica em branco em vez de ser inventada.</small>
        </div>
      )}

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
        <div className="smart-result-top" style={{ alignItems: "center", gap: 12 }}>
          <div>
            <strong>Mercado + decisão</strong>
            <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 11, lineHeight: 1.5 }}>
              Pesquisa comparáveis atuais na web e calcula um veredito conservador. Só roda quando você clicar, para controlar o custo do AI Gateway.
            </div>
          </div>
          <button className="button secondary" type="button" onClick={researchMarket} disabled={marketBusy}>
            {marketBusy ? "Pesquisando mercado…" : "⌕ Pesquisar comparáveis e avaliar"}
          </button>
        </div>

        {marketError && <div className="smart-message error" style={{ marginTop: 10 }}>{marketError}</div>}
        {market && (
          <div className="smart-result" style={{ marginTop: 10 }}>
            <div className="smart-result-top">
              <strong>Radar: {market.verdict} · Score {market.radarScore.toFixed(1)}</strong>
              <span>{market.marketConfidence}% confiança</span>
            </div>
            <div className="confidence-list">
              <span>Compra máx. <b>{market.maxPurchase === null ? "—" : brl.format(market.maxPurchase)}</b></span>
              <span>Revenda rápida <b>{market.quickResale === null ? "—" : brl.format(market.quickResale)}</b></span>
              <span>Revenda provável <b>{market.likelyResale === null ? "—" : brl.format(market.likelyResale)}</b></span>
              <span>IAO <b>{market.iao}</b></span>
              <span>IAM <b>{market.iam}</b></span>
              <span>ICE <b>{market.ice}</b></span>
            </div>
            <p>{market.rationale}</p>
            {market.needsVerification && <p><b>Não comprar ainda:</b> a pesquisa não teve evidência suficiente para liberar uma compra automática.</p>}
            {market.riskFlags?.length > 0 && <small>Riscos: {market.riskFlags.join(" · ")}</small>}
            {market.comparables?.length > 0 && (
              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                {market.comparables.map((comp, index) => (
                  <a key={`${comp.url}-${index}`} href={comp.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--green-dark)", fontSize: 10, textDecoration: "none" }}>
                    ↗ {comp.kind === "sold" ? "Venda" : comp.kind === "asking" ? "Anúncio" : "Fonte"} · {comp.match} · {comp.priceBRL ? brl.format(comp.priceBRL) : "preço n/d"} · {comp.title || comp.url}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
