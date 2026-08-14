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
- `verdict`
- `status`
- `notes`
- `url` quando houver link direto validado

## Regra operacional

O Radar prioriza margem real, liquidez, autenticidade, condição e custo total. Preço anunciado ou desconto sobre MSRP não é tratado como oportunidade por si só.

## Deploy

O projeto está conectado à Vercel. Cada push na branch `main` dispara automaticamente um novo deploy de produção.
