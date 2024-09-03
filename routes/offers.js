const express = require("express");
const router = express.Router();

const {
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
} = require("../controllers/offers");

router.route("/").get(getOffers).post(createOffer);
router.route("/:id").patch(updateOffer).delete(deleteOffer);

module.exports = router;
