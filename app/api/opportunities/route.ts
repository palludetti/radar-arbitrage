import { NextResponse } from "next/server";
import { guardApiRequest } from "../../../lib/api-guard";
import { createOpportunities, listOpportunities, type OpportunityInput } from "../../../lib/opportunities-db";

export const runtime = "nodejs";

const MAX_BULK_ITEMS = 500;

export async function GET(request: Request) {
    const denied = guardApiRequest(request, "opportunities-read");
    if (denied) return denied;

  try {
        const opportunities = await listOpportunities();
        return NextResponse.json({ opportunities });
  } catch (error) {
        console.error("Radar opportunities list error", error);
        return NextResponse.json({ error: "Falha ao carregar oportunidades." }, { status: 500 });
  }
}

/**
 * Bulk create. Covers both "Nova oportunidade" (a single-item array, no id —
 * the database assigns the next RA-### atomically) and "Colar do chat"
 * (many items, ids may or may not be present). Items whose id already
 * exists in the table are skipped, not overwritten — see
 * createOpportunities in lib/opportunities-db.ts for why that's atomic at
 * the database level rather than a check-then-insert race.
 */
export async function POST(request: Request) {
    const denied = guardApiRequest(request, "opportunities-write");
    if (denied) return denied;

  try {
        const body = (await request.json()) as { opportunities?: unknown };
        const items = body?.opportunities;
        if (!Array.isArray(items) || items.length === 0) {
                return NextResponse.json({ error: "Envie ao menos uma oportunidade em `opportunities`." }, { status: 400 });
        }
        if (items.length > MAX_BULK_ITEMS) {
                return NextResponse.json({ error: `Envie no máximo ${MAX_BULK_ITEMS} oportunidades por vez.` }, { status: 400 });
        }
        if (!items.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
                return NextResponse.json({ error: "Cada oportunidade deve ser um objeto." }, { status: 400 });
        }

      const { created, skippedIds } = await createOpportunities(items as OpportunityInput[]);
        return NextResponse.json({ created, skippedIds });
  } catch (error) {
        console.error("Radar opportunities create error", error);
        return NextResponse.json({ error: "Falha ao salvar oportunidade(s)." }, { status: 500 });
  }
}
