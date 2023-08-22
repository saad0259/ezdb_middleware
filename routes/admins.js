const express = require("express");
const router = express.Router();

const {
  createAdmin,
  updateAdmin,
  deleteAdmin,
} = require("../controllers/admins");

router.route("/").post(createAdmin);
router.route("/:id").patch(updateAdmin).delete(deleteAdmin);

module.exports = router;
