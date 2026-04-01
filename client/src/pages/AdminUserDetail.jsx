import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchJson } from "../api";
import PostCard from "../components/PostCard";

export default function AdminUserDetail({ me }) {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [authoredPosts, setAuthoredPosts] = useState([]);
  const [engagedPosts, setEngagedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadProfile() {
    setLoading(true);
    setMessage("");

    const response = await fetchJson(`/admin/users/${userId}`, { method: "GET", headers: {} });
    if (!response.ok) {
      if (response.status === 401) {
        setMessage("Not authenticated. Please log in.");
      } else if (response.status === 403) {
        setMessage("Forbidden. Admin access only.");
      } else if (response.status === 404) {
        setMessage("User not found.");
      } else {
        setMessage(response.data.message || `Failed with status ${response.status}.`);
      }

      setProfile(null);
      setAuthoredPosts([]);
      setEngagedPosts([]);
      setLoading(false);
      return;
    }

    setProfile(response.data.profile);
    setAuthoredPosts(response.data.authored_posts || []);
    setEngagedPosts(response.data.engaged_posts || []);
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
  }, [userId]);

  return (
    <div className="stack">
      <div className="card">
        <div className="toolbar">
          <Link className="button-link secondary-link" to="/admin/users">
            Back to users
          </Link>
        </div>

        {loading ? (
          <p>Loading user profile...</p>
        ) : message ? (
          <div className="error">{message}</div>
        ) : profile ? (
          <div className="stack top-gap">
            <div className="toolbar">
              {profile.profile_photo_path ? (
                <img className="avatar" src={profile.profile_photo_path} alt={profile.full_name} />
              ) : null}
              <div>
                <h1>{profile.full_name}</h1>
                <div className="small">{profile.email}</div>
                <div className="small">{profile.phone_e164}</div>
              </div>
            </div>

            <div className="grid two">
              <div className="muted-box">
                <strong>Role</strong>
                <div>{profile.role}</div>
              </div>
              <div className="muted-box">
                <strong>Active</strong>
                <div>{profile.is_active ? "Yes" : "No"}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {me?.role !== "admin" && <div className="status-banner">This page is available only to admin accounts.</div>}

      <div className="card">
        <div className="section-title">
          <h2>Posts authored</h2>
          <p>All current posts created by this user, including posts hidden by moderators.</p>
        </div>
      </div>

      {authoredPosts.length === 0 ? (
        <div className="card empty-state">This user has not authored any posts yet.</div>
      ) : (
        authoredPosts.map((post) => <PostCard key={post.id} post={post} me={me} onReload={loadProfile} adminMode />)
      )}

      <div className="card">
        <div className="section-title">
          <h2>Posts engaged with</h2>
          <p>Posts this user has commented on or liked.</p>
        </div>
      </div>

      {engagedPosts.length === 0 ? (
        <div className="card empty-state">This user has not engaged with any other posts yet.</div>
      ) : (
        engagedPosts.map((post) => <PostCard key={post.id} post={post} me={me} onReload={loadProfile} adminMode />)
      )}
    </div>
  );
}
