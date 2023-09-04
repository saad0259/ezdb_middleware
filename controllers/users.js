const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const fetch = require("node-fetch");
const bcrypt = require("bcryptjs");

const sql = require("mssql");

const pool = require("../db/connection");

const usersTable = "users";
const searchesTable = "searches";
const membershipLogsTable = "user_membership_logs";

const getUsers = async (req, res) => {
  // get all users from the database

  const poolResult = await pool;
  const request = poolResult.request();

  const result = await request.query(`SELECT * FROM ${usersTable}`);
  res.status(StatusCodes.OK).json(result.recordset);
};

const getUserById = async (req, res) => {
  // get a single user from the database
  const poolResult = await pool;
  const request = poolResult.request();
  const { userId } = req.params;
  const result = await request.query(
    `SELECT * FROM ${usersTable} WHERE id = ${userId}`
  );

  if (result.recordset.length === 0) {
    throw new BadRequestError(`No user found`);
  }

  res.status(StatusCodes.OK).json(result.recordset);
};

const getUserSearches = async (req, res) => {
  // get all searches from the database for a user where offset is 0
  const poolResult = await pool;
  const request = poolResult.request();
  const { userId } = req.params;
  const result = await request.query(
    `SELECT * FROM ${searchesTable} WHERE userId = ${userId} AND offset = 0`
  );
  res.status(StatusCodes.OK).json(result.recordset);
};

const getAllSearches = async (req, res) => {
  // get all searches from the database for a user where offset is 0
  const poolResult = await pool;
  const request = poolResult.request();
  const result = await request.query(`select * from searches`);
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

const notifyUser = async (req, res, respond = true) => {
  const { title, body, token } = req.body;
  const { admin } = req;

  if (!title || !body || !token) {
    throw new BadRequestError("Please provide title, body and token");
  }

  console.log("admin.messaging()", admin.messaging());

  const payload = {
    notification: {
      title,
      body,
    },
  };

  const response = await admin.messaging().sendToDevice(token, payload);

  if (response.success) {
    console.log("Notification sent successfully");
  } else {
    console.log("Error sending notification:", response.error);
  }

  if (respond) {
    res.status(StatusCodes.OK).json(response);
  } else {
    return response;
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

module.exports = {
  getUsers,
  getUserById,
  getUserSearches,
  updateMembershipExpiry,
  getAllSearches,
  updateFcmToken,
  notifyUser,
  getMembershipLogs,
  deleteUser,
};
