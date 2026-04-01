import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchJson } from "../api";

export default function AdminUsers({ me }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      setMessage("");

      const response = await fetchJson("/admin/users", { method: "GET", headers: {} });
      if (!response.ok) {
        if (response.status === 401) {
          setMessage("Not authenticated. Please log in.");
        } else if (response.status === 403) {
          setMessage("Forbidden. Admin access only.");
        } else {
          setMessage(response.data.message || `Failed with status ${response.status}.`);
        }
        setUsers([]);
        setLoading(false);
        return;
      }

      setUsers(response.data.users || []);
      setLoading(false);
    }

    loadUsers();
  }, []);

  return (
    <div className="card">
      <div className="section-title">
        <h1>Admin users</h1>
        <p>Click a user to inspect their profile, authored posts, and the posts they have engaged with.</p>
      </div>

      {me?.role !== "admin" && (
        <div className="status-banner top-gap">This page is available only to admin accounts.</div>
      )}

      {loading ? (
        <p>Loading users...</p>
      ) : message ? (
        <div className="error">{message}</div>
      ) : (
        <div className="table-wrap top-gap">
          <table className="table">
            <thead>
              <tr>
                <th align="left">User</th>
                <th align="left">Role</th>
                <th align="left">Active</th>
                <th align="left">Posts</th>
                <th align="left">Comments</th>
                <th align="left">Likes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Link className="table-link" to={`/admin/users/${user.id}`}>
                      {user.full_name}
                    </Link>
                    <div className="small">{user.email}</div>
                    <div className="small">{user.phone_e164}</div>
                  </td>
                  <td>{user.role}</td>
                  <td>{user.is_active ? "Yes" : "No"}</td>
                  <td>{user.post_count}</td>
                  <td>{user.comment_count}</td>
                  <td>{user.like_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
