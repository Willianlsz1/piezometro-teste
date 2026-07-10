// ── NOTIFICAÇÕES ──────────────────────────────────────────────────────────────
// Envio de mensagens via Telegram/Twilio SMS e montagem do texto de cada tipo
// de alerta (nível, comunicação, taxa de variação), com registro em alertLog.

import { timeoutSignal } from "./http.js";

export async function sendTelegram(cfg, text) {
  if (!cfg.telegramOn) return "desativado";
  try {
    const resp = await fetch(`https://api.telegram.org/bot${cfg.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.TELEGRAM_CHAT_ID, text }),
      signal: timeoutSignal(),
    });
    return resp.status === 200 ? "enviado" : `falha HTTP ${resp.status}`;
  } catch (e) {
    return `erro: ${e.message}`;
  }
}

export async function sendSMS(cfg, text) {
  if (!cfg.smsOn) return "desativado";
  try {
    const form = new URLSearchParams({ Body: text, From: cfg.TWILIO_FROM, To: cfg.TWILIO_TO }).toString();
    const auth = btoa(`${cfg.TWILIO_ACCOUNT_SID}:${cfg.TWILIO_AUTH_TOKEN}`);
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: timeoutSignal(),
    });
    return resp.status === 201 ? "enviado" : `falha HTTP ${resp.status}`;
  } catch (e) {
    return `erro: ${e.message}`;
  }
}

export async function notificar(cfg, alertLog, pz, nivel, valor) {
  const emoji = { NORMAL: "🟢", ATENCAO: "🟡", CRITICO: "🔴" }[nivel];
  const acao = {
    NORMAL: "Nível retornou à faixa segura.",
    ATENCAO: `Nível acima de ${cfg.NIVEL_ATENCAO} m — intensificar monitoramento.`,
    CRITICO: `Nível acima de ${cfg.NIVEL_CRITICO} m — ACIONAR EQUIPE DE GEOTECNIA!`,
  }[nivel];
  const text =
    `${emoji} SAMARCO PIEZÔMETRO ${pz} — ${nivel}\n` +
    `Nível d'água: ${valor.toFixed(2)} m\n${acao}\n` +
    `${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;

  const [telegram, sms] = await Promise.all([
    sendTelegram(cfg, text),
    sendSMS(cfg, text),
  ]);

  const registro = { ts: new Date().toISOString(), tipo: "nivel", piezometro: pz, nivel, valor, telegram, sms };
  alertLog.unshift(registro);
  if (alertLog.length > 100) alertLog.pop();
  console.log(`🔔 Alerta ${pz} ${nivel} (${valor.toFixed(2)} m) — telegram: ${telegram} · sms: ${sms}`);
}

// P2 — notifica transição de estado de COMUNICAÇÃO (camada separada do
// alarme de nível). "silencioMin" só é relevante na transição OK→SEM_SINAL.
export async function notificarComunicacao(cfg, alertLog, pz, status, ultimaLeituraTs, silencioMin) {
  const dataUltima = new Date(ultimaLeituraTs * 1000).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const text =
    status === "SEM_SINAL"
      ? `⚠️ SAMARCO PIEZÔMETRO ${pz} — SEM SINAL\n` +
        `Sem leituras há ${silencioMin} min (última: ${dataUltima}).\n` +
        `Verificar instrumento/comunicação.`
      : `🟢 SAMARCO PIEZÔMETRO ${pz} — COMUNICAÇÃO RESTABELECIDA\n` +
        `Instrumento voltou a reportar.`;

  const [telegram, sms] = await Promise.all([sendTelegram(cfg, text), sendSMS(cfg, text)]);

  const registro = { ts: new Date().toISOString(), tipo: "comunicacao", piezometro: pz, status, telegram, sms };
  alertLog.unshift(registro);
  if (alertLog.length > 100) alertLog.pop();
  console.log(`🔔 Comunicação ${pz} ${status} — telegram: ${telegram} · sms: ${sms}`);
}

// P3 — notifica transição de estado de TAXA DE VARIAÇÃO. "taxa"/"limite" só
// são relevantes na transição OK→TAXA_ALTA (na recuperação a mensagem é só
// informativa).
export async function notificarTaxa(cfg, alertLog, pz, status, taxa, limite) {
  const text =
    status === "TAXA_ALTA"
      ? `📈 SAMARCO PIEZÔMETRO ${pz} — VARIAÇÃO RÁPIDA\n` +
        `Nível ${taxa >= 0 ? "subindo" : "descendo"} ${Math.abs(taxa).toFixed(2)} m/dia (limite ${limite})\n` +
        `Investigar mesmo dentro da faixa normal.`
      : `🟢 SAMARCO PIEZÔMETRO ${pz} — VARIAÇÃO NORMALIZADA\n` +
        `Taxa de variação voltou abaixo do limite.`;

  const [telegram, sms] = await Promise.all([sendTelegram(cfg, text), sendSMS(cfg, text)]);

  const registro = { ts: new Date().toISOString(), tipo: "taxa", piezometro: pz, status, taxa, telegram, sms };
  alertLog.unshift(registro);
  if (alertLog.length > 100) alertLog.pop();
  console.log(`🔔 Taxa ${pz} ${status} (${taxa != null ? taxa.toFixed(2) : "?"} m/dia) — telegram: ${telegram} · sms: ${sms}`);
}
