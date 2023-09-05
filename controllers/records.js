const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const sql = require("mssql");
const Excel = require("exceljs");

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
  return result;
}
function _getCountQuery(searchType, searchValue, postcode) {
  let queryStatement = "";
  switch (searchType) {
    case "name":
      queryStatement = `SELECT COUNT(*) FROM ${recordsTable} WHERE name ='${searchValue}'`;
      break;
    case "address":
      searchValue = searchValue.replaceAll(" ", "%");
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
      queryStatement = `SELECT * FROM ${recordsTable} WHERE name ='${searchValue}' ORDER BY ic OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      break;
    case "address":
      searchValue = searchValue.replaceAll(" ", "%");
      queryStatement = `SELECT * FROM ${recordsTable} WHERE address LIKE '%${searchValue}%' AND postcode = '${
        postcode == undefined ? "" : postcode
      }' ORDER BY ic OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      break;
    case "phone":
      queryStatement = `SELECT * FROM ${recordsTable} WHERE tel1 = '${searchValue}' OR tel2 = '${searchValue}' OR tel3 = '${searchValue}' ORDER BY ic OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      break;

    case "ic":
      queryStatement = `SELECT * FROM ${recordsTable} WHERE ic = '${searchValue}' ORDER BY ic OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
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

const addRecord = async (req, res) => {
  try {
    const file = req.file;

    const poolResult = await pool;
    const request = poolResult.request();

    //validate file type
    if (!file.originalname.match(/\.(xlsx)$/)) {
      throw new BadRequestError("Invalid file type");
    }

    const workbook = new Excel.Workbook();
    const records = [];
    await workbook.xlsx.load(file.buffer).then((workbook) => {
      const worksheet = workbook.getWorksheet(1);
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const record = {
            name: row.getCell(1).value,
            ic: row.getCell(2).value,
            tel1: row.getCell(3).value,
            tel2: row.getCell(4).value,
            tel3: row.getCell(5).value,
            postcode: row.getCell(6).value,
            address: row.getCell(7).value,
          };
          records.push(record);
        }
      });
    });
    //convert to string if number and not null
    records.forEach((record) => {
      Object.keys(record).forEach((key) => {
        if (record[key] && typeof record[key] === "number") {
          record[key] = record[key].toString();
        }
        //trim to 5 if postcode and not null
        if (record[key] && key === "postcode") {
          record[key] = record[key].toString().substring(0, 5);
        }
        if (record[key] && key === "ic") {
          record[key] = record[key].toString().substring(0, 12);
        }
      });
    });

    const columnNames = Object.keys(records[0]);

    const columns = columnNames.map((columnName) => {
      return {
        name: columnName,
        type: getColumnType(columnName),
      };
    });

    const table = new sql.Table(recordsTable);
    columns.forEach((column) => {
      table.columns.add(column.name, column.type, {
        nullable: true,
      });
    });

    records.forEach((record) => {
      table.rows.add(
        record.name,
        record.ic,
        record.tel1,
        record.tel2,
        record.tel3,
        record.postcode,
        record.address
      );
    });

    await request.bulk(table);
    res.status(StatusCodes.OK).json({ message: "Records added successfully" });
  } catch (error) {
    throw new BadRequestError(error);
  }
};

function getColumnType(columnName) {
  switch (columnName) {
    case "name":
      return sql.VarChar(70);
    case "ic":
      return sql.VarChar(15);
    case "tel1":
      return sql.VarChar(255);
    case "tel2":
      return sql.VarChar(255);
    case "tel3":
      return sql.VarChar(255);
    case "address":
      return sql.VarChar(150);
    case "postcode":
      return sql.VarChar(5);
    default:
      return sql.VarChar(255);
  }
}

module.exports = { getRecords, addRecord };
