// Берём готовое Express-приложение из app.js
//const app = require("./app");

// Порт, на котором будет работать сервер
//const port = 3000;

// Запускаем HTTP сервер
//app.listen(port, "0.0.0.0", () => {
  // Лог при успешном старте
//  console.log("listening on", port);
//});

// ВЫШЕ СТАРАЯ ВЕРСИЯ 

// 1) Подключаем dotenv: он читает файл .env и кладёт значения в process.env
require("dotenv").config();

// 2) Импортируем уже "собранное" Express-приложение из app.js
const app = require("./app");

// 3) Берём порт из окружения (PORT), а если его нет — используем 3000
// Number(...) превращает строку "3000" в число 3000
const port = Number(process.env.PORT || 3000);

// 4) Запускаем HTTP сервер
// "0.0.0.0" = слушать на всех интерфейсах (важно для виртуалки)
app.listen(port, "0.0.0.0", () => {
  console.log("listening on", port);
});



