const app = require("./app");
const connectDB = require("./config/db");
const { PORT } = require("./config/env");

const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

start();
