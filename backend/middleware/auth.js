const jwt = require("jsonwebtoken");

// Bearer-Token prüfen und req.user setzen
function isAuthenticated(req, res, next) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "Unauthorized" });

  try {
    const token = m[1];
    const secret = process.env.JWT_SECRET || process.env.SECRET || "dev-secret";
    const payload = jwt.verify(token, secret);
    req.user = { id: payload.id, email: payload.email, ...payload };
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = { isAuthenticated };
