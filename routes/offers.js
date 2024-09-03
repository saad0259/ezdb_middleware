const express = require("express");
const router = express.Router();

const {
  getOffers,
  createOffer,
  updateOffer,
} = require("../controllers/offers");

router.route("/").get(getOffers).post(createOffer);
router.route("/:id").patch(updateOffer);

module.exports = router;
