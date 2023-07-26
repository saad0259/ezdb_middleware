const express = require("express");
const router = express.Router();

const {
  getUsers,
  getUserById,
  getUserSearches,
  updateMembershipExpiry,
  getAllSearches,
} = require("../controllers/users");

router.route("/").get(getUsers);
router.route("/:userId").get(getUserById);
router.route("/searches").get(getAllSearches);
router.route("/:userId/searches").get(getUserSearches);
router.route("/:userId/membership").patch(updateMembershipExpiry);

module.exports = router;
