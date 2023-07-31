const express = require("express");
const router = express.Router();
const { getRecords, addRecord } = require("../controllers/records");

router.route("/").get(getRecords).post(addRecord);

module.exports = router;
