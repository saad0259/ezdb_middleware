const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const pool = require("../db/connection");

const { notifyUser } = require("./users");

const { sendOTP } = require("../services/sms_service");

const sql = require("mssql");

const { validateUser } = require("../models/User");

const usersTable = "users";
const otpTable = "otp";

const register = async (req, res) => {
  const { phone, password } = req.body;
  // validate user
  await validateUser(req, res);

  const poolInstance = await pool;
  const request = poolInstance.request();

  //check if user already exists
  await _preventDuplicateUser(request, phone);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  await _createUser(request, phone, hashedPassword);

  const options = {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  };
  const otp = otpGenerator.generate(6, options);

  await request
    .input("otpPhone", sql.VarChar, phone)
    .input("otp", sql.VarChar, otp)
    .input("otpCreatedAt", sql.DateTime, new Date())
    .query(
      `INSERT INTO ${otpTable} (phone, otp, createdAt) VALUES (@otpPhone,
            @otp, @otpCreatedAt)`
    );

  await sendOTP(phone, otp);

  res.status(StatusCodes.CREATED).json({
    message: "User created successfully",
  });
};

const verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;

  const poolInstance = await pool;
  const request = poolInstance.request();

  const user = await _checkIfUserExists(request, phone);

  const otpResult = await request
    .input("otpphone", sql.VarChar, phone)
    .input("otp", sql.VarChar, otp)
    .query(`SELECT * FROM ${otpTable} WHERE phone = @otpphone AND otp = @otp`);

  if (otpResult.recordset.length > 0) {
    //check if otp is expired
    const otpCreatedAt = otpResult.recordset[0].createdAt;
    const otpCreatedAtPlus5 = new Date(otpCreatedAt.getTime() + 5 * 60000);
    const now = new Date();

    if (now > otpCreatedAtPlus5) {
      throw new BadRequestError("OTP expired");
    }

    //set isVerified to true
    await request
      .input("phone", sql.VarChar, phone)
      .query(`UPDATE ${usersTable} SET isVerified = 1 WHERE phone = @phone`);

    //delete otp
    await request

      .input("otpphone2", sql.VarChar, phone)
      .query(`DELETE FROM ${otpTable} WHERE phone = @otpphone2`);

    //create token
    const token = _createJWT(user);

    const userData = {
      id: user.recordset[0].id,
      phone: user.recordset[0].phone,
      membershipExpiry: user.recordset[0].membershipExpiry,
    };

    res.status(StatusCodes.OK).json({
      message: "OTP verified successfully",
      data: {
        token,
        ...userData,
      },
    });
  } else {
    throw new BadRequestError("Invalid OTP");
  }
};

const resendOtp = async (req, res) => {
  const { phone } = req.body;

  const poolInstance = await pool;
  const request = poolInstance.request();

  //check if user exists for the phone
  await _checkIfUserExists(request, phone);

  const otpResult = await request
    .input("otpphone", sql.VarChar, phone)
    .query(`SELECT * FROM ${otpTable} WHERE phone = @otpphone`);

  if (otpResult.recordset.length > 0) {
    //check if otp was created less than a minute ago
    _checkOtpDelay(otpResult);

    //delete otp
    await request
      .input("otpphone2", sql.VarChar, phone)
      .query(`DELETE FROM ${otpTable} WHERE phone = @otpphone2`);
  }

  const options = {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  };
  const otp = otpGenerator.generate(6, options);

  await request
    .input("otpphone3", sql.VarChar, phone)
    .input("otp", sql.VarChar, otp)
    .input("otpCreatedAt", sql.DateTime, new Date())
    .query(
      `INSERT INTO ${otpTable} (phone, otp, createdAt) VALUES (@otpphone3,
            @otp, @otpCreatedAt)`
    );

  await sendOTP(phone, otp);

  res.status(StatusCodes.OK).json({
    message: "OTP sent successfully",
  });
};

const login = async (req, res) => {
  const { phone, password, fcmToken } = req.body;

  const { admin } = req;

  _validateLoginReq(phone, password, fcmToken);

  const poolInstance = await pool;
  const request = poolInstance.request();

  const user = await request
    .input("userPhone", sql.VarChar, phone)
    .query(`SELECT * FROM ${usersTable} WHERE phone = @userPhone`);

  if (user.recordset.length === 0) {
    throw new NotFoundError("User not found");
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.recordset[0].password
  );

  if (!isPasswordValid) {
    throw new BadRequestError("Invalid password");
  }

  //check if user is verified
  if (!user.recordset[0].isVerified) {
    throw new BadRequestError("User not verified");
  }

  //check membershipExpiry date
  const membershipExpiry = user.recordset[0].membershipExpiry;
  const now = new Date();

  if (now > membershipExpiry) {
    throw new BadRequestError("Membership expired");
  }

  const token = _createJWT(user);

  console.log("old fcmToken is", user.recordset[0].fcmToken);

  if (
    fcmToken !== user.recordset[0].fcmToken &&
    user.recordset[0].fcmToken.length > 0
  ) {
    try {
      const reqData = {
        body: {
          title: "Forced Logout",
          body: "Another device logged in to this account",
          token: user.recordset[0].fcmToken,
        },
        admin,
      };
      await notifyUser(reqData, false);
    } catch (error) {
      console.log("error is", error);
    }
    //send logout notification
    console.log("new phone");
  }

  //add fcmToken and token to user
  await request
    .input("userPhone2", sql.VarChar, phone)
    .input("fcmToken", sql.VarChar, fcmToken)
    .input("token", sql.VarChar, token)
    .query(
      `UPDATE ${usersTable} SET fcmToken = @fcmToken, authToken = @token WHERE phone = @userPhone2`
    );

  const userData = {
    id: user.recordset[0].id,
    phone: user.recordset[0].phone,
    membershipExpiry: user.recordset[0].membershipExpiry,
  };

  res.status(StatusCodes.OK).json({
    message: "User logged in successfully",
    data: {
      token,
      ...userData,
    },
  });
};

const forgotPassword = async (req, res) => {
  const { phone } = req.body;

  const poolInstance = await pool;
  const request = poolInstance.request();

  await _checkIfUserExists(request, phone);

  //check if otp already exists
  const otpResult = await request

    .input("otpphone", sql.VarChar, phone)
    .query(`SELECT * FROM ${otpTable} WHERE phone = @otpphone`);

  if (otpResult.recordset.length > 0) {
    //check if otp was created less than a minute ago
    _checkOtpDelay(otpResult);

    //delete otp
    await request
      .input("otpphone2", sql.VarChar, phone)
      .query(`DELETE FROM ${otpTable} WHERE phone = @otpphone2`);
  }

  const options = {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  };
  const otp = otpGenerator.generate(6, options);

  await request
    .input("otpphone3", sql.VarChar, phone)
    .input("otp", sql.VarChar, otp)
    .input("otpCreatedAt", sql.DateTime, new Date())
    .query(
      `INSERT INTO ${otpTable} (phone, otp, createdAt) VALUES (@otpphone3,
            @otp, @otpCreatedAt)`
    );

  await sendOTP(phone, otp);

  res.status(StatusCodes.OK).json({
    message: "OTP sent successfully",
  });
};

const resetPassword = async (req, res) => {
  const { phone, otp, password } = req.body;

  _verifyResetPasswordReq(phone, otp, password);

  const poolInstance = await pool;
  const request = poolInstance.request();

  await _checkIfUserExists(request, phone);

  const otpResult = await request
    .input("otpphone", sql.VarChar, phone)
    .input("otp", sql.VarChar, otp)
    .query(`SELECT * FROM ${otpTable} WHERE phone = @otpphone AND otp = @otp`);

  if (otpResult.recordset.length > 0) {
    //check if otp is expired
    const otpCreatedAt = otpResult.recordset[0].createdAt;
    const otpCreatedAtPlus5 = new Date(otpCreatedAt.getTime() + 5 * 60000);
    const now = new Date();

    if (now > otpCreatedAtPlus5) {
      throw new BadRequestError("OTP expired");
    }

    //set password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await request
      .input("phone", sql.VarChar, phone)
      .input("password", sql.VarChar, hashedPassword)
      .query(
        `UPDATE ${usersTable} SET password = @password WHERE phone = @phone`
      );

    //delete otp
    await request

      .input("otpphone2", sql.VarChar, phone)
      .query(`DELETE FROM ${otpTable} WHERE phone = @otpphone2`);

    res.status(StatusCodes.OK).json({
      message: "Password reset successfully",
    });
  } else {
    throw new BadRequestError("Invalid OTP");
  }
};

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
};

function _verifyResetPasswordReq(phone, otp, password) {
  switch (true) {
    case !phone:
      throw new BadRequestError("Phone is required");
    case !otp:
      throw new BadRequestError("OTP is required");
    case !password:
      throw new BadRequestError("Password is required");
  }
}

function _checkOtpDelay(otpResult) {
  const otpCreatedAt = otpResult.recordset[0].createdAt;
  const otpCreatedAtPlus1 = new Date(otpCreatedAt.getTime() + 1 * 60000);
  const now = new Date();

  if (now < otpCreatedAtPlus1) {
    throw new BadRequestError("OTP already sent. Please wait for 1 minute");
  }
}

async function _checkIfUserExists(request, phone) {
  const user = await request

    .input("userphone", sql.VarChar, phone)
    .query(`SELECT * FROM ${usersTable} WHERE phone = @userphone`);

  if (user.recordset.length === 0) {
    throw new BadRequestError("User not found");
  }
  return user;
}

function _createJWT(user) {
  return jwt.sign(
    {
      id: user.recordset[0].id,
      phone: user.recordset[0].phone,
      membershipExpiry: user.recordset[0].membershipExpiry,
      role: "user",
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

async function _createUser(request, phone, hashedPassword) {
  const today = new Date().toISOString();
  return await request
    .input("phone", sql.VarChar, phone)
    .input("password", sql.VarChar, hashedPassword)
    .input("membershipExpiry", sql.VarChar, today)
    .input("createdAt", sql.VarChar, today)
    .query(
      `INSERT INTO ${usersTable} ( phone, password, membershipExpiry, createdAt) VALUES (
            @phone, @password, @membershipExpiry, @createdAt)`
    );
}

async function _preventDuplicateUser(request, userPhone) {
  const user = await request
    .input("userPhone", sql.VarChar, userPhone)
    .query(`SELECT * FROM ${usersTable} WHERE phone = @userPhone`);

  if (user.recordset.length > 0 && user.recordset[0].isVerified) {
    throw new BadRequestError("User already exists");
  }
  if (user.recordset.length > 0 && !user.recordset[0].isVerified) {
    //delete old otp
    await request

      .input("otpphone2", sql.VarChar, userPhone)
      .query(`DELETE FROM ${otpTable} WHERE phone = @otpphone2`);

    //delete old user
    await request
      .input("userPhone2", sql.VarChar, userPhone)
      .query(`DELETE FROM ${usersTable} WHERE phone = @userPhone2`);
  }

  return user;
}

_validateLoginReq = (phone, password, fcmToken) => {
  switch (true) {
    case !phone:
      throw new BadRequestError("Phone is required");
    case !password:
      throw new BadRequestError("Password is required");
    case !fcmToken:
      throw new BadRequestError("FCM Token is required");
  }
};
