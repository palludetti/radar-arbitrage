import fs from "node:fs";

const path = "app/api/analyze/route.ts";
let source = fs.readFileSync(path, "utf8");

const oldSignature = `async function analyzeWithAI(url: string, page: PageContext, images: File[], fallback: Analysis): Promise<Analysis> {\n  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;\n  if (!token) return fallback;`;
const newSignature = `async function analyzeWithAI(url: string, page: PageContext, images: File[], fallback: Analysis, runtimeOidcToken: string | null): Promise<Analysis> {\n  const token = process.env.AI_GATEWAY_API_KEY || runtimeOidcToken || process.env.VERCEL_OIDC_TOKEN;\n  if (!token) return { ...fallback, warnings: [...fallback.warnings, "IA sem credencial disponível no runtime; usei leitura básica."] };`;

if (!source.includes(newSignature)) {
  if (!source.includes(oldSignature)) throw new Error("Patch point not found: analyzeWithAI signature");
  source = source.replace(oldSignature, newSignature);
}

const oldFailure = `  if (!response.ok) return { ...fallback, warnings: [...fallback.warnings, \`IA indisponível (\${response.status}); usei leitura básica da página.\`] };`;
const newFailure = `  if (!response.ok) {\n    const gatewayError = (await response.text()).slice(0, 800);\n    console.warn("Radar AI Gateway error", response.status, gatewayError);\n    return { ...fallback, warnings: [...fallback.warnings, \`IA indisponível (\${response.status}); usei leitura básica da página.\`] };\n  }`;

if (!source.includes(newFailure)) {
  if (!source.includes(oldFailure)) throw new Error("Patch point not found: gateway failure");
  source = source.replace(oldFailure, newFailure);
}

const oldCall = `    const result = await analyzeWithAI(canonicalUrl, page, files, fallback);`;
const newCall = `    const runtimeOidcToken = request.headers.get("x-vercel-oidc-token");\n    const result = await analyzeWithAI(canonicalUrl, page, files, fallback, runtimeOidcToken);`;

if (!source.includes(newCall)) {
  if (!source.includes(oldCall)) throw new Error("Patch point not found: analyze call");
  source = source.replace(oldCall, newCall);
}

fs.writeFileSync(path, source);
console.log("Runtime OIDC hotfix applied.");
