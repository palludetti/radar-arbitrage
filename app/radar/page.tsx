import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminAuthConfigured, isValidAdminSession, RADAR_SESSION_COOKIE } from "../../lib/admin-session";
import { getRadarSeed } from "../../lib/radar-seed";
import { listOpportunities, type OpportunityRecord } from "../../lib/opportunities-db";
import RadarDashboard from "./RadarDashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "Painel privado",
    robots: { index: false, follow: false, nocache: true },
};

export default async function RadarPage() {
    const cookieStore = await cookies();
    const configured = isAdminAuthConfigured();
    const authorized = isValidAdminSession(cookieStore.get(RADAR_SESSION_COOKIE)?.value);
    // Local-dev convenience only: lets you see the dashboard without setting
  // up RADAR_ADMIN_PASSWORD/RADAR_SESSION_SECRET locally. Never applies in
  // production — guardApiRequest() independently refuses production
  // requests once auth isn't configured, so this can't leak data there.
  const devBypass = !configured && process.env.NODE_ENV !== "production";

  if (!devBypass && !authorized) redirect(configured ? "/login?next=/radar" : "/login?error=config");

  const seed = getRadarSeed();

  // Opportunities now live in Supabase instead of the git-committed seed.
  // A failed read must never render as an empty dashboard — real purchase
  // decisions get made off this data, so "0 oportunidades" has to mean
  // "genuinely zero", never "the database call failed". RadarDashboard
  // renders `loadError` as an explicit banner instead of silently showing
  // nothing.
  let opportunities: OpportunityRecord[] = [];
    let loadError = "";
    try {
          opportunities = await listOpportunities();
    } catch (error) {
          console.error("Radar opportunities load error", error);
          loadError = error instanceof Error ? error.message : "Falha ao carregar oportunidades do banco.";
    }

  return (
        <RadarDashboard
                opportunities={opportunities}
                loadError={loadError}
                seedSellers={seed.sellers}
                seedRules={seed.rules}
              />
      );
}
