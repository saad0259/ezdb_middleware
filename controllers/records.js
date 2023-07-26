const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const sql = require("mssql");

const pool = require("../db/connection");

const recordsTable = "table_1";
const searchesTable = "searches";

const getRecords = async (req, res) => {
  try {
    const poolResult = await pool;

    const request = poolResult.request();
    const {
      searchType,
      searchValue,
      limit = 20,
      offset,
      userId,
      postcode,
    } = req.query;
    _validateSearch(searchType, searchValue, offset, userId);
    let queryStatement = "";
    queryStatement = _getQuery(
      searchType,
      limit,
      offset,
      searchValue,
      postcode
    );
    let countStatement = _getCountQuery(searchType, searchValue, postcode);
    const result = await request.query(queryStatement);
    const countResult = await request.query(countStatement);

    await addSearchRecord(
      request,
      searchType,
      searchValue,
      limit,
      userId,
      offset,
      postcode,
      req
    );
    res
      .status(StatusCodes.OK)
      .json({ data: result.recordset, count: countResult.recordset[0][""] });
  } catch (error) {
    throw new BadRequestError("Something went wrong: " + error);
  }
};

async function addSearchRecord(
  request,
  searchType,
  searchValue,
  limit,
  userId,
  offest,
  postcode,
  req
) {
  const searchDoc = {
    searchType,
    searchValue,
    postcode: postcode == undefined ? "" : postcode,
    limit,
    userId,
    offset: offest,
    createdAt: new Date(),
  };

  const queryStatement = `INSERT INTO ${searchesTable} (searchType, searchValue, postcode, limit, userId, offset, createdAt) VALUES ('${searchType}', '${searchValue}', '${
    postcode == undefined ? "" : postcode
  }', ${limit}, ${userId}, ${offest}, '${new Date().toISOString()}')`;
  const result = await request.query(queryStatement);
  // console.log("result", result);
  return result;
}
function _getCountQuery(searchType, searchValue, postcode) {
  let queryStatement = "";
  switch (searchType) {
    case "name":
      queryStatement = `SELECT COUNT(*) FROM ${recordsTable} WHERE name ='${searchValue}'`;
      break;
    case "address":
      queryStatement = `SELECT COUNT(*) FROM ${recordsTable} WHERE address LIKE '%${searchValue}%' AND postcode = '${
        postcode == undefined ? "" : postcode
      }'`;
      break;

    case "phone":
      queryStatement = `SELECT COUNT(*) FROM ${recordsTable} WHERE tel1 = '${searchValue}' OR tel2 = '${searchValue}' OR tel3 = '${searchValue}'`;
      break;

    case "ic":
      queryStatement = `SELECT COUNT(*) FROM ${recordsTable} WHERE ic = '${searchValue}'`;
      break;

    default:
      throw new BadRequestError("Invalid search type");
  }
  return queryStatement;
}

function _getQuery(searchType, limit, offset, searchValue, postcode) {
  let queryStatement = "";
  switch (searchType) {
    case "name":
      // queryStatement = `SELECT TOP ${limit} * FROM ${usersTable} WHERE name ='${searchValue}'`;
      //implement pagination
      queryStatement = `SELECT * FROM ${recordsTable} WHERE name ='${searchValue}' ORDER BY id OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      break;
    case "address":
      queryStatement = `SELECT * FROM ${recordsTable} WHERE address LIKE '%${searchValue}%' AND postcode = '${
        postcode == undefined ? "" : postcode
      }' ORDER BY id OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      break;
    case "phone":
      queryStatement = `SELECT * FROM ${recordsTable} WHERE tel1 = '${searchValue}' OR tel2 = '${searchValue}' OR tel3 = '${searchValue}' ORDER BY id OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      break;

    case "ic":
      queryStatement = `SELECT * FROM ${recordsTable} WHERE ic = '${searchValue}' ORDER BY id OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      break;

    default:
      throw new BadRequestError("Invalid search type");
  }
  return queryStatement;
}

function _validateSearch(searchType, searchValue, offset, userId) {
  if (!searchType || !searchValue || !userId || !offset) {
    throw new BadRequestError("Invalid Request Parameters");
  }
}

module.exports = { getRecords };
