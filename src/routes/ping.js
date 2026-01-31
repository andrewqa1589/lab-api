const express = require("express");
const router = express.Router();
const { ping } = require("../controllers/ping.controller");

router.get("/ping", ping);

module.exports = router;


router.get("/crash", (req, res) => {
  res.status(500).json({ ok: false, error: "test error" });
});
