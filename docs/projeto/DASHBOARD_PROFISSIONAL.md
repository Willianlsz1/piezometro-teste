# Dashboard Profissional — Como as Grandes Empresas Fazem (e o que adotar)

> Pesquisa sobre plataformas geotécnicas comerciais, salas de controle 24/7 e normas de HMI
> industrial, com o plano de melhorias do nosso dashboard derivado dela. Fontes por seção.

---

## 1. Como funcionam os dashboards das grandes empresas

Plataformas estudadas: **GroundProbe MonitorIQ** (Orica — usada em centros de monitoramento no
Brasil), **Hexagon/Leica GeoMoS Now!**, **Worldsensing CMT/Loadsensing**, **Sisgeo OMNIAlog**,
**Campbell Scientific**, **Vista Data Vision** (Bentley/Geokon). O padrão comum de tela:

1. **Mapa/planta com status por instrumento** ("mimic board") — visão geral onde cada sensor é um
   ponto cujo estado se lê de relance.
2. **Séries temporais com os níveis de controle desenhados** — o limiar do projetista aparece como
   linha fixa no gráfico, nunca escondido por autoescala.
3. **Painel de alarmes ativos** separado do log de eventos.
4. **Relatórios automáticos** agendados por e-mail.
5. **Dashboard da saúde da REDE** (Worldsensing CMT) — monitorar a comunicação é tão importante
   quanto monitorar o processo.

Rotina humana (CMI Samarco ~1.500 instrumentos; CMG Vale 92 barragens; GroundProbe GSS com centro
em BH operando 120+ sites em 18 países): equipe geotécnica 24/7 interpretando dados + inspeções de
campo + resposta a alarmes com contato telefônico com o site. O sistema não decide — ele **aciona
gente certa, rápido**.

Fontes: [MonitorIQ](https://www.groundprobe.com/product/monitoriq-desktop/) ·
[GeoMoS Now!](https://leica-geosystems.com/services-and-support/workflow-services/leica-geomos-now) ·
[Worldsensing CMT Cloud](https://www.worldsensing.com/product/cmt-cloud/) ·
[Vista Data Vision](http://www.vistadatavision.com/dam_monitoring/) ·
[CMI Samarco — IBRAM](https://ibram.org.br/noticia/saiba-mais-sobre-o-centro-de-monitoramento-e-inspecao-cmi-da-samarco/) ·
[GroundProbe GSS](https://www.groundprobe.com/product/geotechnical-specialist-services/)

## 2. O que acontece quando o sinal do piezômetro some

Este é o ponto mais importante da pesquisa. O padrão profissional (SCADA/OPC, replicado nas
plataformas geotécnicas):

- **Perda de comunicação é um ALARME PRÓPRIO**, distinto do alarme de processo. Sistemas de
  barragens alertam "quando limiares são excedidos **ou quando sensores se desconectam do
  gateway**" ([artigo TSF](https://papers.acg.uwa.edu.au/d/1604_47_Abanco/47_Abanco.pdf)).
- **Qualidade do dado em 3 estados (padrão OPC): Good / Uncertain / Bad.** Cada leitura carrega
  timestamp; se nada chega dentro de uma janela configurável, o dado vira **stale**
  automaticamente ([Ignition quality codes](https://www.docs.inductiveautomation.com/docs/8.1/platform/tags/quality-codes-and-overlays)).
- **Visual:** estado "sem sinal" é **CINZA/hachurado — nunca vermelho** (não é alarme de processo)
  **e nunca a aparência de "normal"** (o modo de falha mais perigoso de um dashboard de segurança
  é dado ausente parecendo tudo bem). Com "última leitura há X min" sempre visível.
- **Gráfico:** gap visível na linha — **nunca interpolar silenciosamente** ([Datawrapper](https://academy.datawrapper.de/article/321-patchy-data), [Bocoup](https://www.bocoup.com/blog/showing-missing-data-in-line-charts)).
- **Decisão:** dado suspeito/ausente **bloqueia** a avaliação do alarme de processo daquele
  instrumento — não conta como "ok" ([BVP Engenharia](https://bvp.eng.br/monitoramento-geotecnico/)).

## 3. Outros estados de instrumento que os profissionais distinguem

| Estado | O que indica | Visual típico |
|---|---|---|
| **Online/Normal** | leituras chegando, dentro da faixa | neutro (cinza) — sem cor |
| **Stale/atrasado** | última leitura além da janela esperada | cinza + "há X min" |
| **Sem comunicação** | silêncio prolongado → alarme de comunicação | cinza hachurado + notificação |
| **Leitura suspeita** (Uncertain) | valor fisicamente implausível, spike, flatline (leitura congelada) | opacidade reduzida/ícone |
| **Em manutenção** | intervenção programada — suprime alarmes na janela | ícone próprio; supressão sempre visível (ISA-18.2 shelving) |
| **Drift** | deriva de zero (corda vibrante) → recalibrar | evento, não alarme |
| **Bateria baixa** | telemetria de saúde do dispositivo | aviso de baixa prioridade |

Dado de campo: ~1% dos sensores transmitem dados errôneos (corrosão, fiação) — falha de sensor
tanto gera falso alarme quanto mascara anomalia real ([Ebro/Academia](https://www.academia.edu/41004686/Dam_monitoring_flaws_and_performance_issues_Some_thoughts_and_recommendations)).

## 4. Quais leituras/derivadas os profissionais acompanham

1. **Taxa de variação** — referência da literatura de dam safety: piezômetro subindo
   **> 0,1 m/dia** já é gatilho de investigação (Nível 1), mesmo dentro da faixa "normal"
   ([ASDSO](https://damsafety.org/content/critical-piezometric-levels-dam-safety-monitoring), [ThingsLog](https://thingslog.com/blog/2026/05/17/dam-monitoring-system-iot-guide)).
2. **% do valor de projeto** (ex.: 80% da poropressão máxima admissível = Nível 2).
3. **Correlação com chuva** — pluviômetro como sinal antecedente (a chuva de hoje é a poropressão
   de amanhã) e com **nível do reservatório** (carga aplicada).
4. **Desvio da tendência de longo prazo** daquele instrumento específico.
5. **Consistência espacial** — instrumentos vizinhos da mesma seção devem contar a mesma história.

## 5. Normas de HMI: o que adotar e o que EVITAR

**ISA-101 (High Performance HMI):** ~90% da tela em tons neutros; equipamento normal é **cinza,
não verde** — cor significa "olhe aqui agora". Estudos: até 48% mais detecção de anormalidade
antes do alarme ([control.com](https://control.com/technical-articles/going-gray/),
[Hollifield — High Performance HMI Handbook](https://www.idc-online.com/technical_references/pdfs/electronic_engineering/The_high_performance.pdf)).
Hierarquia: visão geral → área → detalhe (= "overview first, zoom and filter, details on demand",
[Shneiderman](https://infovis-wiki.net/wiki/Visual_Information-Seeking_Mantra)). Valores sempre
**em contexto** (faixa normal desenhada, sparkline de tendência) — "dado não é informação".

**ISA-18.2 / EEMUA 191 (gestão de alarmes):**
- Máximo **~1 alarme/10 min** por operador em regime normal; alarme repicando (chattering, ≥3
  disparos/min) deve ser eliminado com **histerese/deadband e temporização**.
- No máximo **3 prioridades**, distribuição alvo ~5% alta / 15% média / 80% baixa.
- **Todo alarme exige uma ação definida** — o que não exige ação é evento/notificação e vai para
  outra lista. Misturar os dois é a causa nº 1 de fadiga de alarme.
- Supressão sempre visível (shelving) — alarme nunca some silenciosamente.
([ProcessVue](https://www.processvue.com/resources/alarm-management-guidelines/),
[ISA-18.2](https://www.isa.org/getmedia/55b4210e-6cb2-4de4-89f8-2b5b6b46d954/PAS-Understanding-ISA-18-2.pdf),
[EEMUA 191](https://www.eemua.org/getattachment/9d3f8071-55c3-49bf-a74a-3bf6ad4a2e0f/Contents-EEMUA-Publication-191-Edition4-November-2024.pdf))

**Anti-padrões a evitar:**
- Verde decorativo em tudo ("árvore de Natal") — cor perde o significado.
- Gauges 3D/velocímetros — espaço enorme para um número; sparkline faz melhor em 10% do espaço.
- Autoescala do eixo Y sem os limiares fixos desenhados — esconde tendência e dramatiza ruído.
- **Média que mascara pico** — em segurança, o pico importa, não a média do bucket; agregações
  devem carregar o máximo do intervalo junto com a média.
- Cor como único codificador de status (daltonismo ~8% dos homens) — sempre cor + texto/ícone.
- Dado ausente com aparência de normal (ver §2).
([insightsoftware](https://insightsoftware.com/blog/the-dos-and-donts-of-dashboard-design/),
[UXPin](https://www.uxpin.com/studio/blog/dashboard-design-principles/))

---

## 6. Plano de melhorias do NOSSO dashboard (priorizado)

| # | Melhoria | O que muda | Camada |
|---|---|---|---|
| **P1** | **Estado "SEM SINAL" por instrumento** | Card fica cinza-hachurado com "última leitura há X min" quando o silêncio passa da janela (ex.: 60 s no protótipo); gap visível no gráfico; leitura ausente NUNCA aparece como normal | dashboard (o `/ultimos` já retorna `ts`) |
| **P2** | **Alarme de comunicação no motor de alertas** | Telegram/SMS "⚠️ PZ-02 sem dados há 15 min" — camada separada do alarme de nível; instrumento mudo não conta como NORMAL | worker (cron) |
| **P3** | **Taxa de variação (m/dia)** | Derivada exibida por instrumento + gatilho de investigação (> 0,1 m/dia = referência ASDSO), mesmo dentro da faixa normal | worker + dashboard |
| **P4** | **Separar ALARMES de EVENTOS** | Duas listas: alarmes (exigem ação, com a ação escrita) e eventos informativos; histerese nos limiares (ex.: ±0,2 m) para não repicar na borda | dashboard + worker |
| **P5** | **Pico junto da média** | `/dados` agrega por média e **máximo**; gráfico mostra a média com o pico do bucket — média não pode mascarar excursão acima do limiar | worker + dashboard |
| **P6** | **Sobriedade ISA-101** | Reduzir cor decorativa: cards normais neutros (sem verde vivo), cor reservada a atenção/crítico/sem-sinal; status sempre cor + texto (daltonismo) | dashboard |
| P7 | Telemetria de saúde (bateria/RSSI) | Firmware envia tensão/sinal; aviso de bateria baixa | firmware + worker |
| P8 | Correlação com chuva | Pluviômetro (real ou API de previsão) como sinal antecedente | fase 2 |

**P1+P2 são o coração** — fecham a lacuna "instrumento mudo = ninguém sabe", que é literalmente a
diferença entre o nosso protótipo e um sistema de segurança de verdade, e têm base direta nas
fontes (§2). P3 responde à frase da demanda "identificar variações rápidas ou anormais".
