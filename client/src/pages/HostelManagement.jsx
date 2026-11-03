import { useEffect, useState } from "react";
import { Building2, Eye, Pencil, Plus, RefreshCw, Save } from "lucide-react";
import { apiRequest } from "../services/api.js";

const EMPTY_FORM = { name: "", address: "", city: "", state: "", pincode: "", contact: "", email: "", photoUrl: "" };

function HostelManagement({ token, onAdd }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "100" });
    if (query.trim()) params.set("q", query.trim());
    if (showArchived) params.set("archived", "true");
    setLoading(true);
    setError("");
    apiRequest(`/api/hostels?${params}`, { token, signal: controller.signal })
      .then((result) => setItems(result.data.items))
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, query, showArchived, reload]);

  const view = async (hostel) => {
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(`/api/hostels/${hostel._id}`, { token });
      setSelected(result.data);
      setForm(Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, result.data[key] || ""])));
      setEditing(false);
      return true;
    } catch (requestError) { setError(requestError.message); return false; }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(`/api/hostels/${selected._id}`, {
        token, method: "PATCH", body: JSON.stringify(form)
      });
      setSelected(result.data);
      setNotice("Hostel details updated.");
      setEditing(false);
      setReload((value) => value + 1);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  const archive = async (hostel) => {
    if (!window.confirm(`Archive ${hostel.name}? This is allowed only when active hostel resources have been archived. Historical records are retained.`)) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/hostels/${hostel._id}`, { token, method: "DELETE" });
      setNotice("Hostel archived; its historical data was retained.");
      setSelected(null);
      setReload((value) => value + 1);
    } catch (requestError) { setError(requestError.message); }
  };

  const restore = async (hostel) => {
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/hostels/${hostel._id}/restore`, { token, method: "POST", body: JSON.stringify({}) });
      setNotice("Hostel restored.");
      setReload((value) => value + 1);
    } catch (requestError) { setError(requestError.message); }
  };

  return <section className="facility-manager" aria-labelledby="hostels-heading">
    <div className="facility-heading-row">
      <div><span className="dashboard-kicker">PLATFORM ADMINISTRATION</span><h2 id="hostels-heading">Hostels</h2><p>View, edit, archive, and restore real hostel records.</p></div>
      <div className="facility-heading-actions">
        <button type="button" className="facility-secondary" onClick={onAdd}><Plus size={16} /> Add hostel</button>
        <button type="button" className="facility-secondary" onClick={() => setReload((value) => value + 1)}><RefreshCw size={16} /> Refresh</button>
      </div>
    </div>
    {error ? <p className="facility-error" role="alert">{error}</p> : null}
    {notice ? <p className="facility-notice" role="status">{notice}</p> : null}
    <div className="allocation-grid">
      <section className="facility-panel" aria-label="Hostel records">
        <div className="student-filter-row">
          <label><Building2 size={16} /><input aria-label="Search hostels" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, code, city, state" /></label>
          <button type="button" className="facility-secondary" aria-pressed={showArchived} onClick={() => { setSelected(null); setShowArchived((value) => !value); }}>{showArchived ? "Show active hostels" : "Show archived"}</button>
        </div>
        {loading ? <p className="facility-state" role="status">Loading hostels…</p> : null}
        {!loading && !items.length ? <p className="facility-empty">No records yet</p> : null}
        <div className="facility-record-list">{items.map((hostel) => <article className="facility-record" key={hostel._id}>
          <div><strong>{hostel.name}</strong><span>{hostel.hostelCode} · {hostel.city || "City unavailable"} · {hostel.status}</span></div>
          <div className="facility-row-actions">
            <button type="button" onClick={() => view(hostel)}><Eye size={14} /> View</button>
            {showArchived ? <button type="button" onClick={() => restore(hostel)}>Restore</button> : <>
              <button type="button" onClick={async () => { if (await view(hostel)) setEditing(true); }}><Pencil size={14} /> Edit</button>
              <button type="button" className="archive" onClick={() => archive(hostel)}>Archive</button>
            </>}
          </div>
        </article>)}</div>
      </section>
      {selected ? <section className="facility-panel">
        <div className="facility-form-heading"><div><h3>{editing ? "Edit hostel" : selected.name}</h3><p>{selected.hostelCode} · {selected.status}</p></div>
          {!editing && !showArchived ? <button type="button" className="facility-secondary" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</button> : null}
        </div>
        {editing ? <form className="facility-form" onSubmit={save}>{Object.entries({ name: "Hostel name", address: "Address", city: "City", state: "State / Union Territory", pincode: "Pincode", contact: "Contact number", email: "Email address", photoUrl: "Cover photo URL" }).map(([key, label]) => <label className="facility-field" key={key}><span>{label}</span><input required={key === "name"} type={key === "email" ? "email" : key === "photoUrl" ? "url" : "text"} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<button type="submit" className="facility-submit" disabled={saving}><Save size={16} />{saving ? "Saving…" : "Save changes"}</button></form>
          : <div className="student-details"><strong>{selected.name}</strong><span>Address: {selected.address || "Not provided"}</span><span>Location: {[selected.city, selected.state, selected.pincode].filter(Boolean).join(", ") || "Not provided"}</span><span>Contact: {selected.contact || "Not provided"}</span><span>Email: {selected.email || "Not provided"}</span></div>}
      </section> : null}
    </div>
  </section>;
}

export default HostelManagement;
