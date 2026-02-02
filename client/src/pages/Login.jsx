import { useState } from "react";
import { fetchJson } from "../api";
import { useNavigate } from "react-router-dom";

export default function Login({ onSuccess }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [serverMsg, setServerMsg] = useState("");
    const [errors, setErrors] = useState({});
    const navigate = useNavigate();

    async function submit(e) {
        e.preventDefault();
        setServerMsg("");
        setErrors({});

        const r = await fetchJson("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });

        if (!r.ok) {
            setServerMsg(r.data.message || "Login failed.");
            setErrors(r.data.errors || {});
            return;
        }

        await onSuccess?.();
        navigate("/");
    }

    return (
        <div>
            <h2>Login</h2>
            <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
                <label>
                    Email
                    <input value={email} onChange={(e) => setEmail(e.target.value)} />
                    {errors.email && <div style={{ color: "crimson" }}>{errors.email}</div>}
                </label>

                <label>
                    Password
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    {errors.password && <div style={{ color: "crimson" }}>{errors.password}</div>}
                </label>

                {serverMsg && <div style={{ color: "crimson" }}>{serverMsg}</div>}

                <button type="submit">Login</button>
            </form>
        </div>
    );
}
