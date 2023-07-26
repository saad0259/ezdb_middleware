const { checkSchema } = require("express-validator");
const { BadRequestError } = require("../errors");

const User = checkSchema({
  phone: {
    isMobilePhone: true,
    errorMessage: "Invalid phone number",
  },
  password: {
    isLength: {
      errorMessage: "Password should be at least 6 chars long",
      options: { min: 6 },
    },
  },
});

const validateUser = async (req, res, next) => {
  const result = await User.run(req);

  let errors = [];

  if (result.length > 0) {
    result.forEach((err) => {
      try {
        if (err.errors.length > 0 && err.errors[0] != undefined) {
          errors.push(err.errors[0].msg);
        }
      } catch (error) {
        console.log(error);
      }
    });
  }
  if (errors.length > 0) {
    throw new BadRequestError(errors[0]);
  }

  return errors;
};

module.exports = { User, validateUser };
