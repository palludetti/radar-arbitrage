import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminAuthConfigured, isValidAdminSession, RADAR_SESSION_COOKIE } from "../../lib/admin-session";
import { getRadarSeed } from "../../lib/radar-seed";
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

  if (!configured && process.env.NODE_ENV !== "production") {
    const seed = getRadarSeed();
    return <RadarDashboard seedOpportunities={seed.opportunities} seedSellers={seed.sellers} seedRules={seed.rules} />;
  }
  if (!authorized) redirect(configured ? "/login?next=/radar" : "/login?error=config");

  const seed = getRadarSeed();
  return <RadarDashboard seedOpportunities={seed.opportunities} seedSellers={seed.sellers} seedRules={seed.rules} />;
}
