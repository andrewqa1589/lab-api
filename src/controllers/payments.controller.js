const { createPayment } = require("../services/payments.service");
const { savePayment } = require("../services/payments.store");

function createPaymentController(req, res) {
  try {
    // ожидаем body: { amount, currency, userId }
    const payment = createPayment(req.body ?? {});

    // сохраняем платёж в in-memory store
    savePayment(payment);

    return res.status(201).json({
      ok: true,
      payment
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: err.message,
      received: req.body
    });
  }
}

module.exports = { createPaymentController };
