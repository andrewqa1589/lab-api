const express = require("express");
const router = express.Router();
const { sumController } = require("../controllers/sum.controller");

// POST /sum  body: { "a": 2, "b": 3 } -> { "ok": true, "result": 5 }
router.post("/sum", sumController);

module.exports = router;
