// Берём функцию получения платежа из in-memory store
const { getPayment } = require("../services/payments.store");

// Контроллер получения статуса платежа
// Вызывается при GET /api/payments/:id
function getPaymentStatusController(req, res) {

  // Берём id из параметров URL
  // Пример: /api/payments/pay_123
  const { id } = req.params;

  // Ищем платёж в памяти
  const payment = getPayment(id);

  // Если платёж не найден
  if (!payment) {
    return res.status(404).json({
      ok: false,
      error: "payment not found",
      id
    });
  }

  // Если платёж найден — возвращаем его
  return res.json({
    ok: true,
    payment
  });
}

// Экспортируем контроллер
module.exports = { getPaymentStatusController };
