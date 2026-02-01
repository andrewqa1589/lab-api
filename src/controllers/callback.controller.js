// src/controllers/callback.controller.js

const { getPayment, updateStatus } = require("../services/payments.store");

// POST /api/callback
async function callbackController(req, res) {
  // Signal from partner (we don't trust it as truth)
  const { paymentId, status } = req.body || {};

  // Validate input
  if (!paymentId) {
    return res.status(400).json({ ok: false, error: "paymentId required" });
  }

  // Find payment in our store
  const p = await getPayment(String(paymentId));
  if (!p) {
    return res.status(404).json({ ok: false, error: "payment not found", paymentId });
  }

  // Idempotency: if already finalized - do nothing
  if (p.status === "confirmed" || p.status === "failed") {
    return res.json({
      ok: true,
      mode: "idempotent",
      message: "payment already finalized",
      payment: p,
    });
  }

  // учебное упрощение: partnerPaymentId = наш paymentId
  const partnerPaymentId = String(paymentId);

  // прокидываем ключ, т.к. /api/partner/ защищён apiKeyAuth
  const apiKey = req.header("X-API-Key");

  // "партнёр" сейчас мокается на этом же сервисе
  const baseUrl = "http://127.0.0.1:3000";

  // A) STATUS CHECK (verify)
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

  // If partner says failed -> finalize as failed
  if (partnerStatus.status === "failed") {
    const updated = updateStatus(String(paymentId), "failed");
    return res.json({
      ok: true,
      mode: "signal_then_confirm",
      receivedCallbackStatus: status ?? null,
      partnerPaymentId,
      partnerStatus,
      payment: updated,
    });
  }

  // B) CONFIRM (finalize)
  const confirmResp = await fetch(`${baseUrl}/api/partner/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ partnerPaymentId }),
  });

  // Improvement: 409 means "cannot confirm" -> treat as failed
  if (confirmResp.status === 409) {
    let partnerConfirmError = null;
    try {
      partnerConfirmError = await confirmResp.json();
    } catch (e) {
      partnerConfirmError = { ok: false, error: "partner confirm returned 409" };
    }

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

  // Only after successful confirm -> confirmed
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
