const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const InternalServerError = require("../errors/server-error");

const usersTable = "datawayfinder";

const getUsers = async (req, res) => {
  try {
    console.log(req.query);
    const { searchType, searchValue, limit = 50 } = req.query;
    _validateSearch(searchType, searchValue);

    switch (searchType) {
      case "name":
        req.app.locals.db.query(
          `SELECT TOP ${limit} * FROM ${usersTable} WHERE name LIKE '%${searchValue}%'`,
          _handelQueryResponse(res)
        );
        break;
      case "address":
        req.app.locals.db.query(
          `SELECT TOP ${limit} * FROM ${usersTable} WHERE address LIKE '%${searchValue}%'`,
          _handelQueryResponse(res)
        );

        break;

      case "phone":
        req.app.locals.db.query(
          `SELECT TOP ${limit} * FROM ${usersTable} WHERE tel1 LIKE '%${searchValue}%' OR tel2 LIKE '%${searchValue}%' OR tel3 LIKE '%${searchValue}%'`,
          _handelQueryResponse(res)
        );
        break;

      case "ic":
        req.app.locals.db.query(
          `SELECT TOP ${limit} * FROM ${usersTable} WHERE ic LIKE '%${searchValue}%'`,
          _handelQueryResponse(res)
        );
        break;

      default:
        throw new BadRequestError("Invalid search type");
    }
  } catch (error) {
    console.error("Error executing query", error);
    throw new BadRequestError("Something went wrong: " + error);
  }
};

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
