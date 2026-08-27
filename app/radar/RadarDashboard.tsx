"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import SmartImport from "../SmartImport";
import { radarFetch } from "../../lib/radar-fetch-client";

type Opportunity = {
  id: string;
  category: string;
  brand: string;
  model: string;
  sourcePlatform: string;
  seller: string;
  askingPrice: number | null;
  fees: number | null;
  shipping: number | null;
  purchaseFees: number | null;
  maintenanceReserve: number | null;
  partsReserve: number | null;
  safetyMargin: number | null;
  sellingCosts: number | null;
  totalCost: number | null;
  maxPurchase: number | null;
  quickResale: number | null;
  likelyResale: number | null;
  grossMargin: number | null;
  roiGross: number | null;
  liquidity: number | null;
  condition: number | null;
  originality: number | null;
  completeness: number | null;
  iao: number | null;
  iam: number | null;
  ice: number | null;
  radarScore: number | null;
  authGate: string;
  capitalGate: string;
  conditionGate: string;
  verdict: string;
  status: string;
  notes: string;
  url: string | null;
  validated: boolean;
  origin: string;
  createdAt: string;
  updatedAt: string;
};

type Seller = { id: string; name: string; platforms: string; location: string; specialty: string; positiveSignals: string; risks: string; ice: number; action: string };
type Rule = { id: number; rule: string; type: string; definition: string; reason: string };
type Weights = { iao: number; iam: number; ice: number };

const defaultWeights: Weights = { iao:50, iam:30, ice:20 };
const weightsStorageKey = "radar-arbitrage-weights-v1";
const money = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 });
const dateBR = new Intl.DateTimeFormat("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric" });

function n(v: unknown): number | null { if (v === null || v === undefined || v === "") return null; const x = Number(v); return Number.isFinite(x) ? x : null; }
function s(v: unknown, fallback=""): string { return typeof v === "string" ? v.trim() : fallback; }
function inferredCreatedAt(raw: Partial<Opportunity>, now: string) {
  const explicit = s(raw.createdAt);
  if (explicit) return explicit;
  const match = s(raw.origin).match(/(20\d{2})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T12:00:00-03:00` : now;
}
// Computes display-only derived fields (totalCost, grossMargin, roiGross,
// a radarScore fallback) from whatever "source" fields are present. These
// are intentionally never sent back to the server/database — see the
// comment on OpportunityRecord in lib/opportunities-db.ts.
function normalize(raw: Partial<Opportunity>, fallbackId: string): Opportunity {
  const askingPrice = n(raw.askingPrice); const detailedCosts = [raw.shipping,raw.purchaseFees,raw.maintenanceReserve,raw.partsReserve,raw.safetyMargin]; const hasDetailedCosts = detailedCosts.some(value=>n(value)!==null); const fees = hasDetailedCosts ? detailedCosts.reduce<number>((sum,value)=>sum+(n(value)??0),0) : (n(raw.fees)??0); const totalCost = askingPrice === null ? null : askingPrice + fees;
  const sellingCosts=n(raw.sellingCosts)??0; const likelyResale = n(raw.likelyResale); const grossMargin = likelyResale === null || totalCost === null ? null : likelyResale-sellingCosts-totalCost;
  const roiGross = n(raw.roiGross) ?? (grossMargin !== null && totalCost ? grossMargin / totalCost : null);
  const iao = n(raw.iao), iam = n(raw.iam), ice = n(raw.ice); const radarScore = n(raw.radarScore) ?? (iao === null || iam === null || ice === null ? null : .5*iao + .3*iam + .2*ice);
  const now = new Date().toISOString();
  return { id:s(raw.id,fallbackId), category:s(raw.category,"Outros"), brand:s(raw.brand), model:s(raw.model,"Novo anúncio"), sourcePlatform:s(raw.sourcePlatform), seller:s(raw.seller), askingPrice, fees, shipping:n(raw.shipping), purchaseFees:n(raw.purchaseFees), maintenanceReserve:n(raw.maintenanceReserve), partsReserve:n(raw.partsReserve), safetyMargin:n(raw.safetyMargin), sellingCosts, totalCost, maxPurchase:n(raw.maxPurchase), quickResale:n(raw.quickResale), likelyResale, grossMargin, roiGross, liquidity:n(raw.liquidity), condition:n(raw.condition), originality:n(raw.originality), completeness:n(raw.completeness), iao, iam, ice, radarScore, authGate:s(raw.authGate,"N/A"), capitalGate:s(raw.capitalGate,"N/A"), conditionGate:s(raw.conditionGate,"PENDENTE"), verdict:s(raw.verdict, radarScore===null?"EM ESTUDO":radarScore>=87?"FOGUINHO":radarScore>=80?"JOIA":radarScore>=65?"NEGOCIAR":"PASSAR"), status:s(raw.status,"Aprofundar"), notes:s(raw.notes), url:s(raw.url)||null, validated:raw.validated===true, origin:s(raw.origin,"manual"), createdAt:inferredCreatedAt(raw,now), updatedAt:s(raw.updatedAt,now) };
}

const numericFields = ["askingPrice","fees","shipping","purchaseFees","maintenanceReserve","partsReserve","safetyMargin","sellingCosts","maxPurchase","quickResale","likelyResale","liquidity","condition","originality","completeness","iao","iam","ice"] as const;

/** FormData -> a raw partial-opportunity object, converting the known numeric fields. */
function formToRaw(form: HTMLFormElement, skip: readonly string[] = []): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (skip.includes(key)) continue;
    raw[key] = (numericFields as readonly string[]).includes(key) ? n(value) : String(value).trim();
  }
  return raw;
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return typeof body?.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

type RadarDashboardProps = {
  opportunities: Partial<Opportunity>[];
  loadError: string;
  seedSellers: Seller[];
  seedRules: Rule[];
};

export default function RadarDashboard({ opportunities, loadError, seedSellers: sellers, seedRules: rules }: RadarDashboardProps) {
  const normalizeAll = (list: Partial<Opportunity>[]) => list.map((item) => normalize(item, String(item.id ?? "")));
  const [items, setItems] = useState<Opportunity[]>(() => normalizeAll(opportunities));
  useEffect(() => { setItems(normalizeAll(opportunities)); }, [opportunities]);

  const [weights,setWeights] = useState<Weights>(defaultWeights);
  const [search,setSearch] = useState(""); const [category,setCategory] = useState("Todas"); const [maxPrice,setMaxPrice] = useState(""); const [minScore,setMinScore] = useState("0"); const [sort,setSort] = useState("score"); const [view,setView] = useState("all"); const [dateFrom,setDateFrom] = useState(""); const [dateTo,setDateTo] = useState("");
  const [showImport,setShowImport] = useState(false); const [showNew,setShowNew] = useState(false); const [linkEditingId,setLinkEditingId] = useState<string|null>(null); const [evaluationId,setEvaluationId] = useState<string|null>(null);
  const [notice,setNotice] = useState<{ text: string; tone: "success" | "error" } | null>(loadError ? { text: loadError, tone: "error" } : null);
  const [savingNew,setSavingNew] = useState(false); const [savingEvaluation,setSavingEvaluation] = useState(false); const [importing,setImporting] = useState(false);
  const newFormRef = useRef<HTMLFormElement>(null);
  const evaluationFormRef = useRef<HTMLFormElement>(null);

  // Score-simulation weights are a per-browser display preference, not
  // business data — they stay in localStorage even after the migration off
  // it for opportunities.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(weightsStorageKey);
      if (raw) setWeights({ ...defaultWeights, ...JSON.parse(raw) });
    } catch { /* ignore malformed local state */ }
  }, []);

  const scored = useMemo(() => items.map(x => ({ ...x, score: x.iao===null||x.iam===null||x.ice===null ? x.radarScore : (x.iao*weights.iao+x.iam*weights.iam+x.ice*weights.ice)/Math.max(1,weights.iao+weights.iam+weights.ice) })), [items,weights]);
  const categories = useMemo(() => ["Todas", ...Array.from(new Set(items.map(x=>x.category)))], [items]);
  const filtered = useMemo(() => scored.filter(x => {
    const q=search.trim().toLowerCase(); const matches=!q||[x.brand,x.model,x.seller,x.sourcePlatform,x.id].some(v=>v.toLowerCase().includes(q));
    const active = view==="all" || view==="validated"&&x.validated || view==="active"&&!(["Histórico","Vendido","Laboratório","Corrigido"].includes(x.status));
    const createdTime = new Date(x.createdAt).getTime();
    const afterDate = !dateFrom || (!Number.isNaN(createdTime) && createdTime >= new Date(`${dateFrom}T00:00:00`).getTime());
    const beforeDate = !dateTo || (!Number.isNaN(createdTime) && createdTime <= new Date(`${dateTo}T23:59:59.999`).getTime());
    return matches && (category==="Todas"||x.category===category) && (!maxPrice || x.askingPrice!==null&&x.askingPrice<=Number(maxPrice)) && (x.score??0)>=Number(minScore) && afterDate && beforeDate && active;
  }).sort((a,b)=> sort==="margin"?(b.grossMargin??-Infinity)-(a.grossMargin??-Infinity):sort==="price"?(a.askingPrice??Infinity)-(b.askingPrice??Infinity):sort==="iao"?(b.iao??-Infinity)-(a.iao??-Infinity):(b.score??-Infinity)-(a.score??-Infinity)), [scored,search,category,maxPrice,minScore,sort,view,dateFrom,dateTo]);
  const metrics = useMemo(() => { const priced=items.filter(x=>x.askingPrice!==null); return { total:items.length, validated:items.filter(x=>x.validated).length, jewels:items.filter(x=>["FOGUINHO","JOIA"].includes(x.verdict)).length, average:priced.length?priced.reduce((a,x)=>a+(x.askingPrice??0),0)/priced.length:0 }; }, [items]);

  function exportJson(){ const blob=new Blob([JSON.stringify({opportunities:items,sellers,rules,weights},null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`radar-arbitrage-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
  function saveWeights(){ localStorage.setItem(weightsStorageKey, JSON.stringify(weights)); setNotice({ text: "Pesos salvos neste navegador.", tone: "success" }); }

  async function remove(id:string){
    if(!confirm(`Remover ${id}?`)) return;
    try {
      const response = await radarFetch(`/api/opportunities/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readApiError(response, "Falha ao remover."));
      setItems(current => current.filter(x=>x.id!==id));
      setNotice({ text: `${id} removido.`, tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Falha ao remover.", tone: "error" });
    }
  }

  async function saveLink(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!linkEditingId) return;
    const raw=String(new FormData(e.currentTarget).get("url")||"").trim();
    let url:string|null=null;
    if(raw){ try { const parsed=new URL(raw); if(!["http:","https:"].includes(parsed.protocol)) throw new Error("protocol"); url=parsed.href; } catch { setNotice({ text: "Link inválido. Use um endereço começando com http:// ou https://.", tone: "error" }); return; } }
    try {
      const response = await radarFetch(`/api/opportunities/${encodeURIComponent(linkEditingId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Falha ao salvar o link."));
      const { opportunity } = await response.json();
      setItems(current => current.map(x=>x.id===linkEditingId ? normalize(opportunity, x.id) : x));
      setNotice({ text: url?`Link de ${linkEditingId} salvo.`:`Link de ${linkEditingId} removido.`, tone: "success" });
      setLinkEditingId(null);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Falha ao salvar o link.", tone: "error" });
    }
  }

  async function importJson(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const data=new FormData(e.currentTarget);
    let list: unknown[];
    try {
      const text=String(data.get("json")||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
      const obj=JSON.parse(text);
      list = Array.isArray(obj)?obj:obj.opportunities?obj.opportunities:[obj];
      if (!Array.isArray(list) || list.length === 0) throw new Error("empty");
    } catch {
      setNotice({ text: "JSON inválido.", tone: "error" });
      return;
    }
    setImporting(true);
    try {
      const response = await radarFetch("/api/opportunities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opportunities: list }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Falha ao importar."));
      const { created, skippedIds } = await response.json() as { created: Partial<Opportunity>[]; skippedIds: string[] };
      setItems(current => [...normalizeAll(created), ...current]);
      setShowImport(false);
      setNotice({
        text: skippedIds.length
          ? `${created.length} registro(s) importado(s), ${skippedIds.length} já existiam (${skippedIds.join(", ")}) e foram ignorados.`
          : `${created.length} registro(s) importado(s).`,
        tone: "success",
      });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Falha ao importar.", tone: "error" });
    } finally {
      setImporting(false);
    }
  }

  async function createItem(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const raw = formToRaw(e.currentTarget, ["images"]);
    setSavingNew(true);
    try {
      const response = await radarFetch("/api/opportunities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opportunities: [raw] }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Falha ao salvar."));
      const { created } = await response.json() as { created: Partial<Opportunity>[] };
      const item = created[0] ? normalize(created[0], created[0].id ?? "") : null;
      if (!item) throw new Error("O servidor não retornou a oportunidade criada.");
      setItems(current => [item, ...current]);
      setShowNew(false);
      setNotice({ text: `${item.id} salvo.`, tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Falha ao salvar.", tone: "error" });
    } finally {
      setSavingNew(false);
    }
  }

  async function updateEvaluation(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!evaluationId) return;
    const current=items.find(x=>x.id===evaluationId);
    if(!current) return;
    const patch = formToRaw(e.currentTarget, ["images"]);
    setSavingEvaluation(true);
    try {
      const response = await radarFetch(`/api/opportunities/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Falha ao salvar reavaliação."));
      const { opportunity } = await response.json();
      const updated = normalize(opportunity, current.id);
      setItems(list => list.map(x=>x.id===current.id?updated:x));
      setEvaluationId(null);
      setNotice({ text: `${current.id} reavaliado e salvo.`, tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Falha ao salvar reavaliação.", tone: "error" });
    } finally {
      setSavingEvaluation(false);
    }
  }

  return <main>
    <header className="topbar"><div className="brand"><div className="brand-mark">RA</div><div><strong>Radar Arbitrage</strong><span>Base operacional privada</span></div></div><div className="top-actions"><form action="/api/session/logout" method="post"><button className="button ghost" type="submit">Sair</button></form><button className="button ghost" onClick={exportJson}>↓ Exportar</button><button className="button secondary" onClick={()=>setShowImport(true)}>↳ Colar do chat</button><button className="button primary" onClick={()=>setShowNew(true)}>＋ Novo anúncio</button></div></header>
    <div className="workspace">
      <section className="hero"><div><p className="eyebrow">BANCO + VERCEL</p><h1>Onde há margem de verdade?</h1><p className="hero-copy">Toda oportunidade fica salva no banco — sobrevive a troca de navegador ou dispositivo. "Exportar" continua disponível como backup manual.</p></div><div className="sync-state"><i/>Base: {items.length} registros</div></section>
      {notice && <div className={`notice ${notice.tone === "error" ? "error" : "success"}`}><span>{notice.text}</span><button onClick={()=>setNotice(null)}>×</button></div>}
      <section className="metrics"><Metric label="Oportunidades registradas" value={String(metrics.total)} note="Banco de dados"/><Metric label="Base validada" value={String(metrics.validated)} note="Registros confirmados" accent/><Metric label="Foguinho / Joia" value={String(metrics.jewels)} note="Potencial prioritário"/><Metric label="Ticket médio observado" value={money.format(metrics.average)} note="Preço pedido disponível"/></section>
      <section className="dashboard-grid">
        <aside className="control-panel"><p className="section-kicker">RADAR SCORE V1</p><h2>Pesos do modelo</h2><p className="panel-copy">A pontuação pode ser simulada sem alterar IAO, IAM e ICE gravados.</p>{(["iao","iam","ice"] as const).map((k)=><label className="weight-row" key={k}><span>{k.toUpperCase()}<strong>{weights[k]}%</strong></span><input type="range" min="0" max="100" value={weights[k]} onChange={e=>setWeights(w=>({...w,[k]:Number(e.target.value)}))}/></label>)}<div className="weight-footer"><span>Total: {weights.iao+weights.iam+weights.ice}%</span><button onClick={()=>setWeights(defaultWeights)}>Restaurar 50/30/20</button></div><button className="button save-button" onClick={saveWeights}>Salvar pesos</button><div className="formula-card"><strong>Metodologia preservada</strong><p>Radar Score = 50% IAO + 30% IAM + 20% ICE. Autenticidade e capital seguem como gates separados.</p></div><div className="rules-card"><strong>Regras carregadas</strong><span>{rules.length} diretrizes operacionais</span></div></aside>
        <section className="opportunities"><div className="opportunities-heading"><div><p className="section-kicker">RADAR OPERACIONAL</p><h2>{view==="sellers"?"Vendedores":"Oportunidades"}</h2></div><span className="result-count">{view==="sellers"?sellers.length:filtered.length} resultados</span></div>
          <nav className="view-tabs"><button className={view==="all"?"active":""} onClick={()=>setView("all")}>Todas</button><button className={view==="active"?"active":""} onClick={()=>setView("active")}>Em análise</button><button className={view==="validated"?"active":""} onClick={()=>setView("validated")}>Base validada</button><button className={view==="sellers"?"active":""} onClick={()=>setView("sellers")}>Vendedores</button></nav>
          {view!=="sellers" ? <><div className="filters"><Field label="Buscar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Marca, modelo, vendedor ou ID"/></Field><Field label="Categoria"><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Preço máximo"><input type="number" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Sem limite"/></Field><Field label="Score mínimo"><select value={minScore} onChange={e=>setMinScore(e.target.value)}><option value="0">Todos</option><option value="65">65+</option><option value="80">80+</option><option value="87">87+</option></select></Field><Field label="Inclusão de"><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></Field><Field label="Até"><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></Field><Field label="Ordenar"><select value={sort} onChange={e=>setSort(e.target.value)}><option value="score">Maior score</option><option value="margin">Maior margem</option><option value="iao">Maior IAO</option><option value="price">Menor preço</option></select></Field></div><div className="table-wrap"><table className="radar-table"><thead><tr><th>Oportunidade</th><th>Inclusão</th><th>Custo</th><th>Compra máx.</th><th>Revenda prov.</th><th>ROI</th><th>IAO · IAM · ICE</th><th>Score</th><th>Veredito</th><th>Ações</th></tr></thead><tbody>{filtered.map(x=><tr key={x.id}><td data-label="Oportunidade"><div className="listing-title"><strong>{x.brand} {x.model}</strong><span>{x.id} · {x.category} · {x.sourcePlatform}{x.seller?` · ${x.seller}`:""}</span></div></td><td data-label="Inclusão" title={x.createdAt}><strong>{fmtDate(x.createdAt)}</strong></td><td data-label="Custo"><strong>{fmt(x.totalCost??x.askingPrice)}</strong></td><td data-label="Compra máx.">{fmt(x.maxPurchase)}</td><td data-label="Revenda prov.">{fmt(x.likelyResale)}</td><td data-label="ROI"><div className={(x.roiGross??0)>=.25?"profit positive":"profit neutral"}><strong>{x.roiGross===null?"—":`${Math.round(100*x.roiGross)}%`}</strong><span>{fmt(x.grossMargin)}</span></div></td><td data-label="IAO · IAM · ICE"><div className="score-trio"><span>{x.iao??"—"}</span><span>{x.iam??"—"}</span><span>{x.ice??"—"}</span></div></td><td data-label="Radar Score"><div className="score-badge"><strong>{x.score===null?"—":x.score.toFixed(1)}</strong><span>{x.validated?"VALIDADA":x.status}</span></div></td><td data-label="Veredito"><span className={`verdict ${slug(x.verdict)}`}>{x.verdict}</span></td><td data-label="Ações"><div className="row-actions">{x.url&&<a href={x.url} target="_blank" rel="noopener noreferrer" title="Abrir anúncio" aria-label={`Abrir anúncio de ${x.brand} ${x.model}`}>↗</a>}<button onClick={()=>setEvaluationId(x.id)} title="Avaliar oportunidade" aria-label={`Avaliar ${x.id} · ${x.brand} ${x.model}`}>⌕</button><button onClick={()=>setLinkEditingId(x.id)} title={x.url?"Editar link":"Adicionar link"} aria-label={`${x.url?"Editar":"Adicionar"} link de ${x.brand} ${x.model}`}>🔗</button><button onClick={()=>remove(x.id)} title="Remover" aria-label={`Remover ${x.brand} ${x.model}`}>×</button></div></td></tr>)}</tbody></table>{filtered.length===0&&<div className="empty-state"><strong>Nenhum registro nesse recorte.</strong><span>Ajuste os filtros ou adicione uma nova análise.</span></div>}</div></> : <div className="seller-grid">{sellers.map(x=><article key={x.id}><div className="seller-score"><span>ICE</span><strong>{x.ice}</strong></div><p className="section-kicker">{x.id} · {x.platforms}</p><h3>{x.name}</h3><p>{x.specialty} · {x.location}</p><dl><div><dt>Sinais positivos</dt><dd>{x.positiveSignals}</dd></div><div><dt>Riscos</dt><dd>{x.risks}</dd></div></dl><span className="seller-action">{x.action}</span></article>)}</div>}
        </section>
      </section><p className="data-note">Os dados de oportunidades ficam no banco (Supabase); o navegador guarda só a simulação de pesos do score.</p>
    </div>
    {showImport && <Modal title="Colar análise do chat" onClose={()=>setShowImport(false)}><p className="import-copy">Cole um registro JSON ou um lote com <code>opportunities</code>.</p><form onSubmit={importJson}><Field label="JSON da análise"><textarea name="json" rows={13} required autoFocus placeholder='{"brand":"Seiko","model":"8229-5019","askingPrice":330,"url":"https://..."}'/></Field><ModalActions onClose={()=>setShowImport(false)} submit={importing?"Importando…":"Importar para o Radar"} disabled={importing}/></form></Modal>}
    {linkEditingId && (()=>{ const current=items.find(x=>x.id===linkEditingId); return current ? <Modal title={`${current.url?"Editar":"Adicionar"} link · ${current.id}`} onClose={()=>setLinkEditingId(null)}><p className="import-copy">Cole o endereço completo do anúncio. Deixe o campo vazio para remover um link existente.</p><form onSubmit={saveLink}><Field label="Link do anúncio"><input name="url" type="url" defaultValue={current.url??""} autoFocus placeholder="https://..."/></Field><ModalActions onClose={()=>setLinkEditingId(null)} submit="Salvar link"/></form></Modal> : null; })()}
    {evaluationId && (()=>{ const current=items.find(x=>x.id===evaluationId); return current ? <Modal title={`Avaliar ${current.id}`} onClose={()=>setEvaluationId(null)} large><form ref={evaluationFormRef} onSubmit={updateEvaluation}><SmartImport formRef={evaluationFormRef} initialUrl={current.url}/><OpportunityFields item={current}/><ModalActions onClose={()=>setEvaluationId(null)} submit={savingEvaluation?"Salvando…":"Salvar reavaliação"} disabled={savingEvaluation}/></form></Modal> : null; })()}
    {showNew && <Modal title="Nova oportunidade" onClose={()=>setShowNew(false)} large><form ref={newFormRef} onSubmit={createItem}><SmartImport formRef={newFormRef}/><div className="form-grid"><Text name="brand" label="Marca *" required/><Text name="model" label="Modelo / Referência *" required/><Text name="category" label="Categoria" defaultValue="Relógio"/><Text name="sourcePlatform" label="Fonte / Plataforma"/><Text name="seller" label="Vendedor"/><Num name="askingPrice" label="Preço pedido"/><Num name="shipping" label="Frete" defaultValue="0"/><Num name="purchaseFees" label="Taxas de compra" defaultValue="0"/><Num name="maintenanceReserve" label="Manutenção provável" defaultValue="0"/><Num name="partsReserve" label="Peças / bateria" defaultValue="0"/><Num name="safetyMargin" label="Margem de segurança" defaultValue="0"/><Num name="sellingCosts" label="Custos da venda" defaultValue="0"/><Gate name="authGate" label="Gate de autenticidade" defaultValue="N/A" options={["N/A","PENDENTE","OK","BLOQUEADO"]}/><Gate name="capitalGate" label="Gate de capital" defaultValue="OK" options={["OK","NÃO","N/A"]}/><Gate name="conditionGate" label="Gate de condição" defaultValue="PENDENTE" options={["PENDENTE","OK","BLOQUEADO"]}/><Num name="maxPurchase" label="Compra máxima"/><Num name="quickResale" label="Revenda rápida"/><Num name="likelyResale" label="Revenda provável"/><Num name="iao" label="IAO (0–100)"/><Num name="iam" label="IAM (0–100)"/><Num name="ice" label="ICE (0–100)"/><Text name="verdict" label="Veredito" defaultValue="EM ESTUDO"/><Text name="status" label="Status" defaultValue="Aprofundar"/><label className="field wide"><span>Observações</span><textarea name="notes" rows={4}/></label></div><ModalActions onClose={()=>setShowNew(false)} submit={savingNew?"Salvando…":"Salvar no Radar"} disabled={savingNew}/></form></Modal>}
  </main>;
}

function Metric({label,value,note,accent=false}:{label:string;value:string;note:string;accent?:boolean}){return <article className={`metric-card ${accent?"accent":""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
function Text(props:{name:string;label:string;required?:boolean;defaultValue?:string;type?:string}){return <Field label={props.label}><input name={props.name} required={props.required} defaultValue={props.defaultValue} type={props.type||"text"}/></Field>}
function Num(props:{name:string;label:string;defaultValue?:string}){return <Field label={props.label}><input name={props.name} type="number" step="0.01" min="0" defaultValue={props.defaultValue}/></Field>}
function Gate(props:{name:string;label:string;defaultValue:string;options:string[]}){return <Field label={props.label}><select name={props.name} defaultValue={props.defaultValue}>{props.options.map(option=><option key={option} value={option}>{option}</option>)}</select></Field>}
function OpportunityFields({item}:{item:Opportunity}){ const text=(value:string|null|undefined)=>value??""; const num=(value:number|null)=>value===null?"":String(value); return <div className="form-grid"><Text name="brand" label="Marca *" required defaultValue={item.brand}/><Text name="model" label="Modelo / Referência *" required defaultValue={item.model}/><Text name="category" label="Categoria" defaultValue={item.category}/><Text name="sourcePlatform" label="Fonte / Plataforma" defaultValue={item.sourcePlatform}/><Text name="seller" label="Vendedor" defaultValue={item.seller}/><Num name="askingPrice" label="Preço pedido" defaultValue={num(item.askingPrice)}/><Num name="shipping" label="Frete" defaultValue={num(item.shipping)}/><Num name="purchaseFees" label="Taxas de compra" defaultValue={num(item.purchaseFees)}/><Num name="maintenanceReserve" label="Manutenção provável" defaultValue={num(item.maintenanceReserve)}/><Num name="partsReserve" label="Peças / bateria" defaultValue={num(item.partsReserve)}/><Num name="safetyMargin" label="Margem de segurança" defaultValue={num(item.safetyMargin)}/><Num name="sellingCosts" label="Custos da venda" defaultValue={num(item.sellingCosts)}/><Gate name="authGate" label="Gate de autenticidade" defaultValue={item.authGate} options={["N/A","PENDENTE","OK","BLOQUEADO"]}/><Gate name="capitalGate" label="Gate de capital" defaultValue={item.capitalGate} options={["OK","NÃO","N/A"]}/><Gate name="conditionGate" label="Gate de condição" defaultValue={item.conditionGate} options={["PENDENTE","OK","BLOQUEADO"]}/><Num name="maxPurchase" label="Compra máxima" defaultValue={num(item.maxPurchase)}/><Num name="quickResale" label="Revenda rápida" defaultValue={num(item.quickResale)}/><Num name="likelyResale" label="Revenda provável" defaultValue={num(item.likelyResale)}/><Num name="iao" label="IAO (0–100)" defaultValue={num(item.iao)}/><Num name="iam" label="IAM (0–100)" defaultValue={num(item.iam)}/><Num name="ice" label="ICE (0–100)" defaultValue={num(item.ice)}/><Text name="verdict" label="Veredito" defaultValue={item.verdict}/><Text name="status" label="Status" defaultValue={item.status}/><label className="field wide"><span>Observações</span><textarea name="notes" rows={7} defaultValue={text(item.notes)}/></label></div> }
function Modal({title,onClose,children,large=false}:{title:string;onClose:()=>void;children:React.ReactNode;large?:boolean}){return <div className="modal-backdrop" onMouseDown={onClose}><section className={`modal ${large?"large":""}`} onMouseDown={e=>e.stopPropagation()}><div className="modal-heading"><div><p className="section-kicker">RADAR ARBITRAGE</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>{children}</section></div>}
function ModalActions({onClose,submit,disabled=false}:{onClose:()=>void;submit:string;disabled?:boolean}){return <div className="modal-actions"><button type="button" className="button cancel" onClick={onClose} disabled={disabled}>Cancelar</button><button type="submit" className="button primary" disabled={disabled}>{submit}</button></div>}
function fmt(v:number|null){return v===null?"—":money.format(v)}
function fmtDate(v:string){const d=new Date(v);return Number.isNaN(d.getTime())?"—":dateBR.format(d)}
function slug(v:string){return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-")}
