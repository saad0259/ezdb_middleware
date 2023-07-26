const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const moment = require("moment");

const sql = require("mssql");

const pool = require("../db/connection");

const usersTable = "users";
const searchesTable = "searches";

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
  const result = await request.query(`SELECT * FROM ${searchesTable}`);
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

  res.status(StatusCodes.OK).json({ message: "Membership updated" });
};

module.exports = {
  getUsers,
  getUserById,
  getUserSearches,
  updateMembershipExpiry,
  getAllSearches,
};
