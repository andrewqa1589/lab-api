const { getPayment } = require("../services/payments.store");

async function getPaymentStatusController(req, res) {
  const { id } = req.params;

  const payment = await getPayment(id);

  if (!payment) {
    return res.status(404).json({
      ok: false,
      error: "payment not found",
      id,
    });
  }

  return res.json({
    ok: true,
    payment,
  });
}

module.exports = { getPaymentStatusController };
