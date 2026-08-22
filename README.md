# Radar Arbitrage

Radar de Arbitragem de Oportunidades.

## Estrutura inicial

- `data/radar_arbitrage_import_2026-08-14.json` — lote mais recente de oportunidades analisadas, incluindo anúncios e alvos de leilão.

## Convenções

Cada oportunidade pode conter:

- `id`
- `category`
- `brand`
- `model`
- `sourcePlatform`
- `seller`
- `askingPrice`
- `fees`
- `shipping`, `purchaseFees`, `maintenanceReserve`, `partsReserve`, `safetyMargin`
- `sellingCosts`
- `maxPurchase`
- `quickResale`
- `likelyResale`
- `liquidity`
- `condition`
- `originality`
- `completeness`
- `iao`
- `iam`
- `ice`
- `authGate`
- `capitalGate`
- `conditionGate`
- `verdict`
- `status`
- `notes`
- `url` quando houver link direto validado

## Regra operacional

O Radar prioriza margem real, liquidez, autenticidade, condição e custo total. Preço anunciado ou desconto sobre MSRP não é tratado como oportunidade por si só.

O custo total soma preço, frete, taxas de compra, manutenção provável, peças/bateria e margem de segurança. O lucro líquido também desconta os custos estimados da venda. Os gates de autenticidade, capital e condição podem impedir `COMPRAR` independentemente do Radar Score.

## Deploy

O projeto está conectado à Vercel. Cada push na branch `main` dispara automaticamente um novo deploy de produção.

## Acesso privado

- A landing pública vive em `/`.
- O painel operacional vive em `/radar` e exige uma sessão assinada.
- Configure `RADAR_ADMIN_PASSWORD` (mínimo de 12 caracteres) e `RADAR_SESSION_SECRET` (mínimo de 32 caracteres) na Vercel para Preview e Production.
- O seed operacional é carregado apenas no servidor e não é incluído nos chunks JavaScript públicos.

## Verificação

- `npm test` valida os gates de decisão sem depender do mercado ao vivo.
- `npm run build` executa a verificação completa do Next.js e TypeScript.
- O workflow manual `Smoke test compare API` repete a pesquisa real e exige resposta em menos de 80 segundos, no máximo cinco fontes e evidência reforçada para qualquer veredito `COMPRAR`.

## Proteção das APIs

As rotas de análise exigem a mesma sessão administrativa do painel, aceitam somente a origem do próprio site em produção e aplicam um limite por minuto de melhor esforço. Para exigir um token privado adicional, configure `RADAR_API_ACCESS_TOKEN` na Vercel; a interface solicitará o token e o manterá apenas na sessão do navegador. `RADAR_ALLOWED_ORIGIN`, `RADAR_ANALYZE_RATE_LIMIT` e `RADAR_COMPARE_RATE_LIMIT` permitem ajustar a política sem alterar o código.
