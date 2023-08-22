const express = require("express");
const router = express.Router();

const {
  getLogs,
  getLogsById,
  createLog,
} = require("../controllers/admin_logs");

router.route("/:id").get(getLogsById);
router.route("/").get(getLogs).post(createLog);

module.exports = router;
