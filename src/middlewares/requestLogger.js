// SECURITY: never log authorization / x-api-key / cookies

function requestLogger(req, res, next) {
  const start = Date.now();

  // логируем приход запрос
    console.log(
      `[REQ] ${req.method} ${req.originalUrl} ` +
      `(content-type=${req.headers["content-type"] || "none"}, ` +
      `len=${req.headers["content-length"] || "?"})`
    );

  // когда ответ будет отправлен — залогируем статус и время
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[RES] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });

  next();
}

module.exports = { requestLogger };
