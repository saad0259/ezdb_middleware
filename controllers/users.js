const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const InternalServerError = require("../errors/server-error");
const sql = require("mssql");

const pool = require("../db/connection");

const usersTable = "datawayfinder";

const getUsers = async (req, res) => {
  try {
    const poolResult = await pool;
    const request = poolResult.request();
    console.log(req.query);
    const { searchType, searchValue, limit = 50 } = req.query;
    _validateSearch(searchType, searchValue);
    let queryStatement = "";
    queryStatement = _getQuery(searchType, limit, searchValue);

    const result = await request.query(queryStatement);
    res.status(StatusCodes.OK).json(result.recordset);
  } catch (error) {
    console.error("Error executing query", error);
    throw new BadRequestError("Something went wrong: " + error);
  }
};

function _getQuery(searchType, limit, searchValue) {
  let queryStatement = "";
  switch (searchType) {
    case "name":
      queryStatement = `SELECT TOP ${limit} * FROM ${usersTable} WHERE name LIKE '%${searchValue}%'`;
      break;
    case "address":
      queryStatement = `SELECT TOP ${limit} * FROM ${usersTable} WHERE address LIKE '%${searchValue}%'`;
      break;

    case "phone":
      queryStatement = `SELECT TOP ${limit} * FROM ${usersTable} WHERE tel1 LIKE '%${searchValue}%' OR tel2 LIKE '%${searchValue}%' OR tel3 LIKE '%${searchValue}%'`;
      break;

    case "ic":
      queryStatement = `SELECT TOP ${limit} * FROM ${usersTable} WHERE ic LIKE '%${searchValue}%'`;
      break;

    default:
      throw new BadRequestError("Invalid search type");
  }
  return queryStatement;
}

function _validateSearch(searchType, searchValue) {
  if (!searchType || !searchValue) {
    throw new BadRequestError("Invalid search type");
  }
}

const createUser = async (req, res) => {
  const { role, email, password } = req.body;
  const admin = req.admin;
  if (!role || !email || !password) {
    throw new BadRequestError("Please provide all required fields");
  } else {
    console.log("Creating user");
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
    });
    console.log("Created user", userRecord);

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: role });
    console.log("Set custom claims");

    res.status(StatusCodes.CREATED).json(userRecord);
  }
};

module.exports = { getUsers, createUser };
function _handelQueryResponse(res) {
  return function (err, recordset) {
    if (err) {
      console.error(err);
      throw new InternalServerError("SERVER ERROR");
    }
    res.status(StatusCodes.OK).json(recordset.recordset);
  };
}
