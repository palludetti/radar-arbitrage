import { NextResponse } from "next/server";

export const runtime = "nodejs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const plans = {
  teste: "Teste — 3 análises por R$ 29",
  founding: "Pacote Founding — 15 análises por R$ 79",
} as const;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function json(message: string, status = 200) {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json("Formato de envio inválido.", 415);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json("Dados inválidos.", 400);
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const plan = typeof payload.plan === "string" ? payload.plan : "";
  const company = typeof payload.company === "string" ? payload.company.trim() : "";

  // A hidden field catches basic bots without adding friction for real visitors.
  if (company) return json("Cadastro recebido.");

  if (name.length < 2 || name.length > 80) {
    return json("Informe um nome válido.", 400);
  }

  if (email.length > 160 || !emailPattern.test(email)) {
    return json("Informe um e-mail válido.", 400);
  }

  if (!(plan in plans)) {
    return json("Selecione uma opção válida.", 400);
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not configured");
    return json("O cadastro está temporariamente indisponível. Tente novamente em instantes.", 503);
  }

  const destination = process.env.BETA_SIGNUP_TO_EMAIL || "palludetti@yahoo.com.br";
  const selectedPlan = plans[plan as keyof typeof plans];
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePlan = escapeHtml(selectedPlan);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Radar Arbitrage <onboarding@resend.dev>",
      to: [destination],
      reply_to: email,
      subject: `Novo cadastro no Founding Beta — ${name}`,
      html: `
        <h1>Novo cadastro no Founding Beta</h1>
        <p><strong>Nome:</strong> ${safeName}</p>
        <p><strong>E-mail:</strong> ${safeEmail}</p>
        <p><strong>Interesse:</strong> ${safePlan}</p>
        <p>Responda a este e-mail para falar diretamente com a pessoa cadastrada.</p>
      `,
    }),
  });

  if (!response.ok) {
    console.error("Resend request failed", response.status, await response.text());
    return json("Não foi possível concluir o cadastro agora. Tente novamente.", 502);
  }

  return json("Cadastro recebido.");
}
