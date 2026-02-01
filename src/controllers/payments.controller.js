const { createPayment } = require("../services/payments.service");
const { savePayment } = require("../services/payments.store");

async function createPaymentController(req, res) {
  try {
    const payment = createPayment(req.body ?? {});
    await savePayment(payment);

    return res.status(201).json({
      ok: true,
      payment,
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: err.message,
      received: req.body,
    });
  }
}

module.exports = { createPaymentController };
