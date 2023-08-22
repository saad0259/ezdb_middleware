const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");

const adminCollection = "admins";

const createAdmin = async (req, res) => {
  const { db, admin } = req;
  const { email, password } = req.body;

  const user = await admin.auth().createUser({
    email,
    password,
  });

  const newAdmin = {
    email,
    role: "sub-admin",
    verified: true,
    isActive: true,
  };

  // const result = await db.collection(adminCollection).add(newAdmin);

  const result = await db
    .collection(adminCollection)
    .doc(user.uid)
    .set(newAdmin);

  res.status(StatusCodes.CREATED).json({
    id: result.id,
    ...newAdmin,
  });
};

const updateAdmin = async (req, res) => {
  const { db, admin } = req;
  const { id } = req.params;

  await db.collection(adminCollection).doc(id).update(req.body);

  res.status(StatusCodes.OK).json({
    id,
    ...req.body,
  });
};

const deleteAdmin = async (req, res) => {
  const { db, admin } = req;
  const { id } = req.params;

  await db.collection(adminCollection).doc(id).delete();

  await admin.auth().deleteUser(id);

  res.status(StatusCodes.OK).json({
    id,
    isDeleted: true,
    isActive: false,
  });
};

module.exports = { createAdmin, updateAdmin, deleteAdmin };
