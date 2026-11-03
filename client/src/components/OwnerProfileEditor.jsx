import { useState } from "react";
import { Check, X } from "lucide-react";
import PhotoField from "./PhotoField.jsx";
import { apiRequest } from "../services/api.js";

function OwnerProfileEditor({ token, user, onClose, onSaved }) {
  const [name, setName] = useState(user.name || "");
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await apiRequest("/api/auth/me", {
        token,
        method: "PATCH",
        body: JSON.stringify({ name, photoUrl })
      });
      onSaved(response.data.user);
      setNotice("Owner profile updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return <form className="owner-profile-editor facility-panel" onSubmit={submit} aria-label="Edit owner profile">
    <div className="facility-form-heading"><div><h2>Owner Profile</h2><p>Update your display name and photo.</p></div><button type="button" className="facility-icon-button" aria-label="Close owner profile" onClick={onClose}><X size={17} /></button></div>
    <label className="facility-field"><span>Full name</span><input required maxLength={128} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <PhotoField token={token} subject="owner" label="Owner Photo" value={photoUrl} onChange={setPhotoUrl} />
    {error ? <p className="facility-error" role="alert">{error}</p> : null}
    {notice ? <p className="facility-notice" role="status">{notice}</p> : null}
    <button className="facility-submit" type="submit" disabled={saving}><Check size={16} />{saving ? "Saving…" : "Save profile"}</button>
  </form>;
}

export default OwnerProfileEditor;
