const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const jwt = require("jsonwebtoken");

const bcrypt = require("bcryptjs");

const pool = require("../db/connection");

const usersTable = "ezdb_users";
const searchesTable = "ezdb_searches";
const allowedUsersTable = "ezdb_allowed_users";
const membershipLogsTable = "ezdb_user_membership_logs";

const getUsers = async (req, res) => {
  // get all users from the database

  const poolResult = await pool;
  const request = poolResult.request();

  const result = await request.query(
    `SELECT * FROM ${usersTable} order by createdAt desc`
  );
  res.status(StatusCodes.OK).json(result.recordset);
};

const getUserById = async (req, res) => {
  // get a single user from the database
  const poolResult = await pool;
  const request = poolResult.request();
  let authToken = req.headers.authorization;
  const userdata = await decodeToken(req, res);
  const { id } = userdata;
  if (!authToken) {
    throw new BadRequestError(`Authorization header is missing`);
  }
  authToken = authToken.split(" ")[1];

  const result = await request.query(
    `SELECT * FROM ${usersTable} WHERE id = ${id}`
  );

  if (result.recordset.length === 0) {
    throw new BadRequestError(`No user found`);
  }

  if (authToken !== result.recordset[0].authToken) {
    throw new BadRequestError(`Invalid auth token`);
  }

  res.status(StatusCodes.OK).json(result.recordset);
};

const getUserSearches = async (req, res) => {
  // get all searches from the database for a user where offset is 0
  const poolResult = await pool;
  const request = poolResult.request();
  const { userId } = req.params;
  const result = await request.query(
    `SELECT * FROM ${searchesTable} WHERE userId = ${userId} AND offset = 0 ORDER BY createdAt DESC`
  );
  res.status(StatusCodes.OK).json(result.recordset);
};

const getAllSearches = async (req, res) => {
  // get all searches from the database for a user where offset is 0
  const poolResult = await pool;
  const request = poolResult.request();
  const result = await request.query(
    `select * from searches ORDER BY createdAt DESC`
  );
  res.status(StatusCodes.OK).json(result.recordset);
};

const updateMembershipExpiry = async (req, res) => {
  const poolResult = await pool;
  const request = poolResult.request();
  const { userId } = req.params;
  const { membershipExpiry } = req.body;

  await request.query(
    `UPDATE ${usersTable} SET membershipExpiry = '${membershipExpiry}' WHERE id = ${userId}`
  );

  await _addMembershipLog(req, res);

  res.status(StatusCodes.OK).json({ message: "Membership updated" });
};

const updateFcmToken = async (req, res) => {
  const poolResult = await pool;
  const request = poolResult.request();
  const { userId } = req.params;
  const { fcmToken } = req.body;

  if (!fcmToken) {
    throw new BadRequestError("FCM Token is required");
  }

  await request.query(
    `UPDATE ${usersTable} SET fcmToken = '${fcmToken}' WHERE id = ${userId}`
  );

  res.status(StatusCodes.OK).json({ message: "FCM Token updated" });
};

const deleteUser = async (req, res) => {
  const poolResult = await pool;
  const request = poolResult.request();
  const { phone, password } = req.body;

  if (!phone || !password) {
    throw new BadRequestError("Please provide phone and password");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await request.query(
    `SELECT * FROM ${usersTable} WHERE phone = '${phone}'`
  );

  if (user.recordset.length === 0) {
    throw new BadRequestError(`No user found`);
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.recordset[0].password
  );

  if (!isPasswordValid) {
    throw new BadRequestError("Invalid password");
  }

  const userId = user.recordset[0].id;

  await request.query(`DELETE FROM ${usersTable} WHERE id = ${userId}`);

  res.status(StatusCodes.OK).json({ message: "User deleted" });
};

const notifyEveryone = async (req, res) => {
  //send notification on topic allusers
  const { admin } = req;

  const { title, body } = req.body;

  if (!title || !body) {
    throw new BadRequestError("Please provide all values");
  }
  const payload = {
    notification: {
      title,
      body,
    },
  };

  const topic = "allusers";

  await admin
    .messaging()
    .sendToTopic(topic, payload)
    .then(function (response) {
      // console.log("Successfully sent message:", response);
    })
    .catch(function (error) {
      console.log("Error sending message:", error);
    });

  res.status(StatusCodes.OK).json({ msg: "Notification sent" });
};
const notifyUser = async (req, res, respond = true) => {
  //send notification on topic userId
  const { admin } = req;
  const { title, body } = req.body;
  const { userId } = req.params;

  const payload = {
    notification: {
      title,
      body,
    },
  };
  const topic = userId.toString();

  await admin
    .messaging()
    .sendToTopic(topic, payload)
    .then(function (response) {
      console.log("Successfully sent message:", response);
    })
    .catch(function (error) {
      console.log("Error sending message:", error);
    });
  if (respond) {
    res.status(StatusCodes.OK).json({ msg: "Notification sent" });
  } else {
    return;
  }
};

const _addMembershipLog = async (req, res) => {
  const { userId } = req.params;
  const { membershipExpiry } = req.body;

  if (!membershipExpiry) {
    throw new BadRequestError("Please provide membershipExpiry and adminId");
  }

  const createdAt = new Date().toISOString();

  const poolResult = await pool;
  const request = poolResult.request();

  await request.query(
    `INSERT INTO ${membershipLogsTable} (userId, membershipExpiry,  createdAt) VALUES ('${userId}', '${membershipExpiry}', '${createdAt}')`
  );

  return;
};

const getMembershipLogs = async (req, res) => {
  const { userId } = req.params;

  const poolResult = await pool;
  const request = poolResult.request();

  const result = await request.query(
    `SELECT * FROM ${membershipLogsTable} WHERE userId = ${userId} ORDER BY createdAt DESC`
  );

  res.status(StatusCodes.OK).json(result.recordset);

  return;
};

const addUserToAllowedList = async (req, res) => {
  const poolResult = await pool;
  const request = poolResult.request();

  const { phone } = req.params;

  if (!phone) {
    throw new BadRequestError("Please provide phone");
  }

  //check duplication
  const result = await request.query(
    `SELECT * FROM ${allowedUsersTable} WHERE phone = '${phone}'`
  );

  if (result.recordset.length > 0) {
    throw new BadRequestError("User already exists in allowed list");
  }

  await request.query(
    `INSERT INTO ${allowedUsersTable} (phone) VALUES ('${phone}')`
  );

  res
    .status(StatusCodes.OK)
    .json({ message: "New User added to allowed list" });
};

const getAllowedUsers = async (req, res) => {
  const poolResult = await pool;
  const request = poolResult.request();

  const result = await request.query(`SELECT * FROM ${allowedUsersTable}`);

  return res.status(StatusCodes.OK).json(result.recordset);
};

const deleteAllowedUser = async (req, res) => {
  const poolResult = await pool;
  const request = poolResult.request();

  const { phone } = req.params;
  if (!phone) {
    throw new BadRequestError("Please provide phone");
  }

  await request.query(
    `DELETE FROM ${allowedUsersTable} WHERE phone = '${phone}'`
  );

  res
    .status(StatusCodes.OK)
    .json({ message: "User deleted from allowed list" });
};
module.exports = {
  getUsers,
  getUserById,
  getUserSearches,
  updateMembershipExpiry,
  getAllSearches,
  updateFcmToken,
  notifyUser,
  notifyEveryone,
  getMembershipLogs,
  deleteUser,
  getAllowedUsers,
  addUserToAllowedList,
  deleteAllowedUser,
};

const decodeToken = async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  req.userData = decodedToken;
  return decodedToken;
};
