"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import newPayload from "../data/radar_arbitrage_import_2026-08-14.json";

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

const validatedIds = new Set(["RA-002","RA-003","RA-004","RA-005","RA-006","RA-009","RA-012","RA-015","RA-020"]);
const baseRows = [
["RA-001","Relógio","Orient","Crystal Dourado EM02","Facebook","José Andrade",240,35,275,300,450,600,325,1.1818181818,4,4,4,3,88,82,78,84.2,"N/A","OK","JOIA","Histórico","Pulseira posteriormente questionada; confirmar originalidade/completude.",null],
["RA-002","Relógio","Orient","Three Star azul","Facebook","José Andrade",230,35,265,300,450,600,335,1.2641509434,5,4,4,4,92,85,82,87.9,"N/A","OK","FOGUINHO","Vendido","Vendido rapidamente; forte evidência prática de liquidez.",null],
["RA-003","Relógio","Orient","46941 verde","Facebook","José Andrade",260,35,295,320,500,650,355,1.2033898305,4,4,4,4,91,86,80,87.3,"N/A","OK","FOGUINHO","Histórico","Mostrador verde diferenciado; verificar movimento e revisão.",null],
["RA-004","Relógio","Orient","Calibre 1946 verde","Facebook","José Andrade",280,35,315,320,450,600,285,.9047619048,3,4,4,3,86,83,79,83.7,"N/A","OK","JOIA","Histórico","Colecionável e mais nichado.",null],
["RA-005","Relógio","Orient","King Diver","Facebook","José Andrade",790,45,835,900,1400,1800,965,1.1556886228,4,4,4,4,94,93,82,91.3,"N/A","NÃO","FOGUINHO","Vendido","Maior ticket; forte apelo colecionável.",null],
["RA-006","Relógio","Orient","Three Star vermelho/rubi","Facebook","Outro vendedor",250,40,290,300,450,550,260,.8965517241,4,4,4,4,91,86,68,84.9,"N/A","NÃO","JOIA","Aprofundar","Pedir movimento, referência e prova funcional.",null],
["RA-007","Relógio","Orient","46943 texturizado/dourado","Facebook","Outro vendedor",330,40,370,300,450,550,180,.4864864865,4,4,4,4,77,84,70,77.7,"N/A","NÃO","NEGOCIAR","Aprofundar","Revisão alegada; pedir foto do movimento e evidência.",null],
["RA-008","Relógio","Orient","46943 linen / marrom","Facebook","Outro vendedor",370,40,410,330,500,600,190,.4634146341,3,4,4,4,72,82,72,75,"N/A","NÃO","PASSAR","Histórico","Bom relógio, preço mais próximo do mercado.",null],
["RA-009","Relógio","Orient","Mostrador romano","Facebook","José Andrade",260,35,295,260,400,460,165,.5593220339,4,4,4,2,82,78,79,80.2,"N/A","OK","JOIA","Aprofundar","Pulseira Champion não original; penaliza completude.",null],
["RA-010","Relógio","Orient","Degradê azul","Facebook","José Andrade",190,40,230,220,330,400,170,.7391304348,4,2,4,3,68,80,58,69.6,"N/A","NÃO","PASSAR","Reavaliado","Rebaixado por custo total, dial incerto e revisão não comprovada.",null],
["RA-011","Relógio","Orient","MBSS1381","Facebook","Outro vendedor",150,35,185,160,220,260,75,.4054054054,3,5,4,4,62,55,74,62.3,"N/A","OK","PASSAR","Histórico","Quartzo comum; fraco para arbitragem.",null],
["RA-012","Relógio","Citizen","Automático vintage 21 jewels","Facebook","José/Outro",240,35,275,300,450,600,325,1.1818181818,4,4,4,3,88,82,72,83,"N/A","OK","JOIA","Aprofundar","Confirmar calibre, movimento, precisão e pulseira.",null],
["RA-013","Relógio","Citizen","AW5000-16L Eco-Drive","Facebook","Outro vendedor",1099,40,1139,800,950,1100,-39,-.0342405619,3,4,4,4,45,60,75,55.5,"N/A","NÃO","PASSAR","Histórico","Preço sem margem clara.",null],
["RA-014","Relógio","Citizen","Tsuyosa amarelo","Facebook/Loja","Outro",2550,50,2600,2200,2500,2800,200,.0769230769,4,5,5,5,58,76,80,67.8,"N/A","NÃO","PASSAR","Histórico","Modelo líquido, entrada alta.",null],
["RA-015","Relógio","Seiko","6119 vintage (José)","Facebook","José Andrade",340,35,375,400,550,700,325,.8666666667,4,4,4,3,88,88,80,86.4,"N/A","OK","JOIA","Histórico","Preço de entrada forte; checar revisão.",null],
["RA-016","Relógio","Seiko","6119 OLX","OLX","Loja/terceiro",590,50,640,430,650,750,110,.171875,4,4,4,3,60,88,74,71.2,"N/A","NÃO","PASSAR","Corrigido","Falso positivo; preço real R$590.","https://sp.olx.com.br/baixada-santista-e-litoral-sul/bijouteria-relogios-e-acessorios/seiko-automatico-6119-antigo-raro-japan-nao-e-orient-citizen-ricoh-technos-mido-suico-1514126096?lis=listing_8080"],
["RA-017","Relógio","Seiko","7005-8000","Facebook","Outro vendedor",1500,50,1550,1200,1500,1800,250,.1612903226,3,4,4,2,40,80,72,58.4,"N/A","NÃO","PASSAR","Histórico","Coleção > arbitragem.",null],
["RA-018","Relógio","Seiko","SNXS79B1","Facebook","Outro vendedor",1400,50,1450,1050,1400,1550,100,.0689655172,4,5,5,4,48,82,78,64.2,"N/A","NÃO","PASSAR","Histórico","Pouca margem.",null],
["RA-019","Relógio","Seiko","SSK001 GMT","Facebook","Outro vendedor",null,null,null,2200,2500,2800,null,null,4,5,5,5,null,88,80,null,"N/A","N/A","NEGOCIAR","Histórico","Só se entrar bem abaixo do mercado.",null],
["RA-020","Relógio","Casio","MTP-1291","Facebook","José Andrade",190,30,220,210,330,400,180,.8181818182,5,5,5,4,86,70,82,80.4,"N/A","OK","JOIA","Histórico","Boa liquidez; margem absoluta menor.",null],
["RA-021","Relógio","Casio","Edifice EF-125 / 2719","Facebook","Outro vendedor",null,null,null,280,350,430,null,null,4,4,4,4,null,65,70,null,"N/A","N/A","NEGOCIAR","Aprofundar","Oferta sugerida R$220–250; máximo ~R$280.",null],
["RA-022","Relógio","Mido","Multi Star Datoday","Facebook","Outro vendedor",1200,45,1245,950,1200,1400,155,.124497992,3,4,4,3,55,82,70,66.1,"N/A","NÃO","PASSAR","Histórico","Bom relógio; desconto insuficiente.",null],
["RA-023","Relógio","Invicta","Pro Diver Scuba 17566","Facebook","Outro vendedor",850,45,895,600,800,950,55,.061452514,2,4,4,5,35,45,68,44.6,"N/A","NÃO","PASSAR","Histórico","Margem/liquidez fracas.",null],
["RA-024","Relógio","Bulova","98C126 Crystal","Amazon","Amazon.com.br",1482.4,0,1482.4,1200,1500,1800,317.6,.2142471668,3,5,5,5,58,72,90,68.6,"N/A","NÃO","PASSAR","Histórico","Desconto de varejo não garante arbitragem.",null],
["RA-025","Relógio","Omega","Seamaster 2501.81","OLX/Chrono24","Terceiros",null,null,null,null,null,null,null,null,4,3,2,3,null,90,45,null,"PENDENTE","N/A","APROFUNDAR","Histórico","Luxo: autenticidade antes do score.","https://www.chrono24.com.br/omega/seamaster-vintage--imod2874.htm"],
["RA-026","Smartphone","Apple","iPhone 17e 256GB","Amazon/Marketplaces","Varejo",3998.99,0,3998.99,3750,4050,4200,201.01,.050265192,5,5,5,5,52,78,95,68.4,"N/A","NÃO","PASSAR","Histórico","Mercado eficiente; margem evapora após taxas.",null],
["RA-027","Smartphone","Motorola","Razr 60 256GB","Amazon/Motorola","Varejo",3059,0,3059,2900,3200,3400,341,.111474338,4,5,5,5,50,68,95,64.4,"N/A","NÃO","PASSAR","Histórico","Sem arbitragem comprovada.",null],
["RA-028","Tênis","Nike","Pegasus Plus Feminino","Nike","Nike",549.99,0,549.99,null,null,null,null,0,4,5,5,5,null,65,95,null,"N/A","N/A","EM ESTUDO","Laboratório","Precisa de revenda real por tamanho/cor.","https://www.nike.com.br/tenis-nike-pegasus-plus-feminino-029398.html"]
] as const;

const sellers: Seller[] = [
  { id:"V-001", name:"José Andrade", platforms:"Facebook", location:"Japaraíba-MG", specialty:"Orient/Seiko/Citizen vintage", positiveSignals:"Referências; giro rápido; preços agressivos", risks:"Alegações ainda precisam prova; algumas pulseiras não originais", ice:82, action:"Monitorar" },
  { id:"V-002", name:"Watches.br / lojista OLX", platforms:"OLX", location:"SP", specialty:"Seiko vintage", positiveSignals:"Estoque e garantia", risks:"Menor assimetria; preço mais próximo do mercado", ice:76, action:"Comparável" },
  { id:"V-003", name:"Vendedores avulsos", platforms:"Facebook/OLX", location:"Variado", specialty:"Variado", positiveSignals:"Pode haver assimetria", risks:"Reputação/autenticidade variáveis", ice:55, action:"Triagem forte" },
];

const rules: Rule[] = [
  { id:1, rule:"IAO mínimo Base Validada", type:"Threshold", definition:"80", reason:"Mantém a base qualificada limpa." },
  { id:2, rule:"Radar Score v1", type:"Fórmula", definition:"50% IAO + 30% IAM + 20% ICE", reason:"Síntese simples." },
  { id:3, rule:"Foguinho", type:"Gate", definition:"Somente após custo total + evidência mínima", reason:"Evita falsos positivos." },
  { id:4, rule:"Revisado", type:"Evidência", definition:"Sem prova = alegação", reason:"Não valorar promessa como fato." },
  { id:5, rule:"Preço anunciado", type:"Mercado", definition:"Comparável, não venda realizada", reason:"Aplicar margem de segurança." },
  { id:6, rule:"Luxo", type:"Autenticidade", definition:"Gate obrigatório antes do score", reason:"Omega/Rolex etc." },
  { id:7, rule:"Canal de revenda", type:"Operação", definition:"Evitar mesmo grupo-fonte do fornecedor recorrente", reason:"Reduz conflito/exposição do spread." },
  { id:8, rule:"Alertas", type:"Monitoramento", definition:"Só desconto significativo + margem líquida plausível", reason:"Menos ruído." },
  { id:9, rule:"MVP", type:"Produto", definition:"Comprar / Joia / Negociar / Passar", reason:"Menos é mais." },
];

const defaultWeights: Weights = { iao:50, iam:30, ice:20 };
const storageKey = "radar-arbitrage-vercel-v2";
const money = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 });

function n(v: unknown): number | null { if (v === null || v === undefined || v === "") return null; const x = Number(v); return Number.isFinite(x) ? x : null; }
function s(v: unknown, fallback=""): string { return typeof v === "string" ? v.trim() : fallback; }
function normalize(raw: Partial<Opportunity>, fallbackId: string): Opportunity {
  const askingPrice = n(raw.askingPrice); const fees = n(raw.fees) ?? 0; const totalCost = n(raw.totalCost) ?? (askingPrice === null ? null : askingPrice + fees);
  const likelyResale = n(raw.likelyResale); const grossMargin = n(raw.grossMargin) ?? (likelyResale === null || totalCost === null ? null : likelyResale - totalCost);
  const roiGross = n(raw.roiGross) ?? (grossMargin !== null && totalCost ? grossMargin / totalCost : null);
  const iao = n(raw.iao), iam = n(raw.iam), ice = n(raw.ice); const radarScore = n(raw.radarScore) ?? (iao === null || iam === null || ice === null ? null : .5*iao + .3*iam + .2*ice);
  const now = new Date().toISOString();
  return { id:s(raw.id,fallbackId), category:s(raw.category,"Outros"), brand:s(raw.brand), model:s(raw.model,"Novo anúncio"), sourcePlatform:s(raw.sourcePlatform), seller:s(raw.seller), askingPrice, fees, totalCost, maxPurchase:n(raw.maxPurchase), quickResale:n(raw.quickResale), likelyResale, grossMargin, roiGross, liquidity:n(raw.liquidity), condition:n(raw.condition), originality:n(raw.originality), completeness:n(raw.completeness), iao, iam, ice, radarScore, authGate:s(raw.authGate,"N/A"), capitalGate:s(raw.capitalGate,"N/A"), verdict:s(raw.verdict, radarScore===null?"EM ESTUDO":radarScore>=87?"FOGUINHO":radarScore>=80?"JOIA":radarScore>=65?"NEGOCIAR":"PASSAR"), status:s(raw.status,"Aprofundar"), notes:s(raw.notes), url:s(raw.url)||null, validated:raw.validated===true, origin:s(raw.origin,"manual"), createdAt:s(raw.createdAt,now), updatedAt:now };
}

const baseOpportunities: Opportunity[] = baseRows.map((e) => normalize({ id:e[0], category:e[1], brand:e[2], model:e[3], sourcePlatform:e[4], seller:e[5], askingPrice:e[6], fees:e[7], totalCost:e[8], maxPurchase:e[9], quickResale:e[10], likelyResale:e[11], grossMargin:e[12], roiGross:e[13], liquidity:e[14], condition:e[15], originality:e[16], completeness:e[17], iao:e[18], iam:e[19], ice:e[20], radarScore:e[21], authGate:e[22], capitalGate:e[23], verdict:e[24], status:e[25], notes:e[26], url:e[27], validated:validatedIds.has(e[0]), origin:"master_v1", createdAt:"2026-08-11T00:00:00Z" }, e[0]));
const repoOpportunities = (newPayload.opportunities as Partial<Opportunity>[]).map((x, i) => normalize(x, `RA-${String(29+i).padStart(3,"0")}`));
const repoSeed = [...baseOpportunities, ...repoOpportunities];

function mergeRepoSeed(local: Opportunity[]) {
  const byId = new Map(local.map(x => [x.id, x]));
  for (const repo of repoSeed) {
    const current = byId.get(repo.id);
    if (!current || current.origin === "master_v1" || current.origin.startsWith("chat_") || current.origin.startsWith("auction_")) byId.set(repo.id, repo);
  }
  return Array.from(byId.values());
}

export default function Page() {
  const [items,setItems] = useState<Opportunity[]>([]); const [weights,setWeights] = useState<Weights>(defaultWeights); const [loading,setLoading] = useState(true);
  const [search,setSearch] = useState(""); const [category,setCategory] = useState("Todas"); const [maxPrice,setMaxPrice] = useState(""); const [minScore,setMinScore] = useState("0"); const [sort,setSort] = useState("score"); const [view,setView] = useState("all");
  const [showImport,setShowImport] = useState(false); const [showNew,setShowNew] = useState(false); const [notice,setNotice] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const legacy = localStorage.getItem("radar-arbitrage-vercel-v1");
      const parsed = saved ? JSON.parse(saved) : legacy ? JSON.parse(legacy) : null;
      const merged = mergeRepoSeed(parsed?.opportunities ?? []);
      setItems(merged); setWeights(parsed?.weights ?? defaultWeights);
      localStorage.setItem(storageKey, JSON.stringify({ opportunities:merged, sellers, rules, weights:parsed?.weights ?? defaultWeights }));
    } finally { setLoading(false); }
  }, []);

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
  function remove(id:string){ if(confirm(`Remover ${id}?`)){ persist(items.filter(x=>x.id!==id)); setNotice(`${id} removido.`); } }
  function importJson(e:FormEvent<HTMLFormElement>){ e.preventDefault(); const data=new FormData(e.currentTarget); try { const text=String(data.get("json")||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""); const obj=JSON.parse(text); const list=Array.isArray(obj)?obj:obj.opportunities?obj.opportunities:[obj]; const existing=new Set(items.map(x=>x.id)); let max=items.reduce((m,x)=>{const z=/^RA-(\d+)$/.exec(x.id);return z?Math.max(m,Number(z[1])):m},0); const added=(list as Partial<Opportunity>[]).map((x,i)=>normalize(x,`RA-${String(max+i+1).padStart(3,"0")}`)).filter(x=>!existing.has(x.id)); persist([...added,...items]); setShowImport(false); setNotice(`${added.length} registro(s) importado(s).`); } catch { setNotice("JSON inválido."); } }
  function createItem(e:FormEvent<HTMLFormElement>){ e.preventDefault(); const fd=new FormData(e.currentTarget); const raw:Record<string,unknown>={}; for(const [k,v] of fd.entries()) raw[k]=["askingPrice","fees","maxPurchase","quickResale","likelyResale","liquidity","condition","originality","completeness","iao","iam","ice"].includes(k)?n(v):String(v).trim(); const max=items.reduce((m,x)=>{const z=/^RA-(\d+)$/.exec(x.id);return z?Math.max(m,Number(z[1])):m},0); const item=normalize(raw as Partial<Opportunity>,`RA-${String(max+1).padStart(3,"0")}`); persist([item,...items]); setShowNew(false); setNotice(`${item.id} salvo.`); }

  return <main>
    <header className="topbar"><div className="brand"><div className="brand-mark">RA</div><div><strong>Radar Arbitrage</strong><span>Base operacional privada</span></div></div><div className="top-actions"><button className="button ghost" onClick={exportJson}>↓ Exportar</button><button className="button secondary" onClick={()=>setShowImport(true)}>↳ Colar do chat</button><button className="button primary" onClick={()=>setShowNew(true)}>＋ Novo anúncio</button></div></header>
    <div className="workspace">
      <section className="hero"><div><p className="eyebrow">GITHUB + VERCEL</p><h1>Onde há margem de verdade?</h1><p className="hero-copy">A base versionada no GitHub é incorporada em cada deploy. Registros locais continuam preservados neste navegador.</p></div><div className="sync-state"><i/>Base central: {repoSeed.length} registros</div></section>
      {notice && <div className="notice success"><span>{notice}</span><button onClick={()=>setNotice("")}>×</button></div>}
      <section className="metrics"><Metric label="Oportunidades registradas" value={loading?"—":String(metrics.total)} note="Base GitHub + dados locais"/><Metric label="Base validada" value={loading?"—":String(metrics.validated)} note="Registros confirmados" accent/><Metric label="Foguinho / Joia" value={loading?"—":String(metrics.jewels)} note="Potencial prioritário"/><Metric label="Ticket médio observado" value={loading?"—":money.format(metrics.average)} note="Preço pedido disponível"/></section>
      <section className="dashboard-grid">
        <aside className="control-panel"><p className="section-kicker">RADAR SCORE V1</p><h2>Pesos do modelo</h2><p className="panel-copy">A pontuação pode ser simulada sem alterar IAO, IAM e ICE gravados.</p>{(["iao","iam","ice"] as const).map((k)=><label className="weight-row" key={k}><span>{k.toUpperCase()}<strong>{weights[k]}%</strong></span><input type="range" min="0" max="100" value={weights[k]} onChange={e=>setWeights(w=>({...w,[k]:Number(e.target.value)}))}/></label>)}<div className="weight-footer"><span>Total: {weights.iao+weights.iam+weights.ice}%</span><button onClick={()=>setWeights(defaultWeights)}>Restaurar 50/30/20</button></div><button className="button save-button" onClick={saveWeights}>Salvar pesos</button><div className="formula-card"><strong>Metodologia preservada</strong><p>Radar Score = 50% IAO + 30% IAM + 20% ICE. Autenticidade e capital seguem como gates separados.</p></div><div className="rules-card"><strong>Regras carregadas</strong><span>{rules.length} diretrizes operacionais</span></div></aside>
        <section className="opportunities"><div className="opportunities-heading"><div><p className="section-kicker">RADAR OPERACIONAL</p><h2>{view==="sellers"?"Vendedores":"Oportunidades"}</h2></div><span className="result-count">{view==="sellers"?sellers.length:filtered.length} resultados</span></div>
          <nav className="view-tabs"><button className={view==="all"?"active":""} onClick={()=>setView("all")}>Todas</button><button className={view==="active"?"active":""} onClick={()=>setView("active")}>Em análise</button><button className={view==="validated"?"active":""} onClick={()=>setView("validated")}>Base validada</button><button className={view==="sellers"?"active":""} onClick={()=>setView("sellers")}>Vendedores</button></nav>
          {view!=="sellers" ? <><div className="filters"><Field label="Buscar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Marca, modelo, vendedor ou ID"/></Field><Field label="Categoria"><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Preço máximo"><input type="number" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Sem limite"/></Field><Field label="Score mínimo"><select value={minScore} onChange={e=>setMinScore(e.target.value)}><option value="0">Todos</option><option value="65">65+</option><option value="80">80+</option><option value="87">87+</option></select></Field><Field label="Ordenar"><select value={sort} onChange={e=>setSort(e.target.value)}><option value="score">Maior score</option><option value="margin">Maior margem</option><option value="iao">Maior IAO</option><option value="price">Menor preço</option></select></Field></div><div className="table-wrap"><table className="radar-table"><thead><tr><th>Oportunidade</th><th>Custo</th><th>Compra máx.</th><th>Revenda prov.</th><th>ROI</th><th>IAO · IAM · ICE</th><th>Score</th><th>Veredito</th><th></th></tr></thead><tbody>{filtered.map(x=><tr key={x.id}><td><div className="listing-title"><strong>{x.brand} {x.model}</strong><span>{x.id} · {x.category} · {x.sourcePlatform}{x.seller?` · ${x.seller}`:""}</span></div></td><td><strong>{fmt(x.totalCost??x.askingPrice)}</strong></td><td>{fmt(x.maxPurchase)}</td><td>{fmt(x.likelyResale)}</td><td><div className={(x.roiGross??0)>=.25?"profit positive":"profit neutral"}><strong>{x.roiGross===null?"—":`${Math.round(100*x.roiGross)}%`}</strong><span>{fmt(x.grossMargin)}</span></div></td><td><div className="score-trio"><span>{x.iao??"—"}</span><span>{x.iam??"—"}</span><span>{x.ice??"—"}</span></div></td><td><div className="score-badge"><strong>{x.score===null?"—":x.score.toFixed(1)}</strong><span>{x.validated?"VALIDADA":x.status}</span></div></td><td><span className={`verdict ${slug(x.verdict)}`}>{x.verdict}</span></td><td><div className="row-actions">{x.url&&<a href={x.url} target="_blank" rel="noreferrer" title="Abrir anúncio">↗</a>}<button onClick={()=>remove(x.id)} title="Remover">×</button></div></td></tr>)}</tbody></table>{!loading&&filtered.length===0&&<div className="empty-state"><strong>Nenhum registro nesse recorte.</strong><span>Ajuste os filtros ou adicione uma nova análise.</span></div>}</div></> : <div className="seller-grid">{sellers.map(x=><article key={x.id}><div className="seller-score"><span>ICE</span><strong>{x.ice}</strong></div><p className="section-kicker">{x.id} · {x.platforms}</p><h3>{x.name}</h3><p>{x.specialty} · {x.location}</p><dl><div><dt>Sinais positivos</dt><dd>{x.positiveSignals}</dd></div><div><dt>Riscos</dt><dd>{x.risks}</dd></div></dl><span className="seller-action">{x.action}</span></article>)}</div>}
        </section>
      </section><p className="data-note">O GitHub é a base versionada; o navegador preserva ajustes e registros manuais até eles serem promovidos para o repositório.</p>
    </div>
    {showImport && <Modal title="Colar análise do chat" onClose={()=>setShowImport(false)}><p className="import-copy">Cole um registro JSON ou um lote com <code>opportunities</code>.</p><form onSubmit={importJson}><Field label="JSON da análise"><textarea name="json" rows={13} required autoFocus placeholder='{"brand":"Seiko","model":"8229-5019","askingPrice":330,"url":"https://..."}'/></Field><ModalActions onClose={()=>setShowImport(false)} submit="Importar para o Radar"/></form></Modal>}
    {showNew && <Modal title="Nova oportunidade" onClose={()=>setShowNew(false)} large><form onSubmit={createItem}><div className="form-grid"><Text name="brand" label="Marca *" required/><Text name="model" label="Modelo / Referência *" required/><Text name="category" label="Categoria" defaultValue="Relógio"/><Text name="sourcePlatform" label="Fonte / Plataforma"/><Text name="seller" label="Vendedor"/><Text name="url" label="URL" type="url"/><Num name="askingPrice" label="Preço pedido"/><Num name="fees" label="Frete + taxas" defaultValue="0"/><Num name="maxPurchase" label="Compra máxima"/><Num name="quickResale" label="Revenda rápida"/><Num name="likelyResale" label="Revenda provável"/><Num name="iao" label="IAO (0–100)"/><Num name="iam" label="IAM (0–100)"/><Num name="ice" label="ICE (0–100)"/><Text name="verdict" label="Veredito" defaultValue="EM ESTUDO"/><Text name="status" label="Status" defaultValue="Aprofundar"/><label className="field wide"><span>Observações</span><textarea name="notes" rows={4}/></label></div><ModalActions onClose={()=>setShowNew(false)} submit="Salvar no Radar"/></form></Modal>}
  </main>;
}

function Metric({label,value,note,accent=false}:{label:string;value:string;note:string;accent?:boolean}){return <article className={`metric-card ${accent?"accent":""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
function Text(props:{name:string;label:string;required?:boolean;defaultValue?:string;type?:string}){return <Field label={props.label}><input name={props.name} required={props.required} defaultValue={props.defaultValue} type={props.type||"text"}/></Field>}
function Num(props:{name:string;label:string;defaultValue?:string}){return <Field label={props.label}><input name={props.name} type="number" step="0.01" min="0" defaultValue={props.defaultValue}/></Field>}
function Modal({title,onClose,children,large=false}:{title:string;onClose:()=>void;children:React.ReactNode;large?:boolean}){return <div className="modal-backdrop" onMouseDown={onClose}><section className={`modal ${large?"large":""}`} onMouseDown={e=>e.stopPropagation()}><div className="modal-heading"><div><p className="section-kicker">RADAR ARBITRAGE</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>{children}</section></div>}
function ModalActions({onClose,submit}:{onClose:()=>void;submit:string}){return <div className="modal-actions"><button type="button" className="button cancel" onClick={onClose}>Cancelar</button><button type="submit" className="button primary">{submit}</button></div>}
function fmt(v:number|null){return v===null?"—":money.format(v)}
function slug(v:string){return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-")}
