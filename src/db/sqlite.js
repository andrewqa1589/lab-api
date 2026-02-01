const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "../../data/lab-api.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to SQLite:", err.message);
  } else {
    console.log("Connected to SQLite database");
  }
});

// создаём таблицу payments если её нет
db.run(`
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,

    partner_payment_id TEXT,
    callback_status TEXT,
    partner_status TEXT,
    partner_status_raw TEXT,
    partner_confirm_raw TEXT,
    failed_reason TEXT
  )
`);

module.exports = db;
