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
  getMembershipLogs,
  deleteUser,
} = require("../controllers/users");

router.route("/:userId/membershipLogs").get(getMembershipLogs);
router.route("/searches").get(getAllSearches);
router.route("/:userId/searches").get(getUserSearches);
router.route("/:userId/notify").post(notifyUser);
router.route("/:userId/fcmToken").patch(updateFcmToken);
router.route("/:userId/membership").patch(updateMembershipExpiry);
router.route("/:userId").get(getUserById);
router.route("/").get(getUsers).delete(deleteUser);

module.exports = router;
