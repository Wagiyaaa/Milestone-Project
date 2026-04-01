import { useEffect, useState } from "react";

import { fetchJson } from "../api";

function formatDate(value) {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function Avatar({ src, alt, small = false }) {
  return src ? (
    <img className={small ? "avatar small" : "avatar"} src={src} alt={alt} />
  ) : (
    <div className={small ? "avatar small avatar-fallback" : "avatar avatar-fallback"}>{alt?.[0] || "?"}</div>
  );
}

export default function PostCard({ post, me, onReload, adminMode = false }) {
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [workingAction, setWorkingAction] = useState("");
  const [editing, setEditing] = useState(false);
  const [moderationReason, setModerationReason] = useState(post.hidden_reason || "");
  const [editForm, setEditForm] = useState({
    title: post.title,
    body: post.body,
    read_time_minutes: String(post.read_time_minutes),
    reference_count: String(post.reference_count),
  });

  useEffect(() => {
    setEditForm({
      title: post.title,
      body: post.body,
      read_time_minutes: String(post.read_time_minutes),
      reference_count: String(post.reference_count),
    });
    setModerationReason(post.hidden_reason || "");
    setEditing(false);
  }, [post]);

  async function toggleLike() {
    if (!me) return;

    setWorkingAction("like");
    setStatusMessage("");

    const response = await fetchJson(`/posts/${post.id}/likes`, {
      method: post.liked_by_me ? "DELETE" : "POST",
      headers: {},
    });

    setWorkingAction("");
    if (!response.ok) {
      setStatusMessage(response.data.message || "Unable to update the like.");
      return;
    }

    await onReload?.();
  }

  async function submitComment(event) {
    event.preventDefault();
    if (!me) return;

    setCommentError("");
    setStatusMessage("");
    setWorkingAction("comment");

    const response = await fetchJson(`/posts/${post.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: commentText }),
    });

    setWorkingAction("");
    if (!response.ok) {
      setCommentError(response.data.errors?.body || response.data.message || "Unable to post the comment.");
      return;
    }

    setCommentText("");
    await onReload?.();
  }

  async function saveAdminEdit(event) {
    event.preventDefault();
    setWorkingAction("save");
    setStatusMessage("");

    const response = await fetchJson(`/admin/posts/${post.id}`, {
      method: "PATCH",
      body: JSON.stringify(editForm),
    });

    setWorkingAction("");
    if (!response.ok) {
      setStatusMessage(response.data.message || "Unable to save the post.");
      return;
    }

    setEditing(false);
    await onReload?.();
  }

  async function moderate(action) {
    setWorkingAction(action);
    setStatusMessage("");

    const response = await fetchJson(`/admin/posts/${post.id}/moderation`, {
      method: "PATCH",
      body: JSON.stringify({
        action,
        reason: moderationReason,
      }),
    });

    setWorkingAction("");
    if (!response.ok) {
      setStatusMessage(response.data.message || "Unable to update moderation.");
      return;
    }

    await onReload?.();
  }

  async function deletePost() {
    if (!window.confirm("Delete this post permanently? This also removes its comments and likes.")) {
      return;
    }

    setWorkingAction("delete");
    setStatusMessage("");
    const response = await fetchJson(`/admin/posts/${post.id}`, {
      method: "DELETE",
      headers: {},
    });

    setWorkingAction("");
    if (!response.ok) {
      setStatusMessage(response.data.message || "Unable to delete the post.");
      return;
    }

    await onReload?.();
  }

  return (
    <article className={`card post-card${post.is_hidden ? " post-hidden" : ""}`}>
      <div className="post-header">
        <div className="toolbar">
          <Avatar src={post.author_profile_photo_path} alt={post.author_name} />
          <div>
            <div className="post-author">{post.author_name}</div>
            <div className="small">{formatDate(post.created_at)}</div>
          </div>
        </div>

        <div className="pill-row">
          <span className="pill">Read time: {post.read_time_minutes} min</span>
          <span className="pill">References: {post.reference_count}</span>
          <span className="pill">{post.like_count} likes</span>
          <span className="pill">{post.comment_count} comments</span>
          {post.is_hidden && <span className="pill danger">Hidden</span>}
        </div>
      </div>

      {editing ? (
        <form onSubmit={saveAdminEdit} className="form-grid top-gap">
          <label>
            Title
            <input
              value={editForm.title}
              onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
            />
          </label>

          <label>
            Post text
            <textarea
              rows="5"
              value={editForm.body}
              onChange={(event) => setEditForm((current) => ({ ...current, body: event.target.value }))}
            />
          </label>

          <div className="grid two">
            <label>
              Estimated read time
              <input
                type="number"
                min="1"
                max="120"
                value={editForm.read_time_minutes}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, read_time_minutes: event.target.value }))
                }
              />
            </label>

            <label>
              Reference count
              <input
                type="number"
                min="0"
                max="50"
                value={editForm.reference_count}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, reference_count: event.target.value }))
                }
              />
            </label>
          </div>

          <div className="toolbar">
            <button type="submit" disabled={workingAction === "save"}>
              {workingAction === "save" ? "Saving..." : "Save post"}
            </button>
            <button type="button" className="secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <h3>{post.title}</h3>
          <p className="post-body">{post.body}</p>
        </>
      )}

      {post.image_path && (
        <img className="post-image" src={post.image_path} alt={`Post by ${post.author_name}`} />
      )}

      {post.is_hidden && post.hidden_reason && (
        <div className="status-banner">Moderator note: {post.hidden_reason}</div>
      )}

      {statusMessage && <div className="error top-gap">{statusMessage}</div>}

      {adminMode ? (
        <div className="admin-panel top-gap">
          <div className="toolbar">
            <button type="button" className="secondary" onClick={() => setEditing((current) => !current)}>
              {editing ? "Close editor" : "Edit post"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => moderate(post.is_hidden ? "restore" : "hide")}
              disabled={workingAction === "hide" || workingAction === "restore"}
            >
              {post.is_hidden ? "Restore post" : "Hide post"}
            </button>
            <button type="button" onClick={deletePost} disabled={workingAction === "delete"}>
              {workingAction === "delete" ? "Deleting..." : "Delete permanently"}
            </button>
          </div>

          <label>
            Moderation reason
            <input
              value={moderationReason}
              onChange={(event) => setModerationReason(event.target.value)}
              placeholder="Optional note for hidden posts"
            />
          </label>
        </div>
      ) : (
        <div className="actions-row top-gap">
          <button type="button" className="secondary" onClick={toggleLike} disabled={!me || workingAction === "like"}>
            {!me ? "Log in to like" : post.liked_by_me ? "Unlike" : "Like"}
          </button>
          <span className="small">Likes are limited to one per user per post.</span>
        </div>
      )}

      <div className="top-gap">
        <h4>Comments</h4>
        {!adminMode && me && (
          <form onSubmit={submitComment} className="comment-form">
            <textarea
              rows="3"
              value={commentText}
              placeholder="Add a comment"
              onChange={(event) => setCommentText(event.target.value)}
            />
            {commentError && <div className="error">{commentError}</div>}
            <div className="toolbar">
              <button type="submit" disabled={workingAction === "comment"}>
                {workingAction === "comment" ? "Posting..." : "Post comment"}
              </button>
            </div>
          </form>
        )}

        {post.comments.length === 0 ? (
          <div className="empty-state">No comments yet.</div>
        ) : (
          <div className="comment-list">
            {post.comments.map((comment) => (
              <div key={comment.id} className="comment-card">
                <div className="toolbar">
                  <Avatar src={comment.author_profile_photo_path} alt={comment.author_name} small />
                  <div>
                    <strong>{comment.author_name}</strong>
                    <div className="small">{formatDate(comment.created_at)}</div>
                  </div>
                </div>
                <p>{comment.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
