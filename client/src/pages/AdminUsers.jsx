import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { Link } from "react-router-dom";

export default function AdminUsers({ me }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        (async () => {
            setLoading(true);
            setMsg("");

            const r = await fetchJson("/admin/users", { method: "GET", headers: {} });

            if (!r.ok) {
                if (r.status === 401) {
                    setMsg("Not authenticated. Please log in.");
                } else if (r.status === 403) {
                    setMsg("Forbidden. Admin access only.");
                } else {
                    setMsg(r.data.message || `Failed (${r.status})`);
                }
                setUsers([]);
                setLoading(false);
                return;
            }

            setUsers(r.data.users || []);
            setLoading(false);
        })();
    }, []);

    return (
        <div className="card">
            <h1>Admin: users</h1>
            <p className="small">
                This endpoint is protected server-side. Non-admins should always get <b>403</b>.
            </p>

            {/* nice hint if user isn't admin */}
            {me?.role !== "admin" && (
                <div className="card" style={{ marginTop: 12 }}>
                    <p style={{ margin: 0 }}>
                        Tip: log in with an <b>admin</b> account to view users.
                    </p>
                </div>
            )}

            {loading ? (
                <p>Loading users…</p>
            ) : msg ? (
                <div className="card" style={{ marginTop: 12 }}>
                    <p style={{ margin: 0 }}>{msg}</p>
                    {msg.includes("log in") && (
                        <p style={{ marginTop: 10 }}>
                            <Link to="/login">Go to Login</Link>
                        </p>
                    )}
                </div>
            ) : (
                <div style={{ overflowX: "auto", marginTop: 12 }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th align="left">email</th>
                                <th align="left">name</th>
                                <th align="left">phone</th>
                                <th align="left">role</th>
                                <th align="left">active</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td>{u.email}</td>
                                    <td>{u.full_name}</td>
                                    <td>{u.phone_e164}</td>
                                    <td>{u.role}</td>
                                    <td>{String(u.is_active)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <p className="small" style={{ marginTop: 12 }}>
                        Showing {users.length} user(s).
                    </p>
                </div>
            )}
        </div>
    );
}
