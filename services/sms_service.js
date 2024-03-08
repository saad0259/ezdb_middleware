const axios = require("axios");
require("dotenv").config();

const generateRandomString = () => {
  const characters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomString = "";
  for (let i = 0; i < 12; i++) {
    randomString += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }
  return randomString;
};

const sendSMS = async (recipient, message) => {
  const referenceID = generateRandomString();
  // https://www.wondermary.com/api/sendsms.php?email=peterlife89@gmail.com&key=12502384f5948cfa178ee57aaab54a55&recipient=60166666872&message=Your app register code is 132-234&referenceID=a7hg89w3b18g
  const options = {
    method: "GET",
    url: "https://www.wondermary.com/api/sendsms.php",
    params: {
      email: process.env.WONDERMARY_EMAIL,
      key: process.env.WONDERMARY_KEY,
      recipient,
      message,
      referenceID,
    },
  };

  // console.log(options);

  const response = await axios(options);
  return response;
};

const sendOTP = async (recipient, otp) => {
  // const otpWithDashes = otp.slice(0, 3) + "-" + otp.slice(3);
  // const message = `Your verification code is ${otpWithDashes}.
  //  Please enter this code in our app to confirm your identity.
  //   Do not share this code with anyone.`;
  // const response = await sendSMS(recipient, message);
  // return response;
};

module.exports = { sendOTP };
