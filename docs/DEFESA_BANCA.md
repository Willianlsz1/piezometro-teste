# Defesa na Banca — Posicionamento frente aos Equipamentos Profissionais

> Roteiro de postura e respostas para o quesito "isso não é brinquedo perto de um sistema
> profissional?". Fontes e números: [BASE_DE_CONHECIMENTO.md](BASE_DE_CONHECIMENTO.md) e
> [DASHBOARD_PROFISSIONAL.md](DASHBOARD_PROFISSIONAL.md).

## A postura em uma frase

**Não competimos com o equipamento profissional — atacamos a camada que ele não atende.**
O protótipo não é uma corda vibrante barata; é a demonstração de que a *arquitetura* de um centro
de monitoramento (aquisição → nuvem → dashboard → alerta ativo em dupla via) cabe em poucas
centenas de reais, para os milhares de estruturas que hoje são lidas à mão porque o padrão
industrial não cabe no orçamento delas.

## As três camadas do argumento

1. **Regulatória** — a Resolução ANM 95/2022 só OBRIGA monitoramento automatizado em tempo real
   para barragens de **DPA alto**. O Brasil tem ~28.000 barragens cadastradas e só ~6.200 dentro
   da PNSB; todo o resto (açudes, diques, pequenas barragens de terra, aterros, encostas) segue
   com leitura manual. A Samarco tem o CMI; **o açude do DNOCS não tem nada**.
2. **Econômica** — o ponto instrumentado profissional (corda vibrante + datalogger + telemetria)
   custa dezenas de milhares de reais e tem preço "sob consulta" em todos os fornecedores
   pesquisados (3Geo, Santiago e Cintra, G5, Geothra...). A própria ANA reconhece em manual
   oficial que pequenas barragens "não geradoras de receita" não conseguem pagar automação.
   Nosso ponto: **poucas centenas de reais, com preço público, e custo de operação zero**.
3. **Conceitual** — a lição de Brumadinho não foi falta de instrumento (havia piezômetros); foi
   dado que não virou **ação a tempo**. O que o protótipo demonstra de ponta a ponta é exatamente
   a parte que falhou: leitura contínua → alerta automático → notificação chegando no bolso de
   alguém, com tratamento de silêncio de instrumento e taxa de variação. Esse fluxo é o mesmo em
   qualquer escala de hardware.

## Frases prontas (tom: técnico, sem arrogância e sem apequenamento)

- "O senhor tem razão: este sensor não substitui uma corda vibrante — e o projeto não propõe
  isso. Ele demonstra a arquitetura de monitoramento; o sensor é intercambiável por projeto."
- "A pergunta que o projeto responde não é 'como a Samarco monitora Germano?' — é 'por que as
  outras 20 mil barragens do país ainda são lidas à mão, e o que custaria mudar isso?'."
- "Cada peça da maquete tem um equivalente industrial de papel idêntico: o ESP32 faz o papel do
  datalogger com telemetria; os LEDs e o buzzer, o da sinalização local; o OLED, o do display de
  campo. A diferença é de robustez e certificação — não de conceito."
- "Nós seguimos os mesmos padrões das salas de controle profissionais onde eles são de graça:
  ISA-101 no dashboard, gestão de alarmes ISA-18.2 com histerese, dado ausente nunca tratado
  como normal. Norma não custa hardware."

## Perguntas prováveis e respostas

| Pergunta da banca | Resposta |
|---|---|
| "Isso já existe no mercado." | "Existe para DPA alto, a preço sob consulta. Para a camada de baixo — 28 mil barragens, ~700 aterros, encostas urbanas — não existe oferta viável; é o vácuo que o projeto ocupa." |
| "Esse sensor ultrassônico não é um piezômetro." | "Correto — ele mede nível como um INA, não poropressão. Usamos como stand-in porque o firmware isola o sensor num adapter (`lerSensor()`): a Fase 2 troca por um transdutor de pressão submersível 4–20 mA, que mede o mesmo fenômeno do piezômetro real, sem tocar no resto do sistema." |
| "E a precisão/confiabilidade?" | "Para o protótipo, ±1–2 cm na coluna — suficiente para demonstrar a lógica de faixas. Em campo, a precisão vem do sensor escolhido na instalação; a arquitetura não muda. E confiabilidade de *sistema* nós tratamos: store & forward para queda de rede, alarme de silêncio de instrumento, histerese anti-repique." |
| "A norma exige redundância de energia e comunicação. Vocês têm?" | "Não — e está declarado como limitação. A exigência vale para DPA alto, que não é o público-alvo. O caminho está mapeado: bateria + solar e um módulo celular como segunda via." |
| "Quanto custaria de verdade instalar isso numa barragem?" | "O ponto de monitoramento fica na casa de centenas de reais + o sensor adequado ao furo (o transdutor 4–20 mA custa na faixa de poucas centenas a poucos milhares — ainda uma ordem de grandeza abaixo do pacote comercial). A operação é custo zero: toda a nuvem roda em free tier, e isso está medido no projeto." |
| "Por que devo confiar num alerta que roda de graça na nuvem?" | "O free tier é decisão de protótipo, não de produto — e mesmo assim escolhemos a plataforma que não hiberna (migramos do Render por exatamente esse risco) e projetamos o firmware para alertar localmente (LED/buzzer) mesmo com a nuvem fora." |
| "O que falta para isso virar produto?" | "Sensor certificado, invólucro IP67, redundância de energia/comunicação, calibração assistida por responsável técnico e conformidade formal com os níveis de controle do projetista. A arquitetura de software já está no lugar — é a parte que normalmente custa mais para acertar." |

## A regra de ouro

**Nomear as limitações antes que a banca as descubra.** Sensor stand-in, sem redundância de
energia, sem certificação, escala didática do tubo — tudo isso dito com naturalidade no slide de
limitações transforma cada possível "pegadinha" em evidência de maturidade. A banca não derruba
quem conhece a fronteira do próprio trabalho; derruba quem finge que ela não existe.
