// Контроллер обработки callback от платёжного партнёра: POST /api/callback
//
// Главная идея:
// - callback — это СИГНАЛ, а не истина
// - мы НЕ верим статусу из callback
// - мы САМИ:
//   1) проверяем статус у партнёра (verify)
//   2) подтверждаем платёж у партнёра (confirm)
//   3) только потом финализируем платёж у себя
//
// Этот файл — сердце платёжного флоу.

const {
  getPayment,
  updateStatus,
  updatePartnerInfo,
} = require("../services/payments.store");

// Логирование событий платежа (для саппорта и расследований)
const { logPaymentEvent } = require("../services/payments.events");

// POST /api/callback
async function callbackController(req, res) {
  // 1) Достаём данные из callback
  // Обычно партнёр присылает хотя бы paymentId и статус
  const { paymentId, status } = req.body || {};

  // 2) Проверяем, что paymentId вообще пришёл
  if (!paymentId) {
    return res.status(400).json({
      ok: false,
      error: "paymentId required",
    });
  }

  // Логируем сам факт получения callback
  logPaymentEvent("callback_received", {
    paymentId: String(paymentId),
    callbackStatus: status ?? null,
  });

  // 3) Ищем платёж у себя в базе
  // Важно: getPayment асинхронный (SQLite)
  const payment = await getPayment(String(paymentId));
  if (!payment) {
    return res.status(404).json({
      ok: false,
      error: "payment not found",
      paymentId,
    });
  }

  // 4) Идемпотентность
  // Если платёж уже финализирован — НИЧЕГО не делаем
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

  // 5) Учебное упрощение:
  // считаем, что partnerPaymentId = наш paymentId
  const partnerPaymentId = String(paymentId);

  // 6) Берём API ключ из входящего запроса
  // (в реальности часто используется отдельный серверный ключ)
  const apiKey = req.header("X-API-Key");

  // 7) В учебном проекте партнёр "мокается" на этом же сервисе
  // В реальности тут будет URL внешнего API партнёра
  const baseUrl = "http://127.0.0.1:3000";

  // =====================================================
  // A) VERIFY — проверяем реальный статус у партнёра
  // =====================================================
  const statusResp = await fetch(
    `${baseUrl}/api/partner/status/${encodeURIComponent(partnerPaymentId)}`,
    {
      headers: {
        "X-API-Key": apiKey,
      },
    }
  );

  // Если партнёрский API недоступен — это bad gateway
  if (!statusResp.ok) {
    return res.status(502).json({
      ok: false,
      error: "partner status request failed",
      httpStatus: statusResp.status,
    });
  }

  // Ответ партнёра (обычно JSON)
  const partnerStatus = await statusResp.json();

  // Сохраняем партнёрскую информацию в БД
  // Даже если дальше что-то упадёт — эти данные останутся
  await updatePartnerInfo(String(paymentId), {
    partnerPaymentId,
    callbackStatus: status ?? null,
    partnerStatus: partnerStatus.status ?? null,
    partnerStatusRaw: JSON.stringify(partnerStatus),
  });

  logPaymentEvent("partner_status_ok", {
    paymentId: String(paymentId),
    partnerPaymentId,
    partnerStatus: partnerStatus.status ?? null,
  });

  // Если партнёр сказал FAILED — сразу финализируем как failed
  if (partnerStatus.status === "failed") {
    await updatePartnerInfo(String(paymentId), {
      failedReason: "partner_status_failed",
    });

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
  const confirmResp = await fetch(`${baseUrl}/api/partner/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ partnerPaymentId }),
  });

  // Если confirm невозможен (например 409) — считаем failed
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

  // Любая другая ошибка партнёра — тоже 502
  if (!confirmResp.ok) {
    return res.status(502).json({
      ok: false,
      error: "partner confirm failed",
      httpStatus: confirmResp.status,
    });
  }

  // Успешный confirm
  const partnerConfirm = await confirmResp.json();

  // Сохраняем сырой confirm в БД
  await updatePartnerInfo(String(paymentId), {
    partnerConfirmRaw: JSON.stringify(partnerConfirm),
  });

  logPaymentEvent("partner_confirm_ok", {
    paymentId: String(paymentId),
    partnerPaymentId,
    partnerConfirmId: partnerConfirm.partnerConfirmId ?? null,
  });

  // 8) Только ПОСЛЕ успешного confirm ставим confirmed у себя
  const updated = await updateStatus(String(paymentId), "confirmed");

  logPaymentEvent("final_confirmed", {
    paymentId: String(paymentId),
  });

  // 9) Возвращаем итог клиенту
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
