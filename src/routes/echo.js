const express = require("express");
const router = express.Router();

router.post("/echo", (req, res) => {
  res.json({
    headers: req.headers,
    query: req.query,
    params: req.params,
    body: req.body
  });
});

module.exports = router;
