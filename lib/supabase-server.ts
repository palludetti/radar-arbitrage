import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Lazily constructs the Supabase service-role client on first use.
 *
 * This MUST stay lazy (never build the client at module scope). Next.js
 * evaluates route/page modules during `next build`'s page-data collection,
 * and GitHub Actions CI does not have SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * configured — an eager client construction would throw during `npm run
 * build` on every PR, not just at request time in an unconfigured deploy.
 *
 * Uses the service_role key (server-only, full access, bypasses RLS) because
 * every caller of this module already sits behind the admin-session guard in
 * lib/api-guard.ts. The key never reaches the browser.
 */
export function supabase(): SupabaseClient {
    if (client) return client;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
          throw new Error("Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    }
    client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
    });
    return client;
}

export function isSupabaseConfigured() {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
