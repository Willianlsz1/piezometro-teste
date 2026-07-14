# Cadeia de Confiança — "Quem garante que o monitoramento é válido?"

Documento direto, no mesmo espírito de `docs/prototipo/PREPARACAO_BANCA.md`. Referências que este documento
não repete: `docs/prototipo/VALIDACAO_SENSOR.md` (precisão do sensor) e `docs/prototipo/PREPARACAO_BANCA.md` (economia,
piezômetro vs. INA, conformidade regulatória, free tier).

---

## §1 Duas perguntas que não podem ser misturadas

- **Integridade** — o dashboard mostra fielmente o que foi medido? É uma pergunta de
  *engenharia de software*: nada se perde, nada se corrompe, nada se disfarça entre o sensor e
  a tela.
- **Validade metrológica** — a medição em si é verdadeira, dentro de uma incerteza conhecida?
  É uma pergunta de *instrumentação/metrologia*: depende de calibração contra uma referência.

Este projeto **constrói e garante a primeira** por arquitetura. A segunda é tratada em escala
reduzida no protocolo de bancada (§3) e depende, para valer em produção real, da cadeia
institucional descrita em §4. Confundir as duas é o erro mais comum nessa discussão — um
sistema pode ser perfeitamente íntegro e ainda assim reportar um número metrologicamente errado,
se o sensor na ponta estiver descalibrado.

---

## §2 Cadeia de confiança implementada (integridade)

| Elo | Proteção | Onde no código |
|---|---|---|
| **Sensor** | Mediana de 5 leituras espaçadas de 30 ms, descartando ecos fora da faixa útil (< 25 cm ou > 450 cm) — mais robusta a ruído/eco espúrio que uma leitura única | `firmware/sketch_fisico_jsn_sr04t.ino:144-170` (`medirDistanciaMedianaCm`) |
| **Sensor** | Leitura sem eco válido é marcada `valida=false` e **não é enviada** ao backend — a falha do sensor não entra disfarçada de dado bom no histórico; o display mantém o último nível conhecido só para não simular "nível zero" | `firmware/sketch_fisico_jsn_sr04t.ino:172-201` (`lerSensor`, comentário linhas 176-185) |
| **Transporte** | Autenticação por `DEVICE_KEY` fail-closed: sem a secret configurada no Worker, `/ingest` responde `503` e nada entra; com a secret configurada, chave incorreta responde `401` | `cloudflare-worker/src/rotas.js:11-23` (`handleIngest`) |
| **Transporte** | TLS de ponta a ponta (Cloudflare Workers só serve HTTPS) | infraestrutura do Worker, não há endpoint HTTP puro |
| **Transporte** | Validação de payload: `nivel_agua` precisa ser número finito (senão a leitura inteira é rejeitada); `piezometro`, quando presente, precisa casar com o formato `PZ-NN` (senão rejeitado, nunca "rebatizado" para um ID genérico — misturaria sensores físicos diferentes no mesmo instrumento lógico) | `cloudflare-worker/src/db.js:15-40` (`normalizarLeitura`) |
| **Transporte** | Clamp de `ts` futuro: relógio do device adiantado não pode projetar uma leitura no futuro (`ts > agora + 300s` é forçado para `agora`) | `cloudflare-worker/src/db.js:58-59` |
| **Armazenamento** | Índice único `(piezometro, ts)` + `INSERT OR IGNORE`: reenvio do buffer *store & forward* do firmware (ex.: confirmação HTTP 204 perdida) não duplica linha | `cloudflare-worker/src/db.js:66-78` (`inserirLeituras`, comentário) |
| **Armazenamento** | Duas dimensões de tempo por linha: `ts` (hora da medição, relógio do device) e `recebido_em` (hora em que o Worker recebeu) — desacopla o dado do relógio do dispositivo | `cloudflare-worker/src/db.js:42-63` (campos `ts`/`recebido_em` em `normalizarLeitura`) |
| **Armazenamento** | A API não expõe nenhum endpoint de edição/exclusão de leituras — o roteador só reconhece `POST /ingest`, `GET /ultimos`, `GET /dados`, `GET /alerts`, `GET /config`, `GET /health`; não há `PUT`/`DELETE`/rota de update em lugar nenhum do backend. Histórico é append-only **na prática** (a garantia formal exigiria também trava de escrita no D1, ver §5) | `cloudflare-worker/src/index.js:42-64` (lista completa de rotas do `fetch`) |
| **Exibição** | Dado velho nunca aparece como "normal": frescor calculado a partir de `recebido_em`; se estourar `staleSeg`, o painel mostra o estado neutro "SEM SINAL" (badge cinza) em vez de continuar exibindo a última faixa de nível conhecida | `assets/js/util.js:41-54` (`estadoComunicacao`); consumido em `assets/js/paineis.js:72-84,222-241,313-314` |
| **Exibição** | Frescor é medido por `recebido_em` (hora do servidor), não por `ts` (relógio do device) — imune à deriva de relógio do device/simulação | `assets/js/util.js:44-53`; mesmo princípio no motor de alertas: `cloudflare-worker/src/alertas.js:150-156` |
| **Exibição** | Dado simulado é sinalizado por um banner visível sempre que a fonte ativa é `FonteSimulada` — nunca se mistura silenciosamente com dado real | `assets/js/fontes.js:83-84,157-162` (`trocarFonte` alterna a classe `sim-banner`) |

Cada linha acima é uma decisão de arquitetura, não um acidente: o padrão comum é **"na dúvida,
não mostrar como bom"** — descartar, marcar como inválido, ou exibir estado neutro, nunca
inventar ou disfarçar um valor.

---

## §3 Validade da medição — o sensor mede o que diz medir?

Integridade garante que o dado exibido é o dado que chegou. Não garante que o dado que chegou
é *correto* — isso é uma pergunta de calibração, respondida confrontando o sensor com uma
referência independente (régua/trena) em alturas conhecidas. O protocolo completo — materiais,
procedimento de 5 alturas × 10 leituras, fórmulas de erro médio/desvio padrão/erro máximo e a
frase de incerteza declarada (±2σ) — está em `docs/prototipo/VALIDACAO_SENSOR.md`; não repetido aqui. O
papel dele nesta cadeia é fechar o elo que a arquitetura de software, sozinha, não consegue
fechar: mostrar que o número na tela também *bate com a realidade física*, dentro de uma faixa
de erro conhecida.

---

## §4 Quem garante no mundo real (fora do escopo do protótipo)

| Elo institucional | Papel |
|---|---|
| **Laboratório de calibração acreditado (RBC/Inmetro)** | Emite o certificado rastreável do instrumento — a "verdade terrestre" oficial que um TCC não pode substituir (ver nota honesta em `docs/prototipo/VALIDACAO_SENSOR.md` §6) |
| **Projetista geotécnico** | Define os limiares de controle por instrumento e por barragem — por isso o sistema **parametriza** `NIVEL_ATENCAO`/`NIVEL_CRITICO` em vez de fixar um valor universal (`CLAUDE.md`, "Limiares espelhados em 3 lugares") |
| **Engenheiro responsável + Plano de Segurança da Barragem** | Decide e documenta a operação com base nos dados — o sistema informa, não decide |
| **ANM (Res. 95/2022) + auditorias** | Fiscaliza o cumprimento regulatório da instrumentação e da resposta a alertas (ver tabela de conformidade em `docs/prototipo/PREPARACAO_BANCA.md` item c) |

**Mensagem central:** o sistema não substitui essa cadeia institucional — ele a **alimenta com
dados melhores** (contínuos, em tempo real, com histórico auditável). O que garantimos **por
construção** é que o dado exibido no dashboard é exatamente o dado medido pelo sensor, sem
perda, duplicação, ou disfarce no caminho. Que o sensor em si seja um instrumento certificado é
responsabilidade da cadeia institucional acima, não do software.

---

## §5 O que falta para auditabilidade formal (admitir antes que perguntem)

- **Calibração rastreável RBC** — o protótipo usa régua/trena como referência (ver
  `docs/prototipo/VALIDACAO_SENSOR.md`), não um padrão acreditado.
- **Assinatura digital das leituras no device** — hoje a autenticação é por `DEVICE_KEY`
  compartilhada (prova "alguém com a chave enviou", não "esta leitura específica não foi
  alterada em trânsito" com garantia criptográfica por mensagem).
- **Log de auditoria de acessos** — quem consultou o `/dados` de qual piezômetro e quando não é
  registrado hoje.
- **Redundância** — nem de energia (ver `docs/prototipo/PREPARACAO_BANCA.md` item c/e, pergunta 4), nem de
  armazenamento fora do D1 gerenciado pela Cloudflare.

Nenhum desses itens muda a arquitetura atual — são todos trabalhos futuros aditivos sobre a
mesma cadeia já implementada.

---

## §6 Frase pronta para a banca

> "Este projeto separa duas garantias que costumam ser confundidas: a integridade do dado — que
> o número exibido no dashboard é exatamente o que o sensor mediu, sem perda, duplicação ou
> disfarce entre o piezômetro e a tela — e a validade metrológica da medição — que esse número
> corresponde à realidade física dentro de uma incerteza conhecida. A primeira garantimos por
> construção, com uma cadeia de proteções que vai da mediana no sensor até a autenticação
> fail-closed no transporte, o índice único e append-only no armazenamento, e o estado neutro
> 'sem sinal' na exibição. A segunda depende de calibração — validamos o sensor da maquete contra
> uma referência de régua em bancada, mas uma validação metrológica de produção exigiria
> instrumento certificado por laboratório acreditado RBC/Inmetro. Por isso este sistema não se
> propõe a substituir a cadeia institucional de segurança de barragens — projetista geotécnico,
> engenheiro responsável e fiscalização da ANM — e sim a alimentá-la com dados contínuos,
> auditáveis e mais baratos do que a medição manual terceirizada."
