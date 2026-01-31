const express = require("express");
const router = express.Router();

const {
  getPartnerStatusController,
  postPartnerConfirmController,
} = require("../controllers/partner.controller");

router.get("/partner/status/:partnerPaymentId", getPartnerStatusController);
router.post("/partner/confirm", postPartnerConfirmController);

module.exports = router;
