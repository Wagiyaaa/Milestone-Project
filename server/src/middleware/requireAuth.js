function requireAuth(req, res, next) {
    const user = req.session?.user;
    if (!user?.userId) {
        return res.status(401).json({ message: "Not authenticated." });
    }
    next();
}

function requireAdmin(req, res, next) {
    const user = req.session?.user;
    if (!user?.userId) {
        return res.status(401).json({ message: "Not authenticated." });
    }
    if (user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden." });
    }
    next();
}

module.exports = { requireAuth, requireAdmin };
