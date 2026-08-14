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

export default function SmartImport({ formRef }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");

  function setField(name: string, value: string | number | null | undefined) {
    if (value === null || value === undefined || value === "") return;
    const field = formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
    if (field) field.value = String(value);
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

  const confidenceEntries = result
    ? Object.entries(result.confidence || {}).filter(([key, value]) => labels[key] && value > 0)
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
              {confidenceEntries.map(([key, value]) => (
                <span key={key}>{labels[key]} <b>{Math.round(value)}%</b></span>
              ))}
            </div>
          )}
          {result.warnings?.length > 0 && <p>{result.warnings.join(" · ")}</p>}
          <small>Os campos abaixo foram preenchidos quando havia evidência suficiente. Referência incerta fica em branco em vez de ser inventada.</small>
        </div>
      )}
    </section>
  );
}
