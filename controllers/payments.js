const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");
const crypto = require("crypto");

const pool = require("../db/connection");

const {
  paymentSuccessTemplate,
} = require("../assets/html_templates/payment_success_screen");
const {
  paymentFailTemplate,
} = require("../assets/html_templates/payment_fail_screen");

const paymentsTable = "payments";
const usersTable = "users";

const createPaymentIntent = async (req, res) => {
  const { offer, userId, status, createdAt } = req.body;
  const { stripe } = req;

  if (!offer || !userId || !status || !createdAt) {
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
        `UPDATE users SET usedFreeTrial = @usedFreeTrial WHERE id = @userId2`
      );

    return res.status(StatusCodes.OK).json({
      message: "Free Trial Successfully Created",
    });
  } else {
    const session = await createPaymentSession(
      currentUrl,
      id,
      stripe,
      offer,
      request
    );
    return res.json({ url: session.url });
  }
};

const completePaymentIntent = async (req, res) => {
  const { id: paymentId } = req.params;
  const { stripe } = req;

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

    const session = await stripe.checkout.sessions.retrieve(payment.sessionId);

    if (session.payment_status === "paid") {
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
async function createPaymentSession(currentUrl, id, stripe, offer, request) {
  const webhookUrl = `${currentUrl}/api/v1/payments/${id}`;

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "myr",
          unit_amount: offer.price * 100,
          product_data: {
            name: offer.name,
          },
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: webhookUrl,
    cancel_url: webhookUrl,
  });

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

  //get user by userId
  const userResult = await request
    .input("userId", offer.userId)
    .query(`SELECT * FROM users WHERE id = @userId`);
  var oldMemberShipExpiry = new Date(userResult.recordset[0].membershipExpiry);

  var newExpiryDate = new Date(oldMemberShipExpiry);
  newExpiryDate.setDate(newExpiryDate.getDate() + daysIncrement);

  newExpiryDate = newExpiryDate.toISOString();

  await request
    .input("membershipExpiry", newExpiryDate)
    .input("userId2", offer.userId)
    .query(
      `UPDATE users SET membershipExpiry = @membershipExpiry WHERE id = @userId2`
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
