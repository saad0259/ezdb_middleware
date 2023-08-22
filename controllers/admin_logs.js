const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");

const sql = require("mssql");

const pool = require("../db/connection");

const logsTable = "admin_logs";

const getLogs = async (req, res) => {
  try {
    const poolResult = await pool;

    const request = poolResult.request();

    const result = await request.query(`SELECT * FROM ${logsTable} `);

    res.status(StatusCodes.OK).json(result.recordset);
  } catch (error) {
    throw new BadRequestError("Something went wrong: " + error);
  }
};

const getLogsById = async (req, res) => {
  const { id } = req.params;

  try {
    const poolResult = await pool;

    const request = poolResult.request();

    const result = await request.query(
      `SELECT * FROM ${logsTable} WHERE 
      createdBy = '${id}'`
    );

    res.status(StatusCodes.OK).json(result.recordset);
  } catch (error) {
    throw new BadRequestError("Something went wrong: " + error);
  }
};

const createLog = async (req, res) => {
  const { adminId, content } = req.body;

  switch (true) {
    case !adminId:
      throw new BadRequestError("Admin Id is required");
    case !content:
      throw new BadRequestError("Content is required");
  }

  const createdAt = new Date().toISOString();

  try {
    const poolResult = await pool;
    const request = poolResult.request();
    await request.query(
      `INSERT INTO ${logsTable} (createdBy, contents, createdAt) VALUES ('${adminId}', '${content}', '${createdAt}')`
    );

    res.status(StatusCodes.OK).json({ message: "Log added" });
  } catch (error) {
    throw new BadRequestError("Something went wrong: " + error);
  }
};

module.exports = { getLogs, createLog, getLogsById };
