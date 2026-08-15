import Link from "next/link";

const defaultContact = "https://wa.me/5519993296666?text=Quero%20entrar%20no%20Founding%20Beta%20do%20Radar%20Arbitrage";

export default function PublicHome() {
  const betaContact = process.env.RADAR_BETA_CONTACT_URL || defaultContact;

  return (
    <main className="public-site">
      <nav className="public-nav" aria-label="Navegação principal">
        <Link className="public-brand" href="/">
          <span className="public-brand-mark">RA</span>
          <span><strong>Radar Arbitrage</strong><small>Decisão antes da compra</small></span>
        </Link>
        <div className="public-nav-links">
          <a href="#como-funciona">Como funciona</a>
          <a href="#founding-beta">Founding Beta</a>
          <Link className="public-login-link" href="/login">Acessar painel</Link>
        </div>
      </nav>

      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="public-eyebrow">FOUNDING BETA · 10 VAGAS</p>
          <h1>Antes de comprar, saiba onde existe margem.</h1>
          <p className="public-lead">
            Envie o anúncio. O Radar cruza preço, liquidez, risco e potencial de revenda
            para transformar impulso em uma decisão objetiva.
          </p>
          <div className="public-cta-row">
            <a className="public-cta primary" href={betaContact} target="_blank" rel="noopener noreferrer">
              Quero entrar no Founding Beta
            </a>
            <a className="public-cta secondary" href="#como-funciona">Ver como funciona</a>
          </div>
          <div className="public-proof" aria-label="Características do serviço">
            <span>Resposta direta</span><span>Score próprio</span><span>Foco em margem real</span>
          </div>
        </div>
        <aside className="public-radar-card" aria-label="Exemplo de decisão do Radar">
          <div className="public-card-top"><span>RADAR SCORE</span><strong>87.9</strong></div>
          <div className="public-verdict">FOGUINHO</div>
          <dl>
            <div><dt>Custo total</dt><dd>R$ 265</dd></div>
            <div><dt>Revenda provável</dt><dd>R$ 600</dd></div>
            <div><dt>Margem bruta</dt><dd className="positive">+ R$ 335</dd></div>
          </dl>
          <p>Exemplo ilustrativo. Toda compra exige validação do anúncio e do vendedor.</p>
        </aside>
      </section>

      <section className="public-problem">
        <p className="public-eyebrow">O PROBLEMA</p>
        <h2>Desconto não é arbitragem.</h2>
        <p>
          Um anúncio barato pode esconder baixa liquidez, custo de revisão, peça não original
          ou uma revenda que só existe no preço anunciado. O Radar organiza essas variáveis
          antes de você colocar dinheiro na mesa.
        </p>
      </section>

      <section className="public-how" id="como-funciona">
        <div className="public-section-heading">
          <p className="public-eyebrow">COMO FUNCIONA</p>
          <h2>Do link à decisão em quatro passos.</h2>
        </div>
        <ol className="public-steps">
          <li><span>01</span><strong>Você envia</strong><p>Link, fotos, preço pedido e contexto do anúncio.</p></li>
          <li><span>02</span><strong>O Radar analisa</strong><p>Mercado, margem, liquidez, condição e confiança do vendedor.</p></li>
          <li><span>03</span><strong>Você recebe</strong><p>Compra máxima, revenda provável, riscos e um veredito claro.</p></li>
          <li><span>04</span><strong>Você decide</strong><p>Comprar, negociar, aprofundar ou passar — com critério.</p></li>
        </ol>
      </section>

      <section className="public-offer" id="founding-beta">
        <div className="public-offer-copy">
          <p className="public-eyebrow">FOUNDING BETA</p>
          <h2>Entre cedo. Ajude a calibrar o Radar.</h2>
          <p>
            O beta é assistido: você envia oportunidades reais, recebe a análise e nos conta
            o que faltou para decidir. Sem assinatura e sem compromisso automático.
          </p>
          <ul>
            <li>Análises estruturadas com score e veredito</li>
            <li>Faixa de compra máxima e revenda provável</li>
            <li>Riscos e evidências que precisam ser confirmados</li>
            <li>Canal direto para feedback durante o beta</li>
          </ul>
        </div>
        <div className="public-price-card">
          <span className="public-capacity">10 vagas iniciais</span>
          <p>Pacote Founding</p>
          <div className="public-price"><small>R$</small><strong>79</strong></div>
          <span>15 análises assistidas</span>
          <a className="public-cta primary" href={betaContact} target="_blank" rel="noopener noreferrer">
            Reservar minha vaga
          </a>
          <small>Quer testar primeiro? 3 análises por R$ 29.</small>
        </div>
      </section>

      <section className="public-faq">
        <div><p className="public-eyebrow">ANTES DE ENTRAR</p><h2>Transparência de beta.</h2></div>
        <div className="public-faq-list">
          <details><summary>O Radar garante lucro?</summary><p>Não. Ele reduz incerteza e organiza evidências; preço, autenticidade, execução e venda continuam sendo responsabilidade de quem compra.</p></details>
          <details><summary>Quais categorias entram?</summary><p>Começamos por relógios e avaliamos outros itens quando há referências de mercado suficientes.</p></details>
          <details><summary>Já existe assinatura?</summary><p>Não. Este é um pacote fechado do Founding Beta, sem renovação automática.</p></details>
        </div>
      </section>

      <footer className="public-footer">
        <div><strong>Radar Arbitrage</strong><span>Menos impulso. Mais margem.</span></div>
        <p>As análises são estimativas e não constituem garantia de retorno financeiro.</p>
      </footer>
    </main>
  );
}
