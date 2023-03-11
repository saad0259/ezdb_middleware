const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const InternalServerError = require("../errors/server-error");

const usersTable = "datawayfinder";

const getUsers = async (req, res) => {
  try {
    console.log(req.query);
    const { searchType, searchValue, limit = 50 } = req.query;
    _validateSearch(searchType, searchValue);
    let query = "";
    query = _getQuery(searchType, query, limit, searchValue);
    req.app.locals.db.query(query, _handelQueryResponse(res));
  } catch (error) {
    console.error("Error executing query", error);
    throw new BadRequestError("Something went wrong: " + error);
  }
};

function _getQuery(searchType, query, limit, searchValue) {
  switch (searchType) {
    case "name":
      query = `SELECT TOP ${limit} * FROM ${usersTable} WHERE name LIKE '%${searchValue}%'`;
      break;
    case "address":
      query = `SELECT TOP ${limit} * FROM ${usersTable} WHERE address LIKE '%${searchValue}%'`;
      break;

    case "phone":
      query = `SELECT TOP ${limit} * FROM ${usersTable} WHERE tel1 LIKE '%${searchValue}%' OR tel2 LIKE '%${searchValue}%' OR tel3 LIKE '%${searchValue}%'`;
      break;

    case "ic":
      query = `SELECT TOP ${limit} * FROM ${usersTable} WHERE ic LIKE '%${searchValue}%'`;
      break;

    default:
      throw new BadRequestError("Invalid search type");
  }
  return query;
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
