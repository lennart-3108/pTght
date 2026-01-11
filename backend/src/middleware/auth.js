const jwt = require("jsonwebtoken");

function makeAuth(JWT_SECRET) {
  return function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };
}

// Default middleware instance (will fail if used without JWT_SECRET)
const isAuthenticated = (req, res, next) => {
  res.status(500).json({ error: 'AUTH_NOT_CONFIGURED' });
};

module.exports = { makeAuth, isAuthenticated };
