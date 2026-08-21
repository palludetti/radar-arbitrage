"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import SmartImport from "../SmartImport";

type Opportunity = {
  id: string;
  category: string;
  brand: string;
  model: string;
  sourcePlatform: string;
  seller: string;
  askingPrice: number | null;
  fees: number | null;
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
type LinkOverrides = Record<string, string | null>;

const defaultWeights: Weights = { iao:50, iam:30, ice:20 };
const storageKey = "radar-arbitrage-vercel-v2";
const linkStorageKey = "radar-arbitrage-link-overrides-v1";
const removedStorageKey = "radar-arbitrage-removed-seed-ids-v1";
const money = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 });
const dateBR = new Intl.DateTimeFormat("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric" });

function n(v: unknown): number | null { if (v === null || v === undefined || v === "") return null; const x = Number(v); return Number.isFinite(x) ? x : null; }
function s(v: unknown, fallback=""): string { return typeof v === "string" ? v.trim() : fallback; }
function readLinkOverrides(): LinkOverrides { try { const raw=localStorage.getItem(linkStorageKey); return raw ? JSON.parse(raw) as LinkOverrides : {}; } catch { return {}; } }
function readRemovedIds() { try { const raw=localStorage.getItem(removedStorageKey); return new Set<string>(raw ? JSON.parse(raw) : []); } catch { return new Set<string>(); } }
function writeRemovedIds(ids: Set<string>) { localStorage.setItem(removedStorageKey, JSON.stringify(Array.from(ids))); }
function inferredCreatedAt(raw: Partial<Opportunity>, now: string) {
  const explicit = s(raw.createdAt);
  if (explicit) return explicit;
  const match = s(raw.origin).match(/(20\d{2})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T12:00:00-03:00` : now;
}
function normalize(raw: Partial<Opportunity>, fallbackId: string): Opportunity {
  const askingPrice = n(raw.askingPrice); const fees = n(raw.fees) ?? 0; const totalCost = n(raw.totalCost) ?? (askingPrice === null ? null : askingPrice + fees);
  const likelyResale = n(raw.likelyResale); const grossMargin = n(raw.grossMargin) ?? (likelyResale === null || totalCost === null ? null : likelyResale - totalCost);
  const roiGross = n(raw.roiGross) ?? (grossMargin !== null && totalCost ? grossMargin / totalCost : null);
  const iao = n(raw.iao), iam = n(raw.iam), ice = n(raw.ice); const radarScore = n(raw.radarScore) ?? (iao === null || iam === null || ice === null ? null : .5*iao + .3*iam + .2*ice);
  const now = new Date().toISOString();
  return { id:s(raw.id,fallbackId), category:s(raw.category,"Outros"), brand:s(raw.brand), model:s(raw.model,"Novo anúncio"), sourcePlatform:s(raw.sourcePlatform), seller:s(raw.seller), askingPrice, fees, totalCost, maxPurchase:n(raw.maxPurchase), quickResale:n(raw.quickResale), likelyResale, grossMargin, roiGross, liquidity:n(raw.liquidity), condition:n(raw.condition), originality:n(raw.originality), completeness:n(raw.completeness), iao, iam, ice, radarScore, authGate:s(raw.authGate,"N/A"), capitalGate:s(raw.capitalGate,"N/A"), verdict:s(raw.verdict, radarScore===null?"EM ESTUDO":radarScore>=87?"FOGUINHO":radarScore>=80?"JOIA":radarScore>=65?"NEGOCIAR":"PASSAR"), status:s(raw.status,"Aprofundar"), notes:s(raw.notes), url:s(raw.url)||null, validated:raw.validated===true, origin:s(raw.origin,"manual"), createdAt:inferredCreatedAt(raw,now), updatedAt:s(raw.updatedAt,now) };
}

function nextOpportunityNumber(local: Opportunity[], repoSeedIds: Set<string>) {
  const ids = [...repoSeedIds, ...local.map((item) => item.id), ...readRemovedIds()];
  return ids.reduce((max, id) => {
    const match = /^RA-(\d+)$/.exec(id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
}

function mergeRepoSeed(local: Opportunity[], repoSeed: Opportunity[]) {
  const byId = new Map(local.map(x => [x.id, x]));
  for (const repo of repoSeed) {
    const current = byId.get(repo.id);
    if (!current || current.origin === "master_v1" || current.origin.startsWith("chat_") || current.origin.startsWith("auction_")) byId.set(repo.id, repo);
  }
  return Array.from(byId.values());
}

type RadarDashboardProps = {
  seedOpportunities: Partial<Opportunity>[];
  seedSellers: Seller[];
  seedRules: Rule[];
};

export default function RadarDashboard({ seedOpportunities, seedSellers: sellers, seedRules: rules }: RadarDashboardProps) {
  const repoSeed = useMemo(
    () => seedOpportunities.map((item, index) => normalize(item, `RA-${String(index + 1).padStart(3, "0")}`)),
    [seedOpportunities],
  );
  const repoSeedIds = useMemo(() => new Set(repoSeed.map((item) => item.id)), [repoSeed]);
  const [items,setItems] = useState<Opportunity[]>([]); const [weights,setWeights] = useState<Weights>(defaultWeights); const [loading,setLoading] = useState(true);
  const [search,setSearch] = useState(""); const [category,setCategory] = useState("Todas"); const [maxPrice,setMaxPrice] = useState(""); const [minScore,setMinScore] = useState("0"); const [sort,setSort] = useState("score"); const [view,setView] = useState("all");
  const [showImport,setShowImport] = useState(false); const [showNew,setShowNew] = useState(false); const [notice,setNotice] = useState("");
  const newFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const legacy = localStorage.getItem("radar-arbitrage-vercel-v1");
      const parsed = saved ? JSON.parse(saved) : legacy ? JSON.parse(legacy) : null;
      const overrides = readLinkOverrides();
      const removedIds = readRemovedIds();
      const merged = mergeRepoSeed(parsed?.opportunities ?? [], repoSeed)
        .filter((item) => !removedIds.has(item.id))
        .map(item => Object.prototype.hasOwnProperty.call(overrides,item.id) ? { ...item, url:typeof overrides[item.id] === "string" || overrides[item.id] === null ? overrides[item.id] : item.url } : item);
      setItems(merged); setWeights(parsed?.weights ?? defaultWeights);
      localStorage.setItem(storageKey, JSON.stringify({ opportunities:merged, sellers, rules, weights:parsed?.weights ?? defaultWeights }));
    } finally { setLoading(false); }
  }, [repoSeed]);

  function persist(next: Opportunity[], nextWeights=weights) { setItems(next); localStorage.setItem(storageKey, JSON.stringify({ opportunities:next, sellers, rules, weights:nextWeights })); }
  const scored = useMemo(() => items.map(x => ({ ...x, score: x.iao===null||x.iam===null||x.ice===null ? x.radarScore : (x.iao*weights.iao+x.iam*weights.iam+x.ice*weights.ice)/Math.max(1,weights.iao+weights.iam+weights.ice) })), [items,weights]);
  const categories = useMemo(() => ["Todas", ...Array.from(new Set(items.map(x=>x.category)))], [items]);
  const filtered = useMemo(() => scored.filter(x => {
    const q=search.trim().toLowerCase(); const matches=!q||[x.brand,x.model,x.seller,x.sourcePlatform,x.id].some(v=>v.toLowerCase().includes(q));
    const active = view==="all" || view==="validated"&&x.validated || view==="active"&&!(["Histórico","Vendido","Laboratório","Corrigido"].includes(x.status));
    return matches && (category==="Todas"||x.category===category) && (!maxPrice || x.askingPrice!==null&&x.askingPrice<=Number(maxPrice)) && (x.score??0)>=Number(minScore) && active;
  }).sort((a,b)=> sort==="margin"?(b.grossMargin??-Infinity)-(a.grossMargin??-Infinity):sort==="price"?(a.askingPrice??Infinity)-(b.askingPrice??Infinity):sort==="iao"?(b.iao??-Infinity)-(a.iao??-Infinity):(b.score??-Infinity)-(a.score??-Infinity)), [scored,search,category,maxPrice,minScore,sort,view]);
  const metrics = useMemo(() => { const priced=items.filter(x=>x.askingPrice!==null); return { total:items.length, validated:items.filter(x=>x.validated).length, jewels:items.filter(x=>["FOGUINHO","JOIA"].includes(x.verdict)).length, average:priced.length?priced.reduce((a,x)=>a+(x.askingPrice??0),0)/priced.length:0 }; }, [items]);

  function exportJson(){ const blob=new Blob([JSON.stringify({opportunities:items,sellers,rules,weights},null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`radar-arbitrage-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
  function saveWeights(){ localStorage.setItem(storageKey,JSON.stringify({opportunities:items,sellers,rules,weights})); setNotice("Pesos salvos neste navegador."); }
  function remove(id:string){ if(confirm(`Remover ${id}?`)){ if(repoSeedIds.has(id)){ const removed=readRemovedIds(); removed.add(id); writeRemovedIds(removed); } persist(items.filter(x=>x.id!==id)); setNotice(`${id} removido deste navegador.`); } }
  function editLink(id:string){ const current=items.find(x=>x.id===id); if(!current) return; const answer=prompt(`Link de ${current.brand} ${current.model}`,current.url??""); if(answer===null) return; const raw=answer.trim(); let url:string|null=null; if(raw){ try { const parsed=new URL(raw); if(!["http:","https:"].includes(parsed.protocol)) throw new Error("protocol"); url=parsed.href; } catch { setNotice("Link inválido. Use um endereço começando com http:// ou https://."); return; } } const overrides=readLinkOverrides(); overrides[id]=url; localStorage.setItem(linkStorageKey,JSON.stringify(overrides)); persist(items.map(x=>x.id===id?{...x,url,updatedAt:new Date().toISOString()}:x)); setNotice(url?`Link de ${id} salvo.`:`Link de ${id} removido.`); }
  function importJson(e:FormEvent<HTMLFormElement>){ e.preventDefault(); const data=new FormData(e.currentTarget); try { const text=String(data.get("json")||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""); const obj=JSON.parse(text); const list=Array.isArray(obj)?obj:obj.opportunities?obj.opportunities:[obj]; const existing=new Set(items.map(x=>x.id)); const firstId=nextOpportunityNumber(items, repoSeedIds); const added=(list as Partial<Opportunity>[]).map((x,i)=>normalize(x,`RA-${String(firstId+i).padStart(3,"0")}`)).filter(x=>!existing.has(x.id)); persist([...added,...items]); setShowImport(false); setNotice(`${added.length} registro(s) importado(s).`); } catch { setNotice("JSON inválido."); } }
  function createItem(e:FormEvent<HTMLFormElement>){ e.preventDefault(); const fd=new FormData(e.currentTarget); const raw:Record<string,unknown>={}; for(const [k,v] of fd.entries()) raw[k]=["askingPrice","fees","maxPurchase","quickResale","likelyResale","liquidity","condition","originality","completeness","iao","iam","ice"].includes(k)?n(v):String(v).trim(); const item=normalize(raw as Partial<Opportunity>,`RA-${String(nextOpportunityNumber(items, repoSeedIds)).padStart(3,"0")}`); persist([item,...items]); setShowNew(false); setNotice(`${item.id} salvo.`); }

  return <main>
    <header className="topbar"><div className="brand"><div className="brand-mark">RA</div><div><strong>Radar Arbitrage</strong><span>Base operacional privada</span></div></div><div className="top-actions"><form action="/api/session/logout" method="post"><button className="button ghost" type="submit">Sair</button></form><button className="button ghost" onClick={exportJson}>↓ Exportar</button><button className="button secondary" onClick={()=>setShowImport(true)}>↳ Colar do chat</button><button className="button primary" onClick={()=>setShowNew(true)}>＋ Novo anúncio</button></div></header>
    <div className="workspace">
      <section className="hero"><div><p className="eyebrow">GITHUB + VERCEL</p><h1>Onde há margem de verdade?</h1><p className="hero-copy">A base versionada no GitHub é incorporada em cada deploy. Registros locais continuam preservados neste navegador.</p></div><div className="sync-state"><i/>Base central: {repoSeed.length} registros</div></section>
      {notice && <div className="notice success"><span>{notice}</span><button onClick={()=>setNotice("")}>×</button></div>}
      <section className="metrics"><Metric label="Oportunidades registradas" value={loading?"—":String(metrics.total)} note="Base GitHub + dados locais"/><Metric label="Base validada" value={loading?"—":String(metrics.validated)} note="Registros confirmados" accent/><Metric label="Foguinho / Joia" value={loading?"—":String(metrics.jewels)} note="Potencial prioritário"/><Metric label="Ticket médio observado" value={loading?"—":money.format(metrics.average)} note="Preço pedido disponível"/></section>
      <section className="dashboard-grid">
        <aside className="control-panel"><p className="section-kicker">RADAR SCORE V1</p><h2>Pesos do modelo</h2><p className="panel-copy">A pontuação pode ser simulada sem alterar IAO, IAM e ICE gravados.</p>{(["iao","iam","ice"] as const).map((k)=><label className="weight-row" key={k}><span>{k.toUpperCase()}<strong>{weights[k]}%</strong></span><input type="range" min="0" max="100" value={weights[k]} onChange={e=>setWeights(w=>({...w,[k]:Number(e.target.value)}))}/></label>)}<div className="weight-footer"><span>Total: {weights.iao+weights.iam+weights.ice}%</span><button onClick={()=>setWeights(defaultWeights)}>Restaurar 50/30/20</button></div><button className="button save-button" onClick={saveWeights}>Salvar pesos</button><div className="formula-card"><strong>Metodologia preservada</strong><p>Radar Score = 50% IAO + 30% IAM + 20% ICE. Autenticidade e capital seguem como gates separados.</p></div><div className="rules-card"><strong>Regras carregadas</strong><span>{rules.length} diretrizes operacionais</span></div></aside>
        <section className="opportunities"><div className="opportunities-heading"><div><p className="section-kicker">RADAR OPERACIONAL</p><h2>{view==="sellers"?"Vendedores":"Oportunidades"}</h2></div><span className="result-count">{view==="sellers"?sellers.length:filtered.length} resultados</span></div>
          <nav className="view-tabs"><button className={view==="all"?"active":""} onClick={()=>setView("all")}>Todas</button><button className={view==="active"?"active":""} onClick={()=>setView("active")}>Em análise</button><button className={view==="validated"?"active":""} onClick={()=>setView("validated")}>Base validada</button><button className={view==="sellers"?"active":""} onClick={()=>setView("sellers")}>Vendedores</button></nav>
          {view!=="sellers" ? <><div className="filters"><Field label="Buscar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Marca, modelo, vendedor ou ID"/></Field><Field label="Categoria"><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Preço máximo"><input type="number" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Sem limite"/></Field><Field label="Score mínimo"><select value={minScore} onChange={e=>setMinScore(e.target.value)}><option value="0">Todos</option><option value="65">65+</option><option value="80">80+</option><option value="87">87+</option></select></Field><Field label="Ordenar"><select value={sort} onChange={e=>setSort(e.target.value)}><option value="score">Maior score</option><option value="margin">Maior margem</option><option value="iao">Maior IAO</option><option value="price">Menor preço</option></select></Field></div><div className="table-wrap"><table className="radar-table"><thead><tr><th>Oportunidade</th><th>Inclusão</th><th>Custo</th><th>Compra máx.</th><th>Revenda prov.</th><th>ROI</th><th>IAO · IAM · ICE</th><th>Score</th><th>Veredito</th><th>Ações</th></tr></thead><tbody>{filtered.map(x=><tr key={x.id}><td data-label="Oportunidade"><div className="listing-title"><strong>{x.brand} {x.model}</strong><span>{x.id} · {x.category} · {x.sourcePlatform}{x.seller?` · ${x.seller}`:""}</span></div></td><td data-label="Inclusão" title={x.createdAt}><strong>{fmtDate(x.createdAt)}</strong></td><td data-label="Custo"><strong>{fmt(x.totalCost??x.askingPrice)}</strong></td><td data-label="Compra máx.">{fmt(x.maxPurchase)}</td><td data-label="Revenda prov.">{fmt(x.likelyResale)}</td><td data-label="ROI"><div className={(x.roiGross??0)>=.25?"profit positive":"profit neutral"}><strong>{x.roiGross===null?"—":`${Math.round(100*x.roiGross)}%`}</strong><span>{fmt(x.grossMargin)}</span></div></td><td data-label="IAO · IAM · ICE"><div className="score-trio"><span>{x.iao??"—"}</span><span>{x.iam??"—"}</span><span>{x.ice??"—"}</span></div></td><td data-label="Radar Score"><div className="score-badge"><strong>{x.score===null?"—":x.score.toFixed(1)}</strong><span>{x.validated?"VALIDADA":x.status}</span></div></td><td data-label="Veredito"><span className={`verdict ${slug(x.verdict)}`}>{x.verdict}</span></td><td data-label="Ações"><div className="row-actions">{x.url&&<a href={x.url} target="_blank" rel="noopener noreferrer" title="Abrir anúncio" aria-label={`Abrir anúncio de ${x.brand} ${x.model}`}>↗</a>}<button onClick={()=>editLink(x.id)} title={x.url?"Editar link":"Adicionar link"} aria-label={`${x.url?"Editar":"Adicionar"} link de ${x.brand} ${x.model}`}>🔗</button><button onClick={()=>remove(x.id)} title="Remover" aria-label={`Remover ${x.brand} ${x.model}`}>×</button></div></td></tr>)}</tbody></table>{!loading&&filtered.length===0&&<div className="empty-state"><strong>Nenhum registro nesse recorte.</strong><span>Ajuste os filtros ou adicione uma nova análise.</span></div>}</div></> : <div className="seller-grid">{sellers.map(x=><article key={x.id}><div className="seller-score"><span>ICE</span><strong>{x.ice}</strong></div><p className="section-kicker">{x.id} · {x.platforms}</p><h3>{x.name}</h3><p>{x.specialty} · {x.location}</p><dl><div><dt>Sinais positivos</dt><dd>{x.positiveSignals}</dd></div><div><dt>Riscos</dt><dd>{x.risks}</dd></div></dl><span className="seller-action">{x.action}</span></article>)}</div>}
        </section>
      </section><p className="data-note">O GitHub é a base versionada; o navegador preserva ajustes e registros manuais até eles serem promovidos para o repositório.</p>
    </div>
    {showImport && <Modal title="Colar análise do chat" onClose={()=>setShowImport(false)}><p className="import-copy">Cole um registro JSON ou um lote com <code>opportunities</code>.</p><form onSubmit={importJson}><Field label="JSON da análise"><textarea name="json" rows={13} required autoFocus placeholder='{"brand":"Seiko","model":"8229-5019","askingPrice":330,"url":"https://..."}'/></Field><ModalActions onClose={()=>setShowImport(false)} submit="Importar para o Radar"/></form></Modal>}
    {showNew && <Modal title="Nova oportunidade" onClose={()=>setShowNew(false)} large><form ref={newFormRef} onSubmit={createItem}><SmartImport formRef={newFormRef}/><div className="form-grid"><Text name="brand" label="Marca *" required/><Text name="model" label="Modelo / Referência *" required/><Text name="category" label="Categoria" defaultValue="Relógio"/><Text name="sourcePlatform" label="Fonte / Plataforma"/><Text name="seller" label="Vendedor"/><Num name="askingPrice" label="Preço pedido"/><Num name="fees" label="Frete + taxas" defaultValue="0"/><Num name="maxPurchase" label="Compra máxima"/><Num name="quickResale" label="Revenda rápida"/><Num name="likelyResale" label="Revenda provável"/><Num name="iao" label="IAO (0–100)"/><Num name="iam" label="IAM (0–100)"/><Num name="ice" label="ICE (0–100)"/><Text name="verdict" label="Veredito" defaultValue="EM ESTUDO"/><Text name="status" label="Status" defaultValue="Aprofundar"/><label className="field wide"><span>Observações</span><textarea name="notes" rows={4}/></label></div><ModalActions onClose={()=>setShowNew(false)} submit="Salvar no Radar"/></form></Modal>}
  </main>;
}

function Metric({label,value,note,accent=false}:{label:string;value:string;note:string;accent?:boolean}){return <article className={`metric-card ${accent?"accent":""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
function Text(props:{name:string;label:string;required?:boolean;defaultValue?:string;type?:string}){return <Field label={props.label}><input name={props.name} required={props.required} defaultValue={props.defaultValue} type={props.type||"text"}/></Field>}
function Num(props:{name:string;label:string;defaultValue?:string}){return <Field label={props.label}><input name={props.name} type="number" step="0.01" min="0" defaultValue={props.defaultValue}/></Field>}
function Modal({title,onClose,children,large=false}:{title:string;onClose:()=>void;children:React.ReactNode;large?:boolean}){return <div className="modal-backdrop" onMouseDown={onClose}><section className={`modal ${large?"large":""}`} onMouseDown={e=>e.stopPropagation()}><div className="modal-heading"><div><p className="section-kicker">RADAR ARBITRAGE</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>{children}</section></div>}
function ModalActions({onClose,submit}:{onClose:()=>void;submit:string}){return <div className="modal-actions"><button type="button" className="button cancel" onClick={onClose}>Cancelar</button><button type="submit" className="button primary">{submit}</button></div>}
function fmt(v:number|null){return v===null?"—":money.format(v)}
function fmtDate(v:string){const d=new Date(v);return Number.isNaN(d.getTime())?"—":dateBR.format(d)}
function slug(v:string){return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-")}