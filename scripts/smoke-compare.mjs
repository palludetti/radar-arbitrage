import assert from "node:assert/strict";

const baseUrl = (process.env.RADAR_SMOKE_BASE_URL || "https://radar-arbitrage.vercel.app").replace(/\/$/, "");
const repetitions = Math.max(1, Math.min(3, Number(process.env.RADAR_SMOKE_REPETITIONS) || 3));
const accessToken = process.env.RADAR_API_ACCESS_TOKEN || "";
const origin = new URL(baseUrl).origin;
const payload = {
  category: "Relógio",
  brand: "Seiko",
  model: "SQ Sports 100 8229-5019",
  askingPrice: 330,
  fees: 30,
  sourcePlatform: "Enjoei",
  seller: "smoke-test",
  notes: "Teste de contrato; referência exata obrigatória.",
  extractionConfidence: { brand: 100, model: 100, askingPrice: 100 },
};

for (let run = 1; run <= repetitions; run += 1) {
  const startedAt = performance.now();
  const headers = { "content-type": "application/json", origin };
  if (accessToken) headers["x-radar-access-token"] = accessToken;

  const response = await fetch(`${baseUrl}/api/compare`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(85_000),
  });
  const elapsedSeconds = (performance.now() - startedAt) / 1_000;
  const body = await response.json();

  assert.equal(response.status, 200, `run ${run}: HTTP ${response.status} — ${body.error || "sem mensagem"}`);
  assert.ok(elapsedSeconds < 80, `run ${run}: ${elapsedSeconds.toFixed(1)}s excede o contrato de 80s`);
  assert.ok(["COMPRAR", "NEGOCIAR", "PASSAR"].includes(body.verdict), `run ${run}: veredito ausente`);
  assert.ok(Array.isArray(body.comparables) && body.comparables.length > 0, `run ${run}: sem comparáveis`);
  assert.ok(body.sourcesSearched >= 1 && body.sourcesSearched <= 5, `run ${run}: sourcesSearched=${body.sourcesSearched}`);
  assert.ok(body.comparables.every((item) => /^https?:\/\//.test(item.url)), `run ${run}: URL inválida`);

  if (body.verdict === "COMPRAR") {
    const exact = body.comparables.filter((item) => item.match === "exact");
    const exactSold = exact.filter((item) => item.kind === "sold");
    assert.equal(body.needsVerification, false, `run ${run}: COMPRAR não pode exigir verificação`);
    assert.ok(body.marketConfidence >= 70, `run ${run}: COMPRAR com confiança ${body.marketConfidence}`);
    assert.ok(exact.length >= 2, `run ${run}: COMPRAR com apenas ${exact.length} comparável(is) exato(s)`);
    assert.ok(exactSold.length >= 1, `run ${run}: COMPRAR sem venda concluída exata`);
  }

  console.log(JSON.stringify({
    run,
    seconds: Number(elapsedSeconds.toFixed(2)),
    verdict: body.verdict,
    confidence: body.marketConfidence,
    sources: body.sourcesSearched,
    comparables: body.comparables.length,
  }));
}
