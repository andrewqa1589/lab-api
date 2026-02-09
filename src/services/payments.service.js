// Этот сервис отвечает за создание платежа (пока только create).
// ВАЖНО: здесь мы пишем доменные события PAY_EVT — это "история", а не просто debug-лог.

const { logPaymentEvent } = require("./payments.events");

// Генератор простого ID для учебного проекта.
// В проде так не делают (нужны UUID/снежинки/БД sequence), но для песочницы норм.
function genId() {
  return "pay_" + Math.random().toString(36).slice(2, 10);
}

function createPayment({ amount, currency, userId }) {
  // 1) Нормализуем входные данные (приводим к нужным типам/формату)
  const parsedAmount = Number(amount);
  const parsedCurrency = String(currency ?? "").toUpperCase();
  const parsedUserId = String(userId ?? "").trim();

  // 2) Валидация (защищаемся от мусора на входе)
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("amount must be > 0");
  }

  if (!parsedCurrency || parsedCurrency.length !== 3) {
    throw new Error("currency must be 3-letter code");
  }

  if (!parsedUserId) {
    throw new Error("userId is required");
  }

  // 3) Формируем объект платежа (это то, что дальше попадёт в store/БД)
  const payment = {
    id: genId(),
    status: "created", // "мы создали платеж у себя"
    amount: parsedAmount,
    currency: parsedCurrency,
    userId: parsedUserId,
    createdAt: new Date().toISOString(),
  };

  // 4) Пишем доменное событие (audit trail).
  // Это НЕ статус. Это факт: "платеж создан".
  // Потом по этим событиям можно восстановить жизненный цикл платежа через journalctl.
  logPaymentEvent("payment_created", {
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    userId: payment.userId,
  });

  // 5) Возвращаем созданный платеж (контроллер/роут отправит его клиенту)
  return payment;
}

module.exports = {
  createPayment,
};
