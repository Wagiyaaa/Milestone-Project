import { useEffect, useState } from "react";
import { Routes, Route, NavLink, useNavigate, Navigate } from "react-router-dom";
import { fetchJson } from "./api";

import Register from "./pages/Register";
import Login from "./pages/Login";
import AdminUsers from "./pages/AdminUsers";

function GuestOnly({ me, loading, children }) {
  if (loading) {
    return (
      <div className="card">
        <p>Checking session…</p>
      </div>
    );
  }
  if (me) return <Navigate to="/" replace />;
  return children;
}

function ProfileCard({ me }) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {me?.profile_photo_path ? (
          <img
            src={me.profile_photo_path}
            alt="profile"
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              objectFit: "cover",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.2)",
            }}
          />
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.2)",
              display: "grid",
              placeItems: "center",
              color: "rgba(255,255,255,0.6)",
              fontSize: 12,
            }}
          >
            no photo
          </div>
        )}

        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>{me.full_name}</h2>
          <div className="small">{me.email}</div>
          <div className="small">{me.phone_e164}</div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="badge">role</div>
          <div style={{ marginTop: 4, fontWeight: 700 }}>{me.role}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <div className="small">session-backed identity (server cookie)</div>
        <div className="spacer" />
        <button type="button" className="secondary" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? "Hide raw JSON" : "Show raw JSON"}
        </button>
      </div>

      {showRaw && <pre style={{ marginTop: 10 }}>{JSON.stringify(me, null, 2)}</pre>}
    </div>
  );
}

export default function App() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const navigate = useNavigate();

  async function loadMe() {
    setLoadingMe(true);
    const r = await fetchJson("/auth/me", { method: "GET", headers: {} });
    if (r.ok) setMe(r.data.user);
    else setMe(null);
    setLoadingMe(false);
  }

  async function logout() {
    await fetchJson("/auth/logout", { method: "POST", headers: {} });
    setMe(null);
    navigate("/login");
  }

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
  let expired = false;

  const interval = setInterval(async () => {
      if (expired) return;
      const { status, data } = await fetchJson("/auth/me");
      if (status === 401 && data.code === "SESSION_EXPIRED") {
        expired = true;
        clearInterval(interval);
        alert("Your session has expired. Please log in again.");
        window.location.href = "/login";
      }
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      <header className="nav">
        <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>
          Home
        </NavLink>

        {/* Show Register/Login ONLY when not authenticated */}
        {!loadingMe && !me && (
          <>
            <NavLink to="/register" className={({ isActive }) => (isActive ? "active" : "")}>
              Register
            </NavLink>
            <NavLink to="/login" className={({ isActive }) => (isActive ? "active" : "")}>
              Login
            </NavLink>
          </>
        )}

        {/* Admin link ONLY if role is admin */}
        {me?.role === "admin" && (
          <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "active" : "")}>
            Admin
          </NavLink>
        )}

        <div className="spacer" />

        {loadingMe ? (
          <span className="badge">checking session…</span>
        ) : me ? (
          <>
            <span className="badge">
              {me.email} ({me.role})
            </span>
            <button onClick={logout} className="secondary" style={{ marginLeft: 10 }}>
              Logout
            </button>
          </>
        ) : (
          <span className="badge">Not logged in</span>
        )}
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <div className="card">
              <h1>Home</h1>
              <p>
                This app uses <b>server sessions (cookies)</b>. Your identity comes from <code>/auth/me</code>, not from
                localStorage.
              </p>

              {loadingMe ? (
                <p>Loading profile…</p>
              ) : me ? (
                <ProfileCard me={me} />
              ) : (
                <div className="card" style={{ marginTop: 14 }}>
                  <h2 style={{ marginTop: 0 }}>You’re not logged in</h2>
                  <p>Go to Login to start a session, or Register to create an account.</p>
                </div>
              )}
            </div>
          }
        />

        {/* Guest-only routes */}
        <Route
          path="/register"
          element={
            <GuestOnly me={me} loading={loadingMe}>
              <Register onSuccess={loadMe} />
            </GuestOnly>
          }
        />
        <Route
          path="/login"
          element={
            <GuestOnly me={me} loading={loadingMe}>
              <Login onSuccess={loadMe} />
            </GuestOnly>
          }
        />

        {/* Admin route (backend enforces admin, frontend just shows UX) */}
        <Route path="/admin/users" element={<AdminUsers me={me} />} />
      </Routes>
    </div>
  );
}
