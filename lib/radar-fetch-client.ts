// Client-only helper (uses window/sessionStorage) — import only from "use
// client" components. Shared by SmartImport.tsx (AI analysis/compare calls)
// and RadarDashboard.tsx (opportunity CRUD calls), since both go through
// the same guardApiRequest() protection in lib/api-guard.ts and need the
// same handling for its two failure modes: an expired/missing admin
// session (redirect to /login) and an optional RADAR_API_ACCESS_TOKEN
// (prompt once, cache in sessionStorage for the rest of the tab's life).
const accessTokenKey = "radar-api-access-token";

export async function radarFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const send = (token: string) => {
    const headers = new Headers(init?.headers);
    if (token) headers.set("x-radar-access-token", token);
    return fetch(input, { ...init, headers });
  };

  const savedToken = sessionStorage.getItem(accessTokenKey) || "";
  const response = await send(savedToken);
  if (response.status === 401 && response.headers.get("x-radar-session") === "required") {
    window.location.assign("/login?next=/radar");
    return response;
  }
  if (response.status !== 401 || response.headers.get("x-radar-auth") !== "required") return response;

  sessionStorage.removeItem(accessTokenKey);
  const token = window.prompt("Digite o token privado do Radar para continuar:")?.trim() || "";
  if (!token) return response;
  sessionStorage.setItem(accessTokenKey, token);
  return send(token);
}
