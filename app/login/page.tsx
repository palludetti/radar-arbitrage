import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acesso ao painel",
  robots: { index: false, follow: false, nocache: true },
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/radar";
  const message = params.error === "config"
    ? "O acesso privado ainda não foi configurado."
    : params.error
      ? "Senha incorreta. Tente novamente."
      : "";

  return (
    <main className="login-shell">
      <section className="login-card">
        <Link className="login-brand" href="/"><span>RA</span><strong>Radar Arbitrage</strong></Link>
        <p className="public-eyebrow">ÁREA PRIVADA</p>
        <h1>Acessar o painel</h1>
        <p>Use a senha administrativa para abrir a base operacional.</p>
        {message && <div className="login-error" role="alert">{message}</div>}
        <form action="/api/session" method="post">
          <input type="hidden" name="next" value={next} />
          <label>
            <span>Senha</span>
            <input name="password" type="password" autoComplete="current-password" required minLength={12} autoFocus />
          </label>
          <button className="public-cta primary" type="submit">Entrar no Radar</button>
        </form>
        <Link className="login-back" href="/">← Voltar para a página pública</Link>
      </section>
    </main>
  );
}
