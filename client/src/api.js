let sessionExpired = false;

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

    if (res.status === 401 && data.code === "SESSION_EXPIRED") {
        if (!sessionExpired) {
            sessionExpired = true;
            alert("Your session has expired. Please log in again.");
            window.location.href = "/login";
        }
        return { ok: false, status: 401, data };
    }

    return { ok: res.ok, status: res.status, data };
}

export async function fetchForm(url, formData) {
    const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: formData,
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401 && data.code === "SESSION_EXPIRED") {
        if (!sessionExpired) {
            sessionExpired = true;
            alert("Your session has expired. Please log in again.");
            window.location.href = "/login";
        }
        return { ok: false, status: 401, data };
    }

    return { ok: res.ok, status: res.status, data };
}