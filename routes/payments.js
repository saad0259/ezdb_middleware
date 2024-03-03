const express = require("express");
const router = express.Router();

const {
  createPaymentIntent,
  completePaymentIntent,
  getPaymentsByUserId,
} = require("../controllers/payments");

router.post("/", createPaymentIntent);
router.get("/user/:userId", getPaymentsByUserId);
router.get("/:id", completePaymentIntent);

module.exports = router;
