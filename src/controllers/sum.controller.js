const { sum } = require("../services/sum.service");

function sumController(req, res) {
  try {
    // ожидаем body: { a, b }
    const { a, b } = req.body ?? {};
    const result = sum(a, b);

    return res.json({
      ok: true,
      result
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: err.message,
      received: req.body
    });
  }
}

module.exports = { sumController };
