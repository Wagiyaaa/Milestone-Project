const { writeAuditLog, buildRequestContext } = require("../utils/auditLogger");
const { clearSessionCookieOptions, sessionAbsoluteHours, sessionIdleMinutes } = require("../config/runtime");

const IDLE_MS = sessionIdleMinutes * 60 * 1000;
const ABSOLUTE_MS = sessionAbsoluteHours * 60 * 60 * 1000;

const SKIP_ACTIVITY_ROUTES = ["/auth/me"];

function sessionTimeout(req, res, next) {
    // only enforce timeouts on sessions that carry auth state (when logged in)
    const session = req.session;
    if (!session?.user?.userId) {
        return next();
    }
        
    const now = Date.now();

    // absolute timeout
    const createdAt = session.createdAt;
    if (!createdAt) {
        session.createdAt = now;
    } else if (now - createdAt > ABSOLUTE_MS) {
        return destroyAndRespond(req, res, "Session has expired. Please return to log in.");
    }

    // idle timeout
    const lastActivity = session.lastActivity;
    if (!lastActivity) {
        session.lastActivity = now;
    } else if (now - lastActivity > IDLE_MS) {
        return destroyAndRespond(req, res, "Session has timed out due to inactivity. Please return to log in.");
    }

    // refresh idle timestamp on every active request except for background polling routes
    if (!SKIP_ACTIVITY_ROUTES.includes(req.path)) {
      session.lastActivity = now;
    }
    next();
}

function destroyAndRespond(req, res, message) {
  void writeAuditLog({
    category: "auth",
    action: "session.expired",
    actor_user_id: req.session?.user?.userId || null,
    actor_role: req.session?.user?.role || null,
    request: buildRequestContext(req),
    details: { message },
  });

  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error(`[${req.id}] session destroy error during timeout`, err.message);
      }
    });
  }

  res.clearCookie("sid", {
    ...clearSessionCookieOptions,
  });

  return res.status(401).json({
    message,
    code: "SESSION_EXPIRED",
    request_id: req.id,
  });
}

module.exports = sessionTimeout;
