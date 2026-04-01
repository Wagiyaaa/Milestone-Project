import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";

import { fetchJson } from "./api";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import AdminUsers from "./pages/AdminUsers";
import AdminPosts from "./pages/AdminPosts";
import AdminUserDetail from "./pages/AdminUserDetail";

function GuestOnly({ me, loading, children }) {
  if (loading) {
    return (
      <div className="card">
        <p>Checking session...</p>
      </div>
    );
  }

  if (me) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const navigate = useNavigate();

  async function loadMe() {
    setLoadingMe(true);
    const response = await fetchJson("/auth/me", { method: "GET", headers: {} });
    setMe(response.ok ? response.data.user : null);
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
    if (!me) return undefined;

    let expired = false;
    const interval = setInterval(async () => {
      if (expired) return;

      const { status, data } = await fetchJson("/auth/me", { method: "GET", headers: {} });
      if (status === 401 && data.code === "SESSION_EXPIRED") {
        expired = true;
        clearInterval(interval);
      }
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [me?.id]);

  return (
    <div className="container">
      <header className="nav">
        <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>
          Feed
        </NavLink>

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

        {me?.role === "admin" && (
          <>
            <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "active" : "")}>
              Admin Users
            </NavLink>
            <NavLink to="/admin/posts" className={({ isActive }) => (isActive ? "active" : "")}>
              Admin Posts
            </NavLink>
          </>
        )}

        <div className="spacer" />

        {loadingMe ? (
          <span className="badge">Checking session...</span>
        ) : me ? (
          <div className="toolbar">
            <span className="badge">
              {me.email} ({me.role})
            </span>
            <button onClick={logout} className="secondary">
              Logout
            </button>
          </div>
        ) : (
          <span className="badge">Browsing as guest</span>
        )}
      </header>

      <Routes>
        <Route path="/" element={<Home me={me} loadingMe={loadingMe} />} />
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
        <Route path="/admin/users" element={<AdminUsers me={me} />} />
        <Route path="/admin/users/:userId" element={<AdminUserDetail me={me} />} />
        <Route path="/admin/posts" element={<AdminPosts me={me} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
