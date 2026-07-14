# Plano de Refatoração — Fim dos Godfiles

> Objetivo: nenhum arquivo com mais de uma responsabilidade; todos pequenos (~alvo ≤ 300 linhas),
> com nome que diz o que contêm, fáceis de ler pela banca e de navegar por qualquer ferramenta.
> Regra de ouro: **cada passo migra código SEM mudar comportamento**, e termina com deploy/teste
> verde e um commit — nunca um "big bang".

## Diagnóstico

| Arquivo | Linhas hoje | Responsabilidades misturadas |
|---|---|---|
| `index.html` | **1.845** | Estrutura HTML + todo o CSS + toda a aplicação JS (config, fontes de dados, estado, 2 renderizadores de gráfico, painéis, tabelas, export, polling, boot) |
| `cloudflare-worker/src/index.js` | **630** | Config + helpers HTTP + queries D1 + motor de alertas (3 camadas) + notificações Telegram/Twilio + 7 rotas + roteador |
| `firmware/` | ✅ ok | Já refatorado (core 424 l. + 2 adapters de sensor) — nada a fazer |

## Restrições (não negociáveis)

1. **Zero build step.** GitHub Pages serve arquivos estáticos como estão; o dashboard não pode
   depender de bundler. → JS dividido em arquivos carregados por `<script src>` em ordem de
   dependência (escopo global compartilhado, como hoje — menor diff possível).
   *(O Wrangler, ao contrário, já embute esbuild: o Worker pode usar `import`/`export` ES modules
   nativamente, sem nenhuma configuração nova.)*
2. **Comportamento idêntico.** Nenhuma lógica muda neste plano — só endereço de código.
3. **Cada commit deployável e testado** (checklist no fim).

## Layout final

### Dashboard (1.845 → ~9 arquivos de 80–300 linhas)

```
piezometro-teste/
├── index.html              ~250 l. — SÓ estrutura HTML + <link>/<script src> em ordem
└── assets/
    ├── styles.css          todo o CSS (dark theme, cards, tabelas, estados sem-sinal)
    └── js/                 carregados nesta ordem (dependência):
        ├── config.js       API_URL, CFG, PIEZOMETROS, PERIODOS, loadConfig()
        ├── util.js         funções PURAS: clamp, classifyNivel, classifyComHisterese,
        │                   corPorStatus, estadoComunicacao, formatUltimaLeitura
        ├── fontes.js       o seam de dados: apiGet, FonteApi, FonteSimulada, trocarFonte
        ├── estado.js       charts/sparks/statsWin/pzLatest/alarmes/eventos +
        │                   pushStats/pushChart/pushReading/pushHistorico
        ├── graficos.js     drawSparkline, renderMainChart, redrawCharts (só canvas)
        ├── paineis.js      cards da visão geral, mapa Leaflet, setAlert/setAlertSemSinal,
        │                   renderTaxa, tabelas de leituras/alarmes/eventos, stats/labels
        ├── exportar.js     exportCSV
        └── app.js          orquestração: poll, loadHistoryAndStats, applyData,
                            selectPiezometro/selectPeriodo, relógio, IIFE de boot
```

### Worker (630 → ~7 módulos ES)

```
cloudflare-worker/src/
├── index.js          ~70 l. — export default { fetch, scheduled } + roteador de paths
├── config.js         getConfig, RANGES, PIEZOMETRO_ID_RE, limites de payload
├── http.js           corsHeaders, json(), readBodyLimited, timeoutSignal
├── db.js             TODAS as queries D1: inserirLeituras, ultimosNiveis,
│                     ultimasLeiturasTodas, leituraBaseline, dadosAgregados
├── alertas.js        classify, classifyComHisterese, calcularTaxaMDia,
│                     lerEstado/salvarEstado (KV), checkAlerts (3 camadas)
├── notificacoes.js   sendTelegram, sendSMS, notificar/notificarComunicacao/notificarTaxa
└── rotas.js          handleIngest/Ultimos/Dados/Alerts/Config/Health
```

## Sequência de migração (7 passos, 1 commit cada)

**Fase A — dashboard (risco baixo, sem deploy externo):**
1. **CSS → `assets/styles.css`**: recortar o `<style>` inteiro, `<link rel="stylesheet">` no lugar.
   Teste: abrir no navegador, visual idêntico, console limpo.
2. **JS puro e config → `config.js` + `util.js` + `fontes.js`**: recortar as seções (o arquivo já
   está organizado por bandeiras de comentário — os cortes seguem essas fronteiras). `<script src>`
   antes do restante do script inline. Teste: dashboard conecta, simulação ainda assume ao derrubar
   a rede (DevTools offline).
3. **Estado e renders → `estado.js` + `graficos.js` + `paineis.js` + `exportar.js`**. Teste:
   gráficos com média+máx, export CSV, SEM SINAL nos cards.
4. **Resto → `app.js`; `index.html` fica só com HTML**. Teste completo (checklist abaixo).

**Fase B — worker (cada passo com `wrangler deploy` + curls):**
5. **`http.js` + `notificacoes.js` + `config.js`** extraídos com `import`/`export`; `index.js`
   importa. Deploy → `/health` ok.
6. **`db.js` + `alertas.js`**. Deploy → `/ultimos`, `/dados`, `/alerts` ok; cron testado com
   `wrangler dev --test-scheduled`.
7. **`rotas.js` + `index.js` enxuto (só roteador)**. Deploy → checklist completo.

**Fase C — documentação (mesmo PR do passo 7):** atualizar a "Estrutura do Projeto" no
`readme.md`, o `CLAUDE.md` e o `cloudflare-worker/README.md`.

## Checklist de validação (após os passos 4 e 7)

```bash
curl <worker>/health          # status ok, db D1
curl <worker>/config          # limiares + ranges + piezometros + stale/taxa/histerese
curl -X POST <worker>/ingest  # 204 (com x-device-key)
curl <worker>/ultimos         # inclui ts e taxa_m_dia
curl "<worker>/dados?pz=PZ-01&range=24h"   # inclui nivel_max
curl <worker>/alerts          # comunicacao/taxas presentes
```
No navegador: API conectada; card SEM SINAL com "última leitura há X"; gráfico com linha
tracejada do máx; alarmes e eventos em listas separadas; export CSV com coluna de máx;
console sem erros; modo simulação assumindo com a rede desligada e voltando sozinho.

## Guardas anti-godfile (valem daqui em diante)

- **≤ ~300 linhas por arquivo** (exceção justificada: `paineis.js` pode chegar a ~400 por agrupar
  os renders de DOM — se passar disso, dividir por painel).
- **1 responsabilidade por arquivo**, e o nome do arquivo é a responsabilidade.
- Função nova entra no arquivo cujo nome a descreve — se não existe, o arquivo novo nasce pequeno.
- Registrar no `CLAUDE.md` que PRs que engordem um arquivo acima do limite devem dividir antes.

## O que este plano NÃO faz (de propósito)

- Não muda lógica, contratos de API nem visual — refatoração de endereço, não de comportamento.
- Não introduz bundler/framework no dashboard (restrição do GitHub Pages + legibilidade p/ banca).
- Não converte o dashboard para ES modules (ganho pequeno frente ao risco; pode ser fase futura).
- Não toca no firmware (já modularizado) nem no schema do banco.
