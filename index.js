require("dotenv").config();
require("express-async-errors");
const packageJson = require("./package.json");
const version = packageJson.version;
//extra security
const helmet = require("helmet");
const cors = require("cors");
const xss = require("xss-clean");
const rateLimiter = require("express-rate-limit");
const express = require("express");
const app = express();

//Firebase
const admin = require("firebase-admin");
const credentials = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
};

admin.initializeApp({
  credential: admin.credential.cert(credentials),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

const db = admin.firestore();

const https = require("https");
const fs = require("fs");

const authRouter = require("./routes/auth");
const recordsRouter = require("./routes/records");
const offersRouter = require("./routes/offers");
const usersRouter = require("./routes/users");
const adminRouter = require("./routes/admins");
const adminLogsRouter = require("./routes/admin_logs");

const notFoundMiddleware = require("./middleware/not-found");
const errorHandlerMiddleware = require("./middleware/error-handler");

app.set("trust proxy", 1);
app.use(
  rateLimiter({
    windowMs: 30 * 60 * 1000, // 1 hour window
    max: 500, // start blocking after 500 requests
    message:
      "Too many requests from this IP, please try again after half an hour",
  })
);
app.use(express.json());
app.use(helmet());
app.use(cors());
app.use(xss());

app.get("/", (req, res) => {
  res.send(
    `<h1>Mega App API (${version}-${packageJson.config.environment})</h1>`
  );
});

// app.use("/api/v1/users", (req, res, next) => {
//   req.admin = admin;
//   req.db = db;
//   next();
// });

// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// function attachConnectionPool(req, res, next) {
//   req.pool = pool;
// }

// app.use(/\/api\/v1\/(users)/, attachConnectionPool);

const multer = require("multer");
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

function attachAdminAndDb(req, res, next) {
  req.admin = admin;
  req.db = db;
  next();
}

app.use(/\/api\/v1\/(admins|users|auth)/, attachAdminAndDb);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/records", upload.single("file"), recordsRouter);
app.use("/api/v1/offers", offersRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/admins/logs", adminLogsRouter);
app.use("/api/v1/admins", adminRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 5500;

const options = {
  key: fs.readFileSync("./certs/5_9_88_108.key"),
  cert: fs.readFileSync("./certs/5_9_88_108.pem"),
  ca: fs.readFileSync("./certs/5_9_88_108.pem"),
};

https.createServer(options, app).listen(port, () => {
  console.log(`Server is listening at https://localhost:${port} ...`);
});

// const start = async () => {
//   try {
//     app.listen(port, () =>
//       console.log(`Server is listening at http://localhost:${port} ...`)
//     );
//   } catch (error) {
//     console.log(error);
//   }
// };

// start();

// Export the Express API

module.exports = app;
