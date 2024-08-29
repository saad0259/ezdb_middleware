const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");
const crypto = require("crypto");
const axios = require("axios");

const pool = require("../db/connection");

const {
  paymentSuccessTemplate,
} = require("../assets/html_templates/payment_success_screen");
const {
  paymentFailTemplate,
} = require("../assets/html_templates/payment_fail_screen");

const paymentsTable = "ezdb_payments";
6;
const usersTable = "ezdb_users";

const createPaymentIntent = async (req, res) => {
  const { offer, userId, status, createdAt, phone } = req.body;

  if (!offer || !userId || !status || !createdAt || !phone) {
    throw new BadRequestError("Please provide all values");
  }

  const currentUrl = req.protocol + "://" + req.get("host");

  const poolResult = await pool;

  const id = crypto.randomBytes(16).toString("hex");
  const request = poolResult.request();
  await request
    .input("id", id)
    .input("offerId", offer.id)
    .input("offerName", offer.name)
    .input("offerPrice", offer.price)
    .input("offerDays", offer.days)
    .input("userId", userId)
    .input("status", status)
    .input("createdAt", createdAt)
    .input("sessionId", "")
    .input("isFreeTrial", offer.isFreeTrial ? true : false)
    .query(
      ` 
      INSERT INTO ${paymentsTable} (id, offerId, offerName, offerPrice, offerDays, userId, status, createdAt, sessionId, isFreeTrial)
      VALUES (@id, @offerId, @offerName, @offerPrice, @offerDays, @userId, @status, @createdAt, @sessionId, @isFreeTrial)
      `
    );

  if (offer.isFreeTrial) {
    //update usedFreeTrial property in users table
    offer.userId = userId;
    await _successfulPayment(poolResult, id, res, offer);
    await request
      .input("userId2", userId)
      .input("usedFreeTrial", true)
      .query(
        `UPDATE ${usersTable} SET usedFreeTrial = @usedFreeTrial WHERE id = @userId2`
      );

    return res.status(StatusCodes.OK).json({
      message: "Free Trial Successfully Created",
    });
  } else {
    const session = await createPaymentSession(
      currentUrl,
      id,
      offer,
      request,
      phone
    );
    return res.json({ url: session.url });
  }
};

const completePaymentIntent = async (req, res) => {
  const { id: paymentId } = req.params;

  try {
    if (!paymentId) {
      throw new BadRequestError("Please provide all values");
    }

    const poolResult = await pool;

    const request = poolResult.request();
    const result = await request
      .input("paymentId", paymentId)
      .query(`SELECT * FROM ${paymentsTable} WHERE id = @paymentId`);

    if (!result.recordset.length) {
      throw new NotFoundError("No such payment found");
    }
    const payment = result.recordset[0];

    if (payment.status === "paid") {
      return res
        .status(StatusCodes.OK)
        .send(paymentSuccessTemplate(paymentId, payment.offerPrice, date));
    }

    const secret = Buffer.from(`${process.env.BILLPLZ_SECRET}:`).toString(
      "base64"
    );

    const response = await axios.get(
      `${process.env.BILLPLZ_URL}/v3/bills/${payment.sessionId}`,
      {
        headers: {
          Authorization: `Basic ${secret}`,
        },
      }
    );
    const session = response.data;

    if (session.state === "paid") {
      var date = await _successfulPayment(poolResult, paymentId, res, payment);
    } else {
      await _failedPayment(poolResult, paymentId);
    }
  } catch (error) {
    console.log(error);
    var date = new Date();
    res
      .status(StatusCodes.OK)
      .send(paymentFailTemplate("", error, date.toDateString()));
  }
};

const getPaymentsByUserId = async (req, res) => {
  const { userId } = req.params;

  const poolResult = await pool;
  const request = poolResult.request();
  const result = await request
    .input("userId", userId)

    .query(
      `SELECT * FROM ${paymentsTable} WHERE userId = @userId ORDER BY createdAt DESC`
    );
  res.status(StatusCodes.OK).json(result.recordset);
};

module.exports = {
  createPaymentIntent,
  completePaymentIntent,
  getPaymentsByUserId,
};
async function createPaymentSession(currentUrl, id, offer, request, phone) {
  const webhookUrl = `${currentUrl}/api/v1/payments/${id}`;

  const url = `${process.env.BILLPLZ_URL}/v3/bills`;
  const collectionId = process.env.BILLPLZ_COLLECTION_ID;
  const secret = Buffer.from(`${process.env.BILLPLZ_SECRET}:`).toString(
    "base64"
  );

  const data = {
    collection_id: collectionId,
    description: offer.name,
    name: offer.name,
    amount: offer.price * 100,
    callback_url: webhookUrl,
    redirect_url: webhookUrl,
    mobile: phone,
    deliver: false,
  };

  const response = await axios.post(url, data, {
    headers: {
      Content_Type: "application/x-www-form-urlencoded",
      Authorization: `Basic ${secret}`,
    },
  });

  const session = response.data;

  //update sessionId in payment table
  await request
    .input("id2", id)
    .input("sessionId2", session.id)
    .query(
      `UPDATE ${paymentsTable} SET sessionId = @sessionId2 WHERE id = @id2`
    );
  return session;
}

async function _failedPayment(poolResult, paymentId) {
  const request = poolResult.request();
  await request
    .input("paymentId", paymentId)
    .query(
      `UPDATE ${paymentsTable} SET status = 'failed' WHERE id = @paymentId`
    );

  throw new NotFoundError("No such payment found");
}

async function _successfulPayment(poolResult, paymentId, res, offer) {
  const request = poolResult.request();

  const daysIncrement = offer.offerDays ?? offer.days;

  const userResult = await request
    .input("userId", offer.userId)
    .query(`SELECT * FROM ${usersTable} WHERE id = @userId`);

  if (!userResult.recordset.length) {
    throw new NotFoundError("No such user found");
  }

  var oldMemberShipExpiry = new Date(userResult.recordset[0].membershipExpiry);

  var newExpiryDate = new Date(oldMemberShipExpiry);
  newExpiryDate.setDate(newExpiryDate.getDate() + daysIncrement);

  newExpiryDate = newExpiryDate.toISOString();

  await request
    .input("membershipExpiry", newExpiryDate)
    .input("userId2", offer.userId)
    .query(
      `UPDATE ${usersTable} SET membershipExpiry = @membershipExpiry WHERE id = @userId2`
    );

  if (offer.isFreeTrial) {
    return;
  } else {
    await request
      .input("paymentId", paymentId)
      .query(
        `UPDATE ${paymentsTable} SET status = 'paid' WHERE id = @paymentId`
      );
    var date = new Date(offer.createdAt);
    return res
      .status(StatusCodes.OK)
      .send(paymentSuccessTemplate(paymentId, offer.offerPrice, date));
  }
}
