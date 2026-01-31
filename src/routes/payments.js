const express = require("express");
const router = express.Router();
const { createPaymentController } = require("../controllers/payments.controller");
const { getPaymentStatusController } = require("../controllers/paymentsStatus.controller");
const { callbackController } = require("../controllers/callback.controller");

router.post("/payments", createPaymentController);
router.get("/payments/:id", getPaymentStatusController);
router.post("/callback", callbackController);

module.exports = router;

