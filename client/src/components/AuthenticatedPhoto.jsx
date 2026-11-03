import { useEffect, useState } from "react";
import { API_BASE_URL } from "../services/api.js";

function AuthenticatedPhoto({ value, token, alt = "", className = "" }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!value) {
      setSrc("");
      return undefined;
    }
    if (!value.startsWith("/api/uploads/photos/")) {
      setSrc(value);
      return undefined;
    }
    const controller = new AbortController();
    let objectUrl = "";
    setSrc("");
    fetch(`${API_BASE_URL}${value}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    }).then((response) => {
      if (!response.ok) throw new Error("Photo unavailable");
      return response.blob();
    }).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch((error) => {
      if (error.name !== "AbortError") setSrc("");
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [value, token]);

  if (!src) return <span className={`${className} authenticated-photo-placeholder`} aria-label={alt || "Photo unavailable"} />;
  return <img className={className} src={src} alt={alt} />;
}

export default AuthenticatedPhoto;
