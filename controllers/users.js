const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const InternalServerError = require("../errors/server-error");

const usersTable = "datawayfinder";

const getUsers = async (req, res) => {
  try {
    console.log(req.query);
    const { searchType, searchValue, limit = 50 } = req.query;
    _validateSearch(searchType, searchValue);
    let queryStatement = "";
    queryStatement = _getQuery(searchType, limit, searchValue);
    req.app.locals.db.query(queryStatement, _handelQueryResponse(res));
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

module.exports = { getUsers };
function _handelQueryResponse(res) {
  return function (err, recordset) {
    if (err) {
      console.error(err);
      throw new InternalServerError("SERVER ERROR");
    }
    res.status(StatusCodes.OK).json(recordset.recordset);
  };
}
