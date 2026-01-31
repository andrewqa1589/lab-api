// In-memory store (хранилище в памяти)
// Это наша "база данных", пока без настоящей БД.
//
// Формат:
// paymentsById = {
//   "pay_xxx": { paymentObject },
//   "pay_yyy": { paymentObject }
// }

const paymentsById = Object.create(null);
// создаём пустой объект без prototype
// будем использовать как словарь: id -> payment

// Сохранить платёж в память
function savePayment(payment) {
  // кладём объект платежа по ключу его id
  paymentsById[payment.id] = payment;

  // возвращаем сохранённый объект
  return payment;
}

// Получить платёж по id
function getPayment(id) {
  // если такой id есть → вернём объект
  // если нет → вернём null
  return paymentsById[id] || null;
}

// Обновить только статус платежа
function updateStatus(id, status) {
  // пытаемся найти платёж
  const p = paymentsById[id];

  // если нет такого платежа → выходим
  if (!p) return null;

  // меняем статус
  p.status = status;

  // записываем дату обновления
  p.updatedAt = new Date().toISOString();

  // возвращаем обновлённый объект
  return p;
}

// Экспортируем функции наружу
module.exports = {
  savePayment,
  getPayment,
  updateStatus,
};
