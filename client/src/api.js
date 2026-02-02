export async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
        credentials: "include",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

export async function fetchForm(url, formData) {
    const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: formData, // don't set Content-Type manually
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}
