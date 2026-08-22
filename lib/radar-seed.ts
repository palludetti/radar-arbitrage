import "server-only";

import importedPayload from "../data/radar_arbitrage_import_2026-08-14.json";

type OpportunitySeed = {
  id?: string;
  category?: string;
  brand?: string;
  model?: string;
  sourcePlatform?: string;
  seller?: string;
  askingPrice?: number | null;
  fees?: number | null;
  shipping?: number | null;
  purchaseFees?: number | null;
  maintenanceReserve?: number | null;
  partsReserve?: number | null;
  safetyMargin?: number | null;
  sellingCosts?: number | null;
  totalCost?: number | null;
  maxPurchase?: number | null;
  quickResale?: number | null;
  likelyResale?: number | null;
  grossMargin?: number | null;
  roiGross?: number | null;
  liquidity?: number | null;
  condition?: number | null;
  originality?: number | null;
  completeness?: number | null;
  iao?: number | null;
  iam?: number | null;
  ice?: number | null;
  radarScore?: number | null;
  authGate?: string;
  capitalGate?: string;
  conditionGate?: string;
  verdict?: string;
  status?: string;
  notes?: string;
  url?: string | null;
  validated?: boolean;
  origin?: string;
  createdAt?: string;
  updatedAt?: string;
};

type SellerSeed = { id: string; name: string; platforms: string; location: string; specialty: string; positiveSignals: string; risks: string; ice: number; action: string };
type RuleSeed = { id: number; rule: string; type: string; definition: string; reason: string };

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

const sellers: SellerSeed[] = [
  { id:"V-001", name:"José Andrade", platforms:"Facebook", location:"Japaraíba-MG", specialty:"Orient/Seiko/Citizen vintage", positiveSignals:"Referências; giro rápido; preços agressivos", risks:"Alegações ainda precisam prova; algumas pulseiras não originais", ice:82, action:"Monitorar" },
  { id:"V-002", name:"Watches.br / lojista OLX", platforms:"OLX", location:"SP", specialty:"Seiko vintage", positiveSignals:"Estoque e garantia", risks:"Menor assimetria; preço mais próximo do mercado", ice:76, action:"Comparável" },
  { id:"V-003", name:"Vendedores avulsos", platforms:"Facebook/OLX", location:"Variado", specialty:"Variado", positiveSignals:"Pode haver assimetria", risks:"Reputação/autenticidade variáveis", ice:55, action:"Triagem forte" },
];

const rules: RuleSeed[] = [
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

const baseOpportunities: OpportunitySeed[] = baseRows.map((row) => {
  const e = row as readonly unknown[];
  const createdAt = "2026-08-11T00:00:00Z";
  return {
    id: e[0] as string,
    category: e[1] as string,
    brand: e[2] as string,
    model: e[3] as string,
    sourcePlatform: e[4] as string,
    seller: e[5] as string,
    askingPrice: e[6] as number | null,
    fees: e[7] as number | null,
    totalCost: e[8] as number | null,
    maxPurchase: e[9] as number | null,
    quickResale: e[10] as number | null,
    likelyResale: e[11] as number | null,
    grossMargin: e[12] as number | null,
    roiGross: e[13] as number | null,
    liquidity: e[14] as number | null,
    condition: e[15] as number | null,
    originality: e[16] as number | null,
    completeness: e[17] as number | null,
    iao: e[18] as number | null,
    iam: e[19] as number | null,
    ice: e[20] as number | null,
    radarScore: e[21] as number | null,
    authGate: e[22] as string,
    capitalGate: e[23] as string,
    verdict: e[24] as string,
    status: e[25] as string,
    notes: e[26] as string,
    url: e[27] as string | null,
    validated: validatedIds.has(e[0] as string),
    origin: "master_v1",
    createdAt,
    updatedAt: createdAt,
  };
});

export function getRadarSeed() {
  return {
    opportunities: [
      ...baseOpportunities,
      ...(importedPayload.opportunities as OpportunitySeed[]),
    ],
    sellers,
    rules,
  };
}

