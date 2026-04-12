const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_PASSWORD_HASH,
  JWT_SECRET
} = require("../config/env");

const login = async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  if (username !== ADMIN_USERNAME) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  let isValidPassword = false;

  if (ADMIN_PASSWORD_HASH) {
    isValidPassword = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  } else {
    isValidPassword = password === ADMIN_PASSWORD;
  }

  if (!isValidPassword) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    {
      username: ADMIN_USERNAME,
      role: "admin"
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );

  return res.json({
    token,
    admin: {
      username: ADMIN_USERNAME,
      role: "admin"
    }
  });
};

module.exports = {
  login
};
