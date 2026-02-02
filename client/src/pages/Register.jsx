import { useState } from "react";
import { fetchForm } from "../api";
import { useNavigate } from "react-router-dom";

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

    function setField(k, v) {
        setForm((p) => ({ ...p, [k]: v }));
    }

    async function submit(e) {
        e.preventDefault();
        setErrors({});
        setServerMsg("");

        const fd = new FormData();
        fd.append("full_name", form.full_name);
        fd.append("email", form.email);
        fd.append("phone_e164", form.phone_e164);
        fd.append("password", form.password);
        if (photo) fd.append("profile_photo", photo);

        const r = await fetchForm("/auth/register", fd);

        if (!r.ok) {
            setServerMsg(r.data.message || "Registration failed.");
            setErrors(r.data.errors || {});
            return;
        }

        await onSuccess?.();
        navigate("/");
    }

    return (
        <div>
            <h2>Register</h2>
            <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
                <label>
                    Full name
                    <input value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} />
                    {errors.full_name && <div style={{ color: "crimson" }}>{errors.full_name}</div>}
                </label>

                <label>
                    Email
                    <input value={form.email} onChange={(e) => setField("email", e.target.value)} />
                    {errors.email && <div style={{ color: "crimson" }}>{errors.email}</div>}
                </label>

                <label>
                    Phone (E.164)
                    <input
                        placeholder="+639171234567"
                        value={form.phone_e164}
                        onChange={(e) => setField("phone_e164", e.target.value)}
                    />
                    {errors.phone_e164 && <div style={{ color: "crimson" }}>{errors.phone_e164}</div>}
                </label>

                <label>
                    Password
                    <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setField("password", e.target.value)}
                    />
                    {errors.password && <div style={{ color: "crimson" }}>{errors.password}</div>}
                </label>

                <label>
                    Profile photo (JPEG/PNG required)
                    <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                    />
                    {errors.profile_photo && <div style={{ color: "crimson" }}>{errors.profile_photo}</div>}
                </label>

                {serverMsg && <div style={{ color: "crimson" }}>{serverMsg}</div>}

                <button type="submit">Create account</button>
            </form>
        </div>
    );
}
