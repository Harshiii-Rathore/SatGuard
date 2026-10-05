const app = require("./app");
const { PORT } = require("./config/constants");

function startServer(port = PORT) {
  return app.listen(port, () => {
    console.log(`OrbitGuard is running on port ${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };