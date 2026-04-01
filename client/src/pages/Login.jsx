import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchJson } from "../api";

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverMsg, setServerMsg] = useState("");
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setServerMsg("");
    setErrors({});

    const response = await fetchJson("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      setServerMsg(response.data.message || "Login failed.");
      setErrors(response.data.errors || {});
      return;
    }

    await onSuccess?.();
    navigate("/");
  }

  return (
    <div className="card auth-card">
      <div className="section-title">
        <h2>Log in</h2>
        <p>Sessions are stored server-side and expire automatically after inactivity.</p>
      </div>

      <form onSubmit={submit} className="form-grid top-gap">
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
          {errors.email && <div className="error">{errors.email}</div>}
        </label>

        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {errors.password && <div className="error">{errors.password}</div>}
        </label>

        {serverMsg && <div className="error">{serverMsg}</div>}

        <button type="submit">Login</button>
      </form>
    </div>
  );
}
