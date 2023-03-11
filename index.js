require("dotenv").config();
require("express-async-errors");
//extra security
const helmet = require("helmet");
const cors = require("cors");
const xss = require("xss-clean");
const rateLimiter = require("express-rate-limit");
const sql = require("mssql");
const dbConfig = {
  port: parseInt(process.env.DB_PORT, 10),
  server: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE,
  stream: false,
  options: {
    trustedConnection: true,
    encrypt: true,
    enableArithAbort: true,
    trustServerCertificate: true,
    timeout: 30000,
  },
};
const appPool = new sql.ConnectionPool(dbConfig);

const express = require("express");
const app = express();

const usersRouter = require("./routes/users");

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
  res.send("<h1>Mega App API</h1>");
});

// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api/v1/users", usersRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 5000;

const start = async () => {
  try {
    appPool
      .connect()
      .then(function (pool) {
        app.locals.db = pool;
        app.listen(port, () =>
          console.log(`Server is listening at http://localhost:${port} ...`)
        );
      })
      .catch(function (err) {
        console.error("Error creating connection pool", err);
      });
  } catch (error) {
    console.log(error);
  }
};

start();

// Export the Express API
module.exports = app;
