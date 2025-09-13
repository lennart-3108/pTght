const jwt = require("jsonwebtoken");
const { SECRET } = require("../config");

function requireAuth(req, res, next) {
  const hdr = req.headers.authorization
