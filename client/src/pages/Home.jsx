import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchJson } from "../api";
import PostComposer from "../components/PostComposer";
import PostCard from "../components/PostCard";

function ProfileSummary({ me, loadingMe }) {
  if (loadingMe) {
    return (
      <div className="card sticky-panel">
        <p>Checking your session...</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="card sticky-panel">
        <div className="section-title">
          <h2>Browse the feed</h2>
          <p>You can read posts as a guest, but you need an account to create, comment, and like.</p>
        </div>
        <div className="stack top-gap">
          <Link className="button-link" to="/login">
            Log in
          </Link>
          <Link className="button-link secondary-link" to="/register">
            Create an account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card sticky-panel">
      <div className="toolbar">
        {me.profile_photo_path ? <img className="avatar" src={me.profile_photo_path} alt={me.full_name} /> : null}
        <div>
          <h2>{me.full_name}</h2>
          <div className="small">{me.email}</div>
          <div className="small">{me.phone_e164}</div>
        </div>
      </div>

      <div className="top-gap helper-list">
        <div>Role: {me.role}</div>
        <div>Allowed actions: create posts, comment, like and unlike</div>
        <div>Images are optional on posts and validated server-side</div>
      </div>
    </div>
  );
}

export default function Home({ me, loadingMe }) {
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [message, setMessage] = useState("");

  async function loadPosts() {
    setLoadingPosts(true);
    setMessage("");

    const response = await fetchJson("/posts", { method: "GET", headers: {} });
    if (!response.ok) {
      setPosts([]);
      setMessage(response.data.message || "Unable to load posts.");
      setLoadingPosts(false);
      return;
    }

    setPosts(response.data.posts || []);
    setLoadingPosts(false);
  }

  useEffect(() => {
    loadPosts();
  }, [me?.id]);

  return (
    <div className="home-layout">
      <section className="feed-column">
        {me && <PostComposer onCreated={loadPosts} />}

        <div className="card">
          <div className="section-title">
            <h1>Community feed</h1>
            <p>Newest posts appear first. Hidden posts are removed from the public feed but still visible to admins.</p>
          </div>
        </div>

        {loadingPosts ? (
          <div className="card">
            <p>Loading posts...</p>
          </div>
        ) : message ? (
          <div className="card">
            <div className="error">{message}</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="card empty-state">No posts yet. Be the first one to start the discussion.</div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} me={me} onReload={loadPosts} />)
        )}
      </section>

      <aside className="side-column">
        <ProfileSummary me={me} loadingMe={loadingMe} />
      </aside>
    </div>
  );
}
