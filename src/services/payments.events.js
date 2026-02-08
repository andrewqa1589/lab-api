// src/services/payments.events.js
// Простой “продоподобный” лог событий для саппорта.
// Пишем одним line JSON — удобно искать и парсить.

function logPaymentEvent(event, data = {}) {
  const line = {
    tag: "PAY_EVT",
    ts: new Date().toISOString(),
    event,
    ...data,
  };

  // JSON в одну строку — идеальный формат для journalctl/grep
  console.log(JSON.stringify(line));
}

module.exports = { logPaymentEvent };
