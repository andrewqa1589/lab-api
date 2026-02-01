// Берём функции из store (теперь это SQLite-store)
const {
  getPayment,
  updateStatus,
  updatePartnerInfo,
} = require("../services/payments.store");

// POST /api/callback
// Это "сигнал" от партнёра: мы его НЕ считаем истиной.
// Мы всё равно идём сами проверять статус у партнёра и делаем confirm.
async function callbackController(req, res) {
  // Что пришло от партнёра (учебный формат)
  const { paymentId, status } = req.body || {};

  // 1) Валидация входа
  if (!paymentId) {
    return res.status(400).json({ ok: false, error: "paymentId required" });
  }

  // 2) Ищем платёж у себя в БД
  // Важно: getPayment теперь async (SQLite), поэтому await
  const p = await getPayment(String(paymentId));
  if (!p) {
    return res
      .status(404)
      .json({ ok: false, error: "payment not found", paymentId });
  }

  // 3) Идемпотентность:
  // если платёж уже финальный (confirmed/failed) — ничего не делаем
  if (p.status === "confirmed" || p.status === "failed") {
    return res.json({
      ok: true,
      mode: "idempotent",
      message: "payment already finalized",
      payment: p,
    });
  }

  // 4) Учебное упрощение:
  // partnerPaymentId = наш paymentId
  const partnerPaymentId = String(paymentId);

  // 5) Прокидываем API ключ, т.к. /api/partner/ защищён apiKeyAuth
  const apiKey = req.header("X-API-Key");

  // 6) "Партнёр" мокается на этом же сервисе
  const baseUrl = "http://127.0.0.1:3000";

  // ============================================================
  // A) STATUS CHECK (verify) — проверяем реальный статус у партнёра
  // ============================================================
  const statusResp = await fetch(
    `${baseUrl}/api/partner/status/${encodeURIComponent(partnerPaymentId)}`,
    { headers: { "X-API-Key": apiKey } }
  );

  if (!statusResp.ok) {
    return res.status(502).json({
      ok: false,
      error: "partner status request failed",
      httpStatus: statusResp.status,
    });
  }

  const partnerStatus = await statusResp.json();

  // 7) Сохраняем в БД то, что мы знаем на этом этапе:
  // - что прислал callback (receivedCallbackStatus)
  // - какой статус вернул partner/status
  // - сырой ответ partner/status (как JSON строку)
  await updatePartnerInfo(String(paymentId), {
    partnerPaymentId,
    callbackStatus: status ?? null,
    partnerStatus: partnerStatus.status ?? null,
    partnerStatusRaw: JSON.stringify(partnerStatus),
  });

  // Если партнёр говорит "failed" — финализируем как failed
  if (partnerStatus.status === "failed") {
    // Запишем причину (полезно для разборов)
    await updatePartnerInfo(String(paymentId), {
      failedReason: "partner status failed",
    });

    // Важно: updateStatus async => await
    const updated = await updateStatus(String(paymentId), "failed");

    return res.json({
      ok: true,
      mode: "signal_then_confirm",
      receivedCallbackStatus: status ?? null,
      partnerPaymentId,
      partnerStatus,
      payment: updated,
    });
  }

  // ============================================================
  // B) CONFIRM (finalize) — подтверждаем у партнёра (делаем confirm)
  // ============================================================
  const confirmResp = await fetch(`${baseUrl}/api/partner/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ partnerPaymentId }),
  });

  // Improvement: 409 означает "нельзя подтвердить" -> считаем failed
  if (confirmResp.status === 409) {
    let partnerConfirmError = null;
    try {
      partnerConfirmError = await confirmResp.json();
    } catch (e) {
      partnerConfirmError = { ok: false, error: "partner confirm returned 409" };
    }

    // Сохраняем в БД сырой ответ confirm + причину фейла
    await updatePartnerInfo(String(paymentId), {
      failedReason: "partner confirm 409",
      partnerConfirmRaw: JSON.stringify(partnerConfirmError),
    });

    const updated = await updateStatus(String(paymentId), "failed");

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
    return res.status(502).json({
      ok: false,
      error: "partner confirm failed",
      httpStatus: confirmResp.status,
    });
  }

  const partnerConfirm = await confirmResp.json();

  // Сохраняем сырой успешный confirm (для истории / отладки)
  await updatePartnerInfo(String(paymentId), {
    partnerConfirmRaw: JSON.stringify(partnerConfirm),
  });

  // 8) Только после успешного confirm ставим confirmed у себя
  const updated = await updateStatus(String(paymentId), "confirmed");

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
