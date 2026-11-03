export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest(path, { token, signal, ...options } = {}) {
  const headers = new Headers(options.headers || {});

  if (options.body !== undefined && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);

    try {
      const selectedHostelId = window.sessionStorage.getItem("shms.selectedHostelId");

      if (selectedHostelId && !headers.has("X-Hostel-Id")) {
        headers.set("X-Hostel-Id", selectedHostelId);
      }
    } catch {
      // Backend will use the hostel context already verified in the access token.
    }
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    if (error instanceof TypeError) {
      throw new ApiError("Unable to connect to the server. Check your connection and try again.", 0);
    }
    throw error;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(payload?.message || "The request could not be completed.", response.status);
  }

  return payload;
}
