// Секретный API ключ 
const API_KEY = process.env.API_KEY || "test_api_key_123";

// Middleware проверки API key
function apiKeyAuth(req, res, next) {

  // Берём заголовок X-API-Key
  const apiKey = req.headers["x-api-key"];

  // Если ключ не передан
  if (!apiKey) {
    return res.status(401).json({
      ok: false,
      error: "API key missing"
    });
  }

  // Если ключ передан, но неверный
  if (apiKey !== API_KEY) {
    return res.status(401).json({
      ok: false,
      error: "Invalid API key"
    });
  }

  // Если всё ок — пропускаем запрос дальше
  next();
}

module.exports = { apiKeyAuth };
