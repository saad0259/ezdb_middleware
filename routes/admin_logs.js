const express = require("express");
const router = express.Router();

const { getLogs, createLog } = require("../controllers/admin_logs");

router.route("/").get(getLogs).post(createLog);

module.exports = router;
