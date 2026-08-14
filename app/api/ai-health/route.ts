import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(request: Request) {
  const token = process.env.AI_GATEWAY_API_KEY || request.headers.get("x-vercel-oidc-token") || process.env.VERCEL_OIDC_TOKEN;
  if (!token) return NextResponse.json({ ok: false, stage: "auth", error: "missing_token" }, { status: 500 });

  const response = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: process.env.RADAR_AI_MODEL || "openai/gpt-5.6-sol",
      input: [{ type: "message", role: "user", content: "Responda apenas OK." }],
      max_output_tokens: 20,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    console.warn("Radar AI health error", response.status, body.slice(0, 800));
    return NextResponse.json({ ok: false, stage: "gateway", status: response.status, body: body.slice(0, 500) }, { status: 502 });
  }

  return NextResponse.json({ ok: true, stage: "gateway", status: response.status });
}
