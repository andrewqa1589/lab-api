// Контроллер для создания платежа: POST /api/payments
// Задача контроллера:
// 1) принять HTTP-запрос (req)
// 2) вызвать бизнес-логику (services) и слой данных (store)
// 3) вернуть HTTP-ответ (res)
//
// Важно: контроллер НЕ знает SQL и НЕ хранит данные сам.
// Он просто связывает входящий запрос с нужными функциями.

const { createPayment } = require("../services/payments.service");
const { savePayment } = require("../services/payments.store");

// Лог событий "как в проде" (удобно для саппорта/поиска в journalctl)
const { logPaymentEvent } = require("../services/payments.events");

// POST /api/payments
// Ожидаем body: { amount, currency, userId }
async function createPaymentController(req, res) {
  try {
    // 1) Создаём объект платежа (валидация + нормализация полей)
    // Здесь проверяется, что amount > 0, currency = 3 буквы, userId не пустой
    const payment = createPayment(req.body ?? {});

    // 2) Сохраняем платёж в БД (SQLite)
    // Теперь store работает асинхронно => обязательно await
    await savePayment(payment);

    // 3) Пишем "событие" в лог для саппорта/отладки
    // Это не влияет на работу платежа, просто помогает быстро расследовать проблемы
    logPaymentEvent("created", {
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      userId: payment.userId,
    });

    // 4) Отдаём успешный ответ клиенту
    return res.status(201).json({
      ok: true,
      payment,
    });
  } catch (err) {
    // Если createPayment выбросил ошибку (например amount <= 0),
    // вернём 400 и покажем сообщение
    logPaymentEvent("create_failed", {
      // paymentId может отсутствовать, если ошибка произошла до генерации id
      error: err.message,
      received: req.body ?? null,
    });

    return res.status(400).json({
      ok: false,
      error: err.message,
      received: req.body,
    });
  }
}

module.exports = { createPaymentController };
