const config = require("./config");
const app = require("./app");

app.listen(config.port, () => {
  console.log(`Price Watcher API listening on port ${config.port}`);
});
