import { useState } from "react";

import { fetchForm } from "../api";

const initialForm = {
  title: "",
  body: "",
  read_time_minutes: "5",
  topic_rating: "5",
};

export default function PostComposer({ onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [image, setImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverMsg, setServerMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setServerMsg("");

    const formData = new FormData();
    formData.append("title", form.title);
    formData.append("body", form.body);
    formData.append("read_time_minutes", form.read_time_minutes);
    formData.append("topic_rating", form.topic_rating);
    if (image) formData.append("image", image);

    const response = await fetchForm("/posts", formData);
    setSubmitting(false);

    if (!response.ok) {
      setServerMsg(response.data.message || "Unable to publish the post.");
      setErrors(response.data.errors || {});
      return;
    }

    setForm(initialForm);
    setImage(null);
    setServerMsg("Post published.");
    await onCreated?.();
  }

  return (
    <div className="card">
      <div className="section-title">
        <h2>Create a post</h2>
        <p>Regular users can create posts, comment, and like or unlike other posts.</p>
      </div>

      <form onSubmit={submit} className="form-grid">
        <label>
          Title
          <input value={form.title} onChange={(event) => updateField("title", event.target.value)} />
          {errors.title && <div className="error">{errors.title}</div>}
        </label>

        <label>
          Post text
          <textarea
            rows="5"
            value={form.body}
            onChange={(event) => updateField("body", event.target.value)}
          />
          {errors.body && <div className="error">{errors.body}</div>}
        </label>

        <div className="grid two">
          <label>
            Estimated read time (minutes)
            <input
              type="number"
              min="1"
              max="120"
              value={form.read_time_minutes}
              onChange={(event) => updateField("read_time_minutes", event.target.value)}
            />
            {errors.read_time_minutes && <div className="error">{errors.read_time_minutes}</div>}
          </label>

          <label>
            Topic rating (1-10)
            <input
              type="number"
              min="1"
              max="10"
              value={form.topic_rating}
              onChange={(event) => updateField("topic_rating", event.target.value)}
            />
            {errors.topic_rating && <div className="error">{errors.topic_rating}</div>}
          </label>
        </div>

        <label>
          Optional image (JPEG/PNG)
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(event) => setImage(event.target.files?.[0] || null)}
          />
          {errors.image && <div className="error">{errors.image}</div>}
        </label>

        {serverMsg && <div className={serverMsg === "Post published." ? "success" : "error"}>{serverMsg}</div>}

        <div className="toolbar">
          <button type="submit" disabled={submitting}>
            {submitting ? "Publishing..." : "Publish post"}
          </button>
          <span className="small">Images are optional, but text and both numeric fields are saved and displayed.</span>
        </div>
      </form>
    </div>
  );
}
