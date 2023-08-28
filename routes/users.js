const express = require("express");
const router = express.Router();

const {
  getUsers,
  getUserById,
  getUserSearches,
  updateMembershipExpiry,
  getAllSearches,
  updateFcmToken,
  notifyUser,
} = require("../controllers/users");

router.route("/searches").get(getAllSearches);
router.route("/:userId/notify").post(notifyUser);
router.route("/:userId/fcmToken").patch(updateFcmToken);
router.route("/:userId/membership").patch(updateMembershipExpiry);
router.route("/:userId").get(getUserById);
router.route("/").get(getUsers);

module.exports = router;
