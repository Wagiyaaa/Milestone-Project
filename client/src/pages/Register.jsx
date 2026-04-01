import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchForm } from "../api";

export default function Register({ onSuccess }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone_e164: "",
    password: "",
  });
  const [photo, setPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverMsg, setServerMsg] = useState("");
  const navigate = useNavigate();

  function setField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setErrors({});
    setServerMsg("");

    const formData = new FormData();
    formData.append("full_name", form.full_name);
    formData.append("email", form.email);
    formData.append("phone_e164", form.phone_e164);
    formData.append("password", form.password);
    if (photo) formData.append("profile_photo", photo);

    const response = await fetchForm("/auth/register", formData);

    if (!response.ok) {
      setServerMsg(response.data.message || "Registration failed.");
      setErrors(response.data.errors || {});
      return;
    }

    await onSuccess?.();
    navigate("/");
  }

  return (
    <div className="card auth-card">
      <div className="section-title">
        <h2>Create an account</h2>
        <p>Profile photos are required and validated server-side before they are stored.</p>
      </div>

      <form onSubmit={submit} className="form-grid top-gap">
        <label>
          Full name
          <input value={form.full_name} onChange={(event) => setField("full_name", event.target.value)} />
          {errors.full_name && <div className="error">{errors.full_name}</div>}
        </label>

        <label>
          Email
          <input value={form.email} onChange={(event) => setField("email", event.target.value)} />
          {errors.email && <div className="error">{errors.email}</div>}
        </label>

        <label>
          Phone (E.164)
          <input
            placeholder="+639171234567"
            value={form.phone_e164}
            onChange={(event) => setField("phone_e164", event.target.value)}
          />
          {errors.phone_e164 && <div className="error">{errors.phone_e164}</div>}
        </label>

        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(event) => setField("password", event.target.value)}
          />
          {errors.password && <div className="error">{errors.password}</div>}
        </label>

        <label>
          Profile photo (JPEG/PNG required)
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(event) => setPhoto(event.target.files?.[0] || null)}
          />
          {errors.profile_photo && <div className="error">{errors.profile_photo}</div>}
        </label>

        {serverMsg && <div className="error">{serverMsg}</div>}

        <button type="submit">Create account</button>
      </form>
    </div>
  );
}
