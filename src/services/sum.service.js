function parseNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error("must be a number");
  }
  return n;
}

function sum(aRaw, bRaw) {
  const a = parseNumber(aRaw);
  const b = parseNumber(bRaw);
  return a + b;
}

module.exports = { sum };
