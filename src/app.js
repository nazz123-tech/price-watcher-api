const express = require("express");
const cors = require("cors");
const config = require("./config");
const itemsRouter = require("./routes/items");
const settingsRouter = require("./routes/settings");
const listsRouter = require("./routes/lists");

const app = express();

// Only our frontend may call this API from a browser.
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());

// Used by Render (and us) to check that the server is up. No login needed.
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/items", itemsRouter);
app.use("/settings", settingsRouter);
app.use("/lists", listsRouter);

// Any route we don't know about.
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Any error thrown in a route ends up here. Express 5 also catches
// errors from async routes, so we don't need try/catch everywhere.
app.use((err, req, res, next) => {
  // Bad JSON in the request body.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

module.exports = app;
