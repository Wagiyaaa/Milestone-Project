function requireAuth(req, res, next) {
  const user = req.session?.user;
  if (!user?.userId) {
    return res.status(401).json({ message: "Not authenticated.", request_id: req.id });
  }
  next();
}

function requireAdmin(req, res, next) {
  const user = req.session?.user;
  if (!user?.userId) {
    return res.status(401).json({ message: "Not authenticated.", request_id: req.id });
  }
  if (user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden.", request_id: req.id });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
