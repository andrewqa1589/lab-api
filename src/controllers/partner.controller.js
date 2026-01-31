// Фейковый "партнёр" (мок).
// В реале это был бы внешний сервер, а мы бы ходили к нему по HTTP.

// GET /api/partner/status/:partnerPaymentId
function getPartnerStatusController(req, res) {
  // Берём partnerPaymentId из URL параметра
  const { partnerPaymentId } = req.params;

  // Примитивная тестовая логика:
  // если id заканчивается на "0" -> failed, иначе -> paid
  const status = String(partnerPaymentId).endsWith("0") ? "failed" : "paid";

  // Возвращаем "ответ партнёра"
  return res.json({
    ok: true,
    partnerPaymentId,
    status,
  });
}

// POST /api/partner/confirm
// Body: { partnerPaymentId }
function postPartnerConfirmController(req, res) {
  // Берём partnerPaymentId из тела запроса (POST)
  const { partnerPaymentId } = req.body || {};

  // Валидация входных данных
  if (!partnerPaymentId) {
    return res.status(400).json({
      ok: false,
      error: "partnerPaymentId is required",
    });
  }

  // Мок-логика: если платёж "failed", то confirm делать нельзя
  const wouldFail = String(partnerPaymentId).endsWith("0");
  if (wouldFail) {
    return res.status(409).json({
      ok: false,
      partnerPaymentId,
      status: "not_confirmable",
      error: "payment is failed, cannot confirm",
    });
  }

  // Успешный confirm — возвращаем подтверждение
  return res.json({
    ok: true,
    partnerPaymentId,
    status: "confirmed",
    partnerConfirmId: `cnf_${Math.random().toString(36).slice(2, 10)}`,
  });
}

module.exports = {
  getPartnerStatusController,
  postPartnerConfirmController,
};
