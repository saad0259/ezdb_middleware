const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");

const pool = require("../db/connection");

const offersTable = "ezdb_offer";

const getOffers = async (req, res) => {
  try {
    const poolResult = await pool;

    const request = poolResult.request();

    const result = await request.query(`SELECT * FROM ${offersTable}`);

    res.status(StatusCodes.OK).json(result.recordset);
  } catch (error) {
    throw new BadRequestError("Something went wrong: " + error);
  }
};

const createOffer = async (req, res) => {
  const { name, days, price, isActive = true } = req.body;

  switch (true) {
    case !name:
      throw new BadRequestError("Name is required");
    case !days:
      throw new BadRequestError("Days is required");
    case !price:
      throw new BadRequestError("Price is required");
  }

  try {
    const poolResult = await pool;
    const request = poolResult.request();
    await request.query(
      `INSERT INTO ${offersTable} (name, days, price, isActive) VALUES ('${name}', '${days}', '${price}', '${isActive}')`
    );
    res.status(StatusCodes.CREATED).json({ message: "Offer created" });
  } catch (error) {
    throw new BadRequestError("Something went wrong: " + error);
  }
};

const updateOffer = async (req, res) => {
  const { name, days, price, isActive } = req.body;
  const { id } = req.params;

  switch (true) {
    case !name:
      throw new BadRequestError("Name is required");
    case !days:
      throw new BadRequestError("Days is required");
    case !price:
      throw new BadRequestError("Price is required");
    // case !isActive:
    //   throw new BadRequestError("isActive is required");
  }

  try {
    const poolResult = await pool;
    const request = poolResult.request();
    await request.query(
      `UPDATE ${offersTable} SET name = '${name}', days = '${days}', price = '${price}', isActive='${isActive}' WHERE id = ${id}`
    );
    res.status(StatusCodes.OK).json({ message: "Offer updated" });
  } catch (error) {
    throw new BadRequestError("Something went wrong: " + error);
  }
};

const deleteOffer = async (req, res) => {
  const { id } = req.params;

  try {
    const poolResult = await pool;
    const request = poolResult.request();
    await request.query(`DELETE FROM ${offersTable} WHERE id = ${id}`);
    res.status(StatusCodes.OK).json({ message: "Offer deleted" });
  } catch (error) {
    throw new NotFoundError("Offer not found");
  }
};

module.exports = { getOffers, createOffer, updateOffer, deleteOffer };
