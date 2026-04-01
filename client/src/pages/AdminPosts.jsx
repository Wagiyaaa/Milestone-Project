import { useEffect, useState } from "react";

import { fetchJson } from "../api";
import PostCard from "../components/PostCard";

export default function AdminPosts({ me }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadPosts() {
    setLoading(true);
    setMessage("");

    const response = await fetchJson("/admin/posts", { method: "GET", headers: {} });
    if (!response.ok) {
      if (response.status === 401) {
        setMessage("Not authenticated. Please log in.");
      } else if (response.status === 403) {
        setMessage("Forbidden. Admin access only.");
      } else {
        setMessage(response.data.message || `Failed with status ${response.status}.`);
      }
      setPosts([]);
      setLoading(false);
      return;
    }

    setPosts(response.data.posts || []);
    setLoading(false);
  }

  useEffect(() => {
    loadPosts();
  }, []);

  return (
    <div className="stack">
      <div className="card">
        <div className="section-title">
          <h1>Admin moderation</h1>
          <p>Admins can edit posts, hide or restore them, and permanently delete them when necessary.</p>
        </div>
      </div>

      {me?.role !== "admin" && <div className="status-banner">This page is available only to admin accounts.</div>}

      {loading ? (
        <div className="card">
          <p>Loading posts...</p>
        </div>
      ) : message ? (
        <div className="card">
          <div className="error">{message}</div>
        </div>
      ) : posts.length === 0 ? (
        <div className="card empty-state">There are no posts to moderate yet.</div>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} me={me} onReload={loadPosts} adminMode />)
      )}
    </div>
  );
}
