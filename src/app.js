const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const { apiKeyAuth } = require("./middlewares/apiKeyAuth");
const { requestLogger } = require("./middlewares/requestLogger");
app.use(requestLogger);
app.use("/api", apiKeyAuth);

const pingRoutes = require("./routes/ping");
const healthRoutes = require("./routes/health");
const echoRoutes = require("./routes/echo");
const sumRoutes = require("./routes/sum");
const paymentRoutes = require("./routes/payments");
const partnerRoutes = require("./routes/partner");

app.use("/", pingRoutes);
app.use("/", healthRoutes);
app.use("/", echoRoutes);

app.use("/api", partnerRoutes);
app.use("/api", sumRoutes);
app.use("/api", paymentRoutes);


module.exports = app;
