const db = require("../db/sqlite");

// ---- Promise wrappers for sqlite3 callback API ----
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this); // this.changes, this.lastID
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

// ---- Row -> payment object mapping (keep old API shape) ----
function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,

    // partner-related fields (optional)
    partnerPaymentId: row.partner_payment_id ?? undefined,
    callbackStatus: row.callback_status ?? undefined,
    partnerStatus: row.partner_status ?? undefined,
    partnerStatusRaw: row.partner_status_raw ?? undefined,
    partnerConfirmRaw: row.partner_confirm_raw ?? undefined,
    failedReason: row.failed_reason ?? undefined,
  };
}

// ---- Store API ----
async function savePayment(payment) {
  await run(
    `
    INSERT INTO payments (id, amount, currency, status, user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payment.id,
      payment.amount,
      payment.currency,
      payment.status,
      payment.userId,
      payment.createdAt,
      payment.updatedAt ?? null,
    ]
  );

  return payment;
}

async function getPayment(id) {
  const row = await get(`SELECT * FROM payments WHERE id = ?`, [id]);
  return mapRow(row);
}

async function updateStatus(id, status) {
  const updatedAt = new Date().toISOString();

  const result = await run(
    `UPDATE payments SET status = ?, updated_at = ? WHERE id = ?`,
    [status, updatedAt, id]
  );

  if (result.changes === 0) return null;
  return getPayment(id);
}

module.exports = {
  savePayment,
  getPayment,
  updateStatus,
};
