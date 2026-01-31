function genId() {
  return "pay_" + Math.random().toString(36).slice(2, 10);
}

function createPayment({ amount, currency, userId }) {
  const parsedAmount = Number(amount);
  const parsedCurrency = String(currency ?? "").toUpperCase();
  const parsedUserId = String(userId ?? "").trim();

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("amount must be > 0");
  }

  if (!parsedCurrency || parsedCurrency.length !== 3) {
    throw new Error("currency must be 3-letter code");
  }

  if (!parsedUserId) {
    throw new Error("userId is required");
  }

  return {
    id: genId(),
    status: "created",
    amount: parsedAmount,
    currency: parsedCurrency,
    userId: parsedUserId,
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  createPayment
};

