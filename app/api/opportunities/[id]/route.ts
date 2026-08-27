import { NextResponse } from "next/server";
import { guardApiRequest } from "../../../../lib/api-guard";
import { deleteOpportunity, updateOpportunity, type OpportunityInput } from "../../../../lib/opportunities-db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
    const denied = guardApiRequest(request, "opportunities-write");
    if (denied) return denied;

  try {
        const { id } = await params;
        const patch = (await request.json()) as OpportunityInput;
        if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
                return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
        }

      const updated = await updateOpportunity(id, patch);
        if (!updated) return NextResponse.json({ error: `Oportunidade ${id} não encontrada.` }, { status: 404 });
        return NextResponse.json({ opportunity: updated });
  } catch (error) {
        console.error("Radar opportunity update error", error);
        return NextResponse.json({ error: "Falha ao salvar reavaliação." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
    const denied = guardApiRequest(request, "opportunities-write");
    if (denied) return denied;

  try {
        const { id } = await params;
        await deleteOpportunity(id);
        return NextResponse.json({ ok: true });
  } catch (error) {
        console.error("Radar opportunity delete error", error);
        return NextResponse.json({ error: "Falha ao remover oportunidade." }, { status: 500 });
  }
}
