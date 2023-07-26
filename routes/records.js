const express = require("express");
const router = express.Router();
const { getRecords } = require("../controllers/records");

router.route("/").get(getRecords);

module.exports = router;
