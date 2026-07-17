# Alerta à População — demonstração coletiva na banca

## O que é

`alerta.html` é uma página standalone (fora do dashboard) que qualquer pessoa da
plateia abre no próprio celular, via QR code, durante a apresentação. Ela simula
o alerta que a Defesa Civil dispararia na **Zona de Autossalvamento (ZAS)** —
termo real da legislação de barragens — se o nível de água da maquete cruzasse o
limiar crítico. Quando isso acontece, todos os celulares ativados tocam sirene,
vibram (Android) e piscam vermelho ao mesmo tempo: o TCC vira uma experiência
coletiva no auditório, não só um gráfico na tela.

**Salvaguarda:** a página tem um banner preto fixo no topo, em qualquer estado —
"⚠️ DEMONSTRAÇÃO ACADÊMICA — SENAI/Samarco · Nenhum alerta real" — para que
ninguém confunda a simulação com um alerta de verdade.

## Arquitetura

```
Celular da plateia → GET /ultimos (a cada 5s) ──┐
                                                  ├─→ Cloudflare Worker (mesmo da maquete)
Celular da plateia → GET /config (1x, no boot)  ─┘
```

A página consome exatamente a mesma API do dashboard principal
(`https://piezometro-worker.willianloopes123.workers.dev`) e os mesmos limiares
(`/config` → `CFG.thrAtencao`/`thrCritico`, com fallback hard-coded 12 m/15 m se
o endpoint falhar — ver `assets/js/config.js`). Não existe um "modo apresentador"
separado: cada celular decide seu próprio estado (normal/atenção/crítico) lendo
o mesmo `/ultimos` que a maquete alimenta, então todos reagem no mesmo instante,
sem um servidor central de "broadcast" — o sincronismo vem de todos apontarem
para a mesma fonte de dados e fazerem poll no mesmo ritmo (5 s).

Publicada no GitHub Pages junto do resto do repo:
**https://willianlsz1.github.io/piezometro-teste/alerta.html**

## Roteiro da demonstração no auditório

1. **Slide com o QR code** (imagem em `docs/prototipo/qrcode_alerta.png`,
   gerada à parte — não é criada por este documento) apontando para a URL acima.
   O apresentador pede para a plateia escanear e abrir no celular.
2. Cada pessoa toca **"🔔 ATIVAR ALERTA"** — esse toque é obrigatório para
   desbloquear o áudio do navegador (autoplay policy), pedir localização (para
   o bloco da ZAS) e o wake lock (tela ligada). A tela mostra "🟢 Monitoramento
   ativo" com o nível atual.
3. O apresentador segue a demo física normalmente: sobe o nível de água na
   maquete (ou o "sensor" de bancada) até passar de 12 m — cada celular vira
   âmbar com um bipe curto ("🟡 NÍVEL EM ATENÇÃO").
4. Ao passar de 15 m, **todos os celulares ativados disparam juntos**: tela
   vermelha pulsando, sirene em loop, vibração em loop e a mensagem de alerta
   extremo com a distância até a barragem (fictícia, calculada a partir da
   localização de cada pessoa — ver `assets/js/alerta.js`).
5. O apresentador comenta o efeito (ou deixa tocar uns segundos) e então baixa
   o nível de volta abaixo de 12 m — cada celular mostra "✅ Situação
   normalizada" por alguns segundos e volta ao painel verde.

## Avisos práticos importantes

1. **Combinar com os professores antes** e avisar a plateia, no início, que vai
   haver som alto de sirene simulada — é parte da demonstração, não um defeito.
2. **Pedir para tirar o celular do modo silencioso.** iPhone com a chavinha no
   silencioso **não** toca som de página web — o efeito sonoro simplesmente não
   sai, mesmo com o volume no máximo.
3. **Vibração só funciona no Android.** iOS/Safari não expõe
   `navigator.vibrate` — a página degrada em silêncio (sem erro, sem travar),
   mas o efeito tátil não acontece em iPhone. O vermelho pulsando na tela
   funciona em todos os aparelhos, então o efeito visual coletivo continua.
4. **A tela precisa ficar ligada e a aba aberta** durante toda a demonstração —
   o wake lock ajuda a evitar que o celular apague a tela sozinho, mas nem todo
   navegador suporta (degrada em silêncio nesse caso também).
5. **Testar antes, no próprio celular**, de preferência no mesmo Wi-Fi/rede que
   será usada na banca — inclusive o fluxo de permissão de localização, que
   alguns navegadores só perguntam uma vez por site.

## Modo de coordenadas da ZAS

Por padrão (sem `?demo=0` na URL do QR code), a "barragem" é posicionada a um
deslocamento fixo (~0,02° ao norte, ≈2,2 km) da localização de quem ativou o
alerta — assim qualquer plateia, em qualquer cidade, cai dentro do raio de 10 km
da ZAS, com uma distância plausível de mostrar na tela. Com `?demo=0`, a página
usa as coordenadas reais do primeiro piezômetro do catálogo (Complexo de
Germano, Mariana/MG) — útil só se a demonstração for feita fisicamente perto do
local real. Detalhes da conta em `assets/js/alerta.js` (função `calcularZas`).
