require("dotenv").config();
require("express-async-errors");
//extra security
const helmet = require("helmet");
const cors = require("cors");
const xss = require("xss-clean");
const rateLimiter = require("express-rate-limit");

//Swagger
// var path = require("path");
// var swagger_path = path.resolve(__dirname, "./swagger.yaml");
// const swaggerUi = require("swagger-ui-express");
// const YAML = require("yamljs");
// const swaggerDocument = YAML.load(swagger_path);

const express = require("express");
const app = express();

//sql
const sql = require("mssql");

//Firebase
// const admin = require("firebase-admin");
// const credentials = {
//   type: process.env.FIREBASE_TYPE,
//   project_id: process.env.FIREBASE_PROJECT_ID,
//   private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
//   private_key: process.env.FIREBASE_PRIVATE_KEY
//     ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
//     : undefined,
//   client_email: process.env.FIREBASE_CLIENT_EMAIL,
//   client_id: process.env.FIREBASE_CLIENT_ID,
//   auth_uri: process.env.FIREBASE_AUTH_URI,
//   token_uri: process.env.FIREBASE_TOKEN_URI,
//   auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
//   client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
// };
// admin.initializeApp({
//   credential: admin.credential.cert(credentials),
// });
// const db = admin.firestore();

// const connectDB = require("./db/connect");

// const cardsRouter = require("./routes/cards");

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
    // "<h1>Mega App API</h1> <a href='/api-docs'> Documentation </a>"
    "<h1>Mega App API</h1>"
  );
});

// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// app.use("/api/v1/cards", cardsRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 5000;

const start = async () => {
  try {
    // await connectDB(process.env.MONGO_URI);

    // const config = {
    //   user: process.env.SQL_USER,
    //   password: process.env.SQL_PASSWORD,
    //   server: process.env.SQL_SERVER,
    //   port: 1433,
    //   database: process.env.SQL_DATABASE,
    //   pool: {
    //     max: 10,
    //     min: 0,
    //     idleTimeoutMillis: 30000,
    //   },
    //   options: {
    //     encrypt: true, // if you are using Azure
    //     trustServerCertificate: false,
    //   },
    //   ssl: {
    //     rejectUnauthorized: false,
    //   },
    // };
    const config = {
      port: parseInt(process.env.DB_PORT, 10),
      server: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_Database,
      stream: false,
      options: {
        trustedConnection: true,
        encrypt: true,
        enableArithAbort: true,
        trustServerCertificate: true,
      },
    };

    sql.connect(config).then((pool) => {
      if (pool.connecting) {
        console.log("Connecting to the database...");
      }
      if (pool.connected) {
        console.log("Connected to SQL Server");
        //get count of table
        const request = new sql.Request();
        request.query("SELECT COUNT(*) FROM datawayfinder", (err, result) => {
          if (err) {
            console.log(err);
          } else {
            console.log(result.recordset);
            console.log(result.recordset[0][""]);
          }
        });
      }
    });
    app.listen(port, () =>
      console.log(`Server is listening at http://localhost:${port} ...`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();

// Export the Express API
module.exports = app;
