const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { UnauthenticatedError } = require("../errors");

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthenticatedError("Please provide an authorization token");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // attach user to the rest of routes
    req.user = {
      userId: decoded.id,
      name: decoded.name,
      isAdmin: decoded.isAdmin,
    };
    next();
  } catch (error) {
    throw new UnauthenticatedError("Invalid token");
  }
};

module.exports = auth;
