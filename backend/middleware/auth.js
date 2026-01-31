const jwt = require("jsonwebtoken");

// Bearer-Token prüfen und req.user setzen
function isAuthenticated(req, res, next) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "Unauthorized" });

  try {
    const token = m[1];
    // Prefer the secret from the running app's context (set in server.js) so
    // signing and verification use the same value. Fall back to environment
    // variables or a dev default for backwards compatibility.
    const ctxSecret = req && req.app && req.app.locals && req.app.locals.ctx && req.app.locals.ctx.SECRET;
    const secret = ctxSecret || process.env.JWT_SECRET || process.env.SECRET || "dev-secret";
    const payload = jwt.verify(token, secret);
    req.user = { id: payload.id, email: payload.email, ...payload };
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Alias for compatibility
const authenticateToken = isAuthenticated;

// Optional auth - sets req.user if token present, but doesn't reject if missing
function optionalAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  
  if (!m) {
    req.user = null;
    return next();
  }

  try {
    const token = m[1];
    const ctxSecret = req && req.app && req.app.locals && req.app.locals.ctx && req.app.locals.ctx.SECRET;
    const secret = ctxSecret || process.env.JWT_SECRET || process.env.SECRET || "dev-secret";
    const payload = jwt.verify(token, secret);
    req.user = { id: payload.id, email: payload.email, ...payload };
  } catch (e) {
    req.user = null;
  }
  
  return next();
}

// Admin check middleware
function isAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "Unauthorized" });

  try {
    const token = m[1];
    const ctxSecret = req && req.app && req.app.locals && req.app.locals.ctx && req.app.locals.ctx.SECRET;
    const secret = ctxSecret || process.env.JWT_SECRET || process.env.SECRET || "dev-secret";
    const payload = jwt.verify(token, secret);
    
    if (!payload.isAdmin && payload.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    req.user = { id: payload.id, email: payload.email, ...payload };
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = { isAuthenticated, authenticateToken, optionalAuth, isAdmin };
