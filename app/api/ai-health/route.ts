import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

function outputText(result: any) {
  if (typeof result?.output_text === "string") return result.output_text;
  for (const item of result?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

export async function GET(request: Request) {
  const token = process.env.AI_GATEWAY_API_KEY || request.headers.get("x-vercel-oidc-token") || process.env.VERCEL_OIDC_TOKEN;
  if (!token) return NextResponse.json({ ok: false, stage: "auth", error: "missing_token" }, { status: 500 });

  const model = "alibaba/qwen3.5-flash";
  const schema = {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      imageSeen: { type: "boolean" },
    },
    required: ["ok", "imageSeen"],
    additionalProperties: false,
  };

  const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGP8//8/AymAiSTVoxpGNQwpDQBVbQMdPVIhQwAAAABJRU5ErkJggg==";

  const response = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Retorne ok=true e imageSeen=true se recebeu a imagem." },
          { type: "input_image", image_url: tinyPng, detail: "auto" },
        ],
      }],
      max_output_tokens: 80,
      text: { format: { type: "json_schema", name: "radar_health", strict: true, schema } },
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    console.warn("Radar AI health error", response.status, body.slice(0, 800));
    return NextResponse.json({ ok: false, stage: "gateway", model, status: response.status, body: body.slice(0, 500) }, { status: 502 });
  }

  let parsed: any = null;
  try {
    const result = JSON.parse(body);
    parsed = JSON.parse(outputText(result));
  } catch {}

  return NextResponse.json({ ok: true, stage: "gateway", model, status: response.status, structured: parsed });
}
