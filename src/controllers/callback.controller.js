// Контроллер обработки callback от платёжного партнёра: POST /api/callback
//
// Главная идея:
// - callback — это СИГНАЛ, а не истина
// - мы НЕ верим статусу из callback напрямую
// - мы САМИ:
//   1) проверяем статус у партнёра (verify)
//   2) подтверждаем платёж у партнёра (confirm)
//   3) только потом финализируем платёж у себя

const {
  getPayment,
  updateStatus,
  updatePartnerInfo,
} = require("../services/payments.store");

const { logPaymentEvent } = require("../services/payments.events");

// POST /api/callback
async function callbackController(req, res) {
  // 1) Достаём данные из callback
  const { paymentId, status } = req.body || {};

  // 2) Проверяем, что paymentId пришёл
  if (!paymentId) {
    return res.status(400).json({ ok: false, error: "paymentId required" });
  }

  // Логируем факт callback
  logPaymentEvent("callback_received", {
    paymentId: String(paymentId),
    callbackStatus: status ?? null,
  });

  // 3) Ищем платёж у себя в базе
  const payment = await getPayment(String(paymentId));
  if (!payment) {
    return res.status(404).json({ ok: false, error: "payment not found", paymentId });
  }

  // 4) Идемпотентность: если уже финализирован — ничего не делаем
  if (payment.status === "confirmed" || payment.status === "failed") {
    logPaymentEvent("idempotent_skip", {
      paymentId: String(paymentId),
      currentStatus: payment.status,
    });

    return res.json({
      ok: true,
      mode: "idempotent",
      message: "payment already finalized",
      payment,
    });
  }

  // 5) Учебное упрощение
  const partnerPaymentId = String(paymentId);

  // 6) Берём API ключ
  const apiKey = req.header("X-API-Key");
  if (!apiKey) {
    // Важно: без ключа мы не можем делать verify/confirm к партнёру
    logPaymentEvent("auth_missing_api_key", {
      paymentId: String(paymentId),
      header: "X-API-Key",
    });

    return res.status(401).json({
      ok: false,
      error: "X-API-Key header required",
    });
  }

  // 7) В учебном проекте партнёр "мокается" на этом же сервисе
  const baseUrl = "http://127.0.0.1:3000";

  // =====================================================
  // A) VERIFY — проверяем реальный статус у партнёра
  // =====================================================
  logPaymentEvent("partner_status_request", {
    paymentId: String(paymentId),
    partnerPaymentId,
  });

  const statusResp = await fetch(
    `${baseUrl}/api/partner/status/${encodeURIComponent(partnerPaymentId)}`,
    { headers: { "X-API-Key": apiKey } }
  );

  if (!statusResp.ok) {
    logPaymentEvent("partner_status_http_error", {
      paymentId: String(paymentId),
      partnerPaymentId,
      httpStatus: statusResp.status,
    });

    return res.status(502).json({
      ok: false,
      error: "partner status request failed",
      httpStatus: statusResp.status,
    });
  }

  const partnerStatus = await statusResp.json();

  // Защита от мусорного ответа партнёра
  const partnerStatusValue = partnerStatus?.status;
  if (typeof partnerStatusValue !== "string") {
    logPaymentEvent("partner_status_invalid", {
      paymentId: String(paymentId),
      partnerPaymentId,
      partnerStatusRaw: JSON.stringify(partnerStatus),
    });

    return res.status(502).json({
      ok: false,
      error: "partner status invalid response",
    });
  }

  await updatePartnerInfo(String(paymentId), {
    partnerPaymentId,
    callbackStatus: status ?? null,
    partnerStatus: partnerStatusValue,
    partnerStatusRaw: JSON.stringify(partnerStatus),
  });

  logPaymentEvent("partner_status_ok", {
    paymentId: String(paymentId),
    partnerPaymentId,
    partnerStatus: partnerStatusValue,
  });

  // Если FAILED — сразу финализируем как failed
  if (partnerStatusValue === "failed") {
    await updatePartnerInfo(String(paymentId), { failedReason: "partner_status_failed" });
    const updated = await updateStatus(String(paymentId), "failed");

    logPaymentEvent("final_failed", {
      paymentId: String(paymentId),
      reason: "partner_status_failed",
    });

    return res.json({
      ok: true,
      mode: "signal_then_confirm",
      receivedCallbackStatus: status ?? null,
      partnerPaymentId,
      partnerStatus,
      payment: updated,
    });
  }

  // =====================================================
  // B) CONFIRM — подтверждаем платёж у партнёра
  // =====================================================
  logPaymentEvent("partner_confirm_request", {
    paymentId: String(paymentId),
    partnerPaymentId,
  });

  const confirmResp = await fetch(`${baseUrl}/api/partner/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ partnerPaymentId }),
  });

  if (confirmResp.status === 409) {
    let partnerConfirmError;
    try {
      partnerConfirmError = await confirmResp.json();
    } catch {
      partnerConfirmError = { error: "partner confirm returned 409" };
    }

    await updatePartnerInfo(String(paymentId), {
      partnerConfirmRaw: JSON.stringify(partnerConfirmError),
      failedReason: "partner_confirm_409",
    });

    const updated = await updateStatus(String(paymentId), "failed");

    logPaymentEvent("final_failed", {
      paymentId: String(paymentId),
      reason: "partner_confirm_409",
    });

    return res.json({
      ok: true,
      mode: "signal_then_confirm",
      receivedCallbackStatus: status ?? null,
      partnerPaymentId,
      partnerStatus,
      partnerConfirm: partnerConfirmError,
      payment: updated,
    });
  }

  if (!confirmResp.ok) {
    logPaymentEvent("partner_confirm_http_error", {
      paymentId: String(paymentId),
      partnerPaymentId,
      httpStatus: confirmResp.status,
    });

    return res.status(502).json({
      ok: false,
      error: "partner confirm failed",
      httpStatus: confirmResp.status,
    });
  }

  const partnerConfirm = await confirmResp.json();

  await updatePartnerInfo(String(paymentId), {
    partnerConfirmRaw: JSON.stringify(partnerConfirm),
  });

  logPaymentEvent("partner_confirm_ok", {
    paymentId: String(paymentId),
    partnerPaymentId,
    partnerConfirmId: partnerConfirm.partnerConfirmId ?? null,
  });

  // Только после успешного confirm ставим confirmed у себя
  const updated = await updateStatus(String(paymentId), "confirmed");

  logPaymentEvent("final_confirmed", { paymentId: String(paymentId) });

  return res.json({
    ok: true,
    mode: "signal_then_confirm",
    receivedCallbackStatus: status ?? null,
    partnerPaymentId,
    partnerStatus,
    partnerConfirm,
    payment: updated,
  });
}

module.exports = { callbackController };
