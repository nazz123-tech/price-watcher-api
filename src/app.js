const express = require("express");
const cors = require("cors");
const config = require("./config");
const itemsRouter = require("./routes/items");
const settingsRouter = require("./routes/settings");
const listsRouter = require("./routes/lists");

const app = express();

app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/items", itemsRouter);
app.use("/settings", settingsRouter);
app.use("/lists", listsRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

module.exports = app;
