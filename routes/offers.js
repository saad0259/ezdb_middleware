const express = require("express");
const router = express.Router();

const { getOffers, updateOffer } = require("../controllers/offers");

router.route("/").get(getOffers);
router.route("/:id").patch(updateOffer);

module.exports = router;
