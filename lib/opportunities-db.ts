import "server-only";
import { supabase } from "./supabase-server";

/**
 * Server-side shape of an opportunity — only the "source" fields that
 * actually live in Postgres. Derived display fields (totalCost, grossMargin,
 * roiGross, the IAO/IAM/ICE-weighted radarScore fallback) are intentionally
 * NOT computed here: the client already computes them from these same
 * source fields via `normalize()` in app/radar/RadarDashboard.tsx, for both
 * seed data and (until this migration) localStorage data. Keeping that a
 * single, unchanged, client-side computation means there is no second
 * implementation of that math to drift out of sync with what the table
 * actually renders.
 */
export type OpportunityRecord = {
    id: string;
    category: string;
    brand: string;
    model: string;
    sourcePlatform: string;
    seller: string;
    askingPrice: number | null;
    shipping: number | null;
    purchaseFees: number | null;
    maintenanceReserve: number | null;
    partsReserve: number | null;
    safetyMargin: number | null;
    fees: number | null;
    sellingCosts: number | null;
    maxPurchase: number | null;
    quickResale: number | null;
    likelyResale: number | null;
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

/** Input for create/update — every field optional, id optional (server-assigned when absent). */
export type OpportunityInput = Partial<OpportunityRecord>;

const COLUMN_MAP: Record<keyof OpportunityRecord, string> = {
    id: "id",
    category: "category",
    brand: "brand",
    model: "model",
    sourcePlatform: "source_platform",
    seller: "seller",
    askingPrice: "asking_price",
    shipping: "shipping",
    purchaseFees: "purchase_fees",
    maintenanceReserve: "maintenance_reserve",
    partsReserve: "parts_reserve",
    safetyMargin: "safety_margin",
    fees: "fees",
    sellingCosts: "selling_costs",
    maxPurchase: "max_purchase",
    quickResale: "quick_resale",
    likelyResale: "likely_resale",
    liquidity: "liquidity",
    condition: "condition",
    originality: "originality",
    completeness: "completeness",
    iao: "iao",
    iam: "iam",
    ice: "ice",
    radarScore: "radar_score",
    authGate: "auth_gate",
    capitalGate: "capital_gate",
    conditionGate: "condition_gate",
    verdict: "verdict",
    status: "status",
    notes: "notes",
    url: "url",
    validated: "validated",
    origin: "origin",
    createdAt: "created_at",
    updatedAt: "updated_at",
};

/**
 * Converts an app-shaped (partial) input into a DB row, including only keys
 * actually present AND recognized. Unknown keys are dropped rather than
 * mapped — the client sends display-derived fields too (totalCost,
 * grossMargin, roiGross from RadarDashboard.tsx's normalize()) that have no
 * column here by design; silently ignoring them is correct, writing them
 * under a literal "undefined" column would not be.
 */
function toRow(input: OpportunityInput): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const key of Object.keys(input) as (keyof OpportunityInput)[]) {
          if (input[key] === undefined) continue;
          if (!(key in COLUMN_MAP)) continue;
          row[COLUMN_MAP[key]] = input[key];
    }
    return row;
}

/** Converts a full DB row back into the app shape. */
function fromRow(row: Record<string, any>): OpportunityRecord {
    return {
          id: row.id,
          category: row.category,
          brand: row.brand,
          model: row.model,
          sourcePlatform: row.source_platform,
          seller: row.seller,
          askingPrice: row.asking_price,
          shipping: row.shipping,
          purchaseFees: row.purchase_fees,
          maintenanceReserve: row.maintenance_reserve,
          partsReserve: row.parts_reserve,
          safetyMargin: row.safety_margin,
          fees: row.fees,
          sellingCosts: row.selling_costs,
          maxPurchase: row.max_purchase,
          quickResale: row.quick_resale,
          likelyResale: row.likely_resale,
          liquidity: row.liquidity,
          condition: row.condition,
          originality: row.originality,
          completeness: row.completeness,
          iao: row.iao,
          iam: row.iam,
          ice: row.ice,
          radarScore: row.radar_score,
          authGate: row.auth_gate,
          capitalGate: row.capital_gate,
          conditionGate: row.condition_gate,
          verdict: row.verdict,
          status: row.status,
          notes: row.notes,
          url: row.url,
          validated: row.validated,
          origin: row.origin,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
    };
}

export async function listOpportunities(): Promise<OpportunityRecord[]> {
    const { data, error } = await supabase()
      .from("opportunities")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Falha ao listar oportunidades: ${error.message}`);
    return (data ?? []).map(fromRow);
}

/**
 * Bulk-creates opportunities. Mirrors the pre-migration client-side "Colar do
 * chat" behavior: an item with an id that already exists in the table is
 * SKIPPED, not overwritten (deliberate edits go through updateOpportunity
 * instead) — this is enforced atomically in Postgres via
 * `ON CONFLICT (id) DO NOTHING` (upsert + ignoreDuplicates), not by a
 * check-then-insert in application code, so two concurrent imports can't
 * race each other into a duplicate. Items with no id get one assigned by
 * the `next_opportunity_id()` column default.
 */
export async function createOpportunities(
    items: OpportunityInput[],
  ): Promise<{ created: OpportunityRecord[]; skippedIds: string[] }> {
    const withId = items.filter((item) => typeof item.id === "string" && item.id.trim().length > 0);
    const withoutId = items.filter((item) => !(typeof item.id === "string" && item.id.trim().length > 0));
    const requestedIds = withId.map((item) => item.id as string);
    const created: OpportunityRecord[] = [];

  if (withId.length) {
        const { data, error } = await supabase()
          .from("opportunities")
          .upsert(
                    withId.map((item) => toRow(item)),
            { onConflict: "id", ignoreDuplicates: true },
                  )
          .select();
        if (error) throw new Error(`Falha ao importar oportunidades: ${error.message}`);
        created.push(...(data ?? []).map(fromRow));
  }

  if (withoutId.length) {
        const { data, error } = await supabase()
          .from("opportunities")
          .insert(withoutId.map((item) => toRow(item)))
          .select();
        if (error) throw new Error(`Falha ao criar oportunidade: ${error.message}`);
        created.push(...(data ?? []).map(fromRow));
  }

  const createdIds = new Set(created.map((item) => item.id));
    const skippedIds = requestedIds.filter((id) => !createdIds.has(id));
    return { created, skippedIds };
}

/** Returns null (not a thrown error) when no row matches `id`, so callers can return a clean 404. */
export async function updateOpportunity(id: string, patch: OpportunityInput): Promise<OpportunityRecord | null> {
    const { id: _ignored, ...rest } = patch;
    const { data, error } = await supabase()
      .from("opportunities")
      .update({ ...toRow(rest), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw new Error(`Falha ao salvar reavaliação: ${error.message}`);
    return data ? fromRow(data) : null;
}

export async function deleteOpportunity(id: string): Promise<void> {
    const { error } = await supabase().from("opportunities").delete().eq("id", id);
    if (error) throw new Error(`Falha ao remover oportunidade: ${error.message}`);
}
