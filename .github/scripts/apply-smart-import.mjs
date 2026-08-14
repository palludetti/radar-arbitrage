import fs from "node:fs";

const pagePath = "app/page.tsx";
const cssPath = "app/globals.css";

let page = fs.readFileSync(pagePath, "utf8");

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Patch point not found: ${label}`);
  return source.replace(before, after);
}

page = replaceOnce(
  page,
  'import { FormEvent, useEffect, useMemo, useState } from "react";\nimport newPayload from "../data/radar_arbitrage_import_2026-08-14.json";',
  'import { FormEvent, useEffect, useMemo, useRef, useState } from "react";\nimport newPayload from "../data/radar_arbitrage_import_2026-08-14.json";\nimport SmartImport from "./SmartImport";',
  "imports",
);

page = replaceOnce(
  page,
  '  const [showImport,setShowImport] = useState(false); const [showNew,setShowNew] = useState(false); const [notice,setNotice] = useState("");',
  '  const [showImport,setShowImport] = useState(false); const [showNew,setShowNew] = useState(false); const [notice,setNotice] = useState("");\n  const newFormRef = useRef<HTMLFormElement>(null);',
  "form ref",
);

page = replaceOnce(
  page,
  '{showNew && <Modal title="Nova oportunidade" onClose={()=>setShowNew(false)} large><form onSubmit={createItem}><div className="form-grid">',
  '{showNew && <Modal title="Nova oportunidade" onClose={()=>setShowNew(false)} large><form ref={newFormRef} onSubmit={createItem}><SmartImport formRef={newFormRef}/><div className="form-grid">',
  "smart import mount",
);

page = replaceOnce(
  page,
  '<Text name="sourcePlatform" label="Fonte / Plataforma"/><Text name="seller" label="Vendedor"/><Text name="url" label="URL" type="url"/><Num name="askingPrice" label="Preço pedido"/>',
  '<Text name="sourcePlatform" label="Fonte / Plataforma"/><Text name="seller" label="Vendedor"/><Num name="askingPrice" label="Preço pedido"/>',
  "remove duplicate url field",
);

fs.writeFileSync(pagePath, page);

let css = fs.readFileSync(cssPath, "utf8");
const smartCss = `
.smart-import{margin:0 0 22px;padding:19px;border:1px solid #cfe3da;background:linear-gradient(135deg,#f6fbf8,#eef8f3)}
.smart-import-heading{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:16px}.smart-import-heading h3{margin:0;font-size:17px;letter-spacing:-.025em}.smart-import-heading p:not(.section-kicker){max-width:610px;margin:7px 0 0;color:var(--muted);font-size:11px;line-height:1.55}.ai-pill{padding:6px 9px;border:1px solid #bbdfcf;border-radius:20px;background:#fff;color:var(--green-dark);font-size:9px;font-weight:750;white-space:nowrap}.smart-import-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,1fr) auto;gap:10px;align-items:end}.smart-images input{padding:7px 9px}.smart-analyze{background:var(--ink);color:#fff;min-width:190px}.smart-analyze:disabled{opacity:.6;cursor:wait}.smart-message{margin-top:12px;padding:10px 12px;border:1px solid var(--line);font-size:11px}.smart-message.error{border-color:#efcaca;background:#fff2f2;color:#8d3030}.smart-result{margin-top:12px;padding:12px 13px;border:1px solid #d6e9e0;background:#fff}.smart-result-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.smart-result-top strong{font-size:11px}.smart-result-top span{padding:4px 7px;border-radius:20px;background:var(--green-soft);color:var(--green-dark);font-size:8px;font-weight:750;text-transform:uppercase}.confidence-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.confidence-list span{padding:5px 7px;border:1px solid #e1e8e4;background:#fafcfb;color:#65726c;font-size:9px}.confidence-list b{color:var(--ink)}.smart-result p{margin:9px 0 0;color:#9a681e;font-size:9px;line-height:1.5}.smart-result small{display:block;margin-top:9px;color:#7b8781;font-size:9px;line-height:1.5}
@media(max-width:820px){.smart-import-grid{grid-template-columns:1fr 1fr}.smart-analyze{grid-column:1/-1;width:100%}}
@media(max-width:560px){.smart-import-heading{flex-direction:column}.smart-import-grid{grid-template-columns:1fr}.smart-analyze{grid-column:auto}.ai-pill{align-self:flex-start}}
`;
if (!css.includes(".smart-import{")) css += smartCss;
fs.writeFileSync(cssPath, css);

console.log("Smart import integration applied.");
