import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, MessageSquareWarning, RefreshCw, Send } from "lucide-react";
import { apiRequest } from "../services/api.js";

const categories = ["FAN", "WATER", "ELECTRICITY", "ROOM", "FOOD", "CLEANLINESS", "SECURITY", "OTHER"];
const priorities = ["LOW", "MEDIUM", "HIGH"];

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "Invalid date";
}

function label(value) {
  return String(value || "").replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default function ComplaintPage({ token, role }) {
  const isStudent = role === "STUDENT";
  const isParent = role === "PARENT";
  const canManage = ["OWNER", "WARDEN", "SYSTEM_ADMIN"].includes(role);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState({});
  const [formBusy, setFormBusy] = useState(false);
  const [form, setForm] = useState({ title: "", category: "OTHER", priority: "MEDIUM", description: "" });

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const path = isStudent || isParent ? "/api/complaints/mine" : "/api/complaints";
      const response = await apiRequest(path, { token, signal });
      if (!Array.isArray(response?.data?.items)) throw new Error("The server returned an invalid complaint list.");
      setItems(response.data.items);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "Unable to load complaints.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [isParent, isStudent, token]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey]);

  const submit = async (event) => {
    event.preventDefault();
    setFormBusy(true);
    setFeedback("");
    try {
      await apiRequest("/api/complaints", { method: "POST", token, body: form });
      setForm({ title: "", category: "OTHER", priority: "MEDIUM", description: "" });
      setFeedback("Complaint submitted. Hostel staff can now review it.");
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      setFeedback(requestError.message || "Unable to submit this complaint.");
    } finally {
      setFormBusy(false);
    }
  };

  const updateStatus = async (id, status) => {
    setBusyId(id);
    setFeedback("");
    try {
      await apiRequest(`/api/complaints/${id}/status`, { method: "PATCH", token, body: { status, note: notes[id] || "" } });
      setFeedback(`Complaint marked ${label(status)}.`);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      setFeedback(requestError.message || "Unable to update this complaint.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="complaint-module" aria-labelledby="complaint-heading">
      <header className="complaint-heading">
        <span className="complaint-heading-icon"><MessageSquareWarning size={24} aria-hidden="true" /></span>
        <div>
          <span className="dashboard-kicker">SUPPORT DESK</span>
          <h2 id="complaint-heading">{isStudent ? "My complaints" : isParent ? "Student complaints" : "Complaint management"}</h2>
          <p>{isStudent ? "Report a real hostel issue and follow its progress." : "Review live complaint records for your verified hostel."}</p>
        </div>
        <button type="button" className="facility-secondary" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </header>

      {isStudent ? (
        <form className="complaint-form" onSubmit={submit}>
          <div className="complaint-section-title"><div><span>NEW REQUEST</span><h3>Report an issue</h3></div><Send size={21} aria-hidden="true" /></div>
          <div className="complaint-form-grid">
            <label className="complaint-field complaint-field-wide">Title<input required minLength="3" maxLength="160" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Example: Water leakage in my room" /></label>
            <label className="complaint-field">Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category} value={category}>{label(category)}</option>)}</select></label>
            <label className="complaint-field">Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{priorities.map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}</select></label>
            <label className="complaint-field complaint-field-wide">Description<textarea required minLength="5" maxLength="2000" rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the issue and where it is happening." /></label>
          </div>
          <button className="facility-primary" type="submit" disabled={formBusy}><Send size={16} aria-hidden="true" />{formBusy ? "Submitting..." : "Submit complaint"}</button>
        </form>
      ) : null}

      {feedback ? <p className={feedback.includes("Unable") ? "complaint-feedback error" : "complaint-feedback success"} role="status">{feedback}</p> : null}

      <section className="complaint-records" aria-label="Complaint records">
        {loading ? <div className="complaint-state" role="status">Loading complaint records...</div> : null}
        {!loading && error ? <div className="complaint-state error" role="alert"><p>{error}</p><button type="button" className="facility-secondary" onClick={() => setReloadKey((value) => value + 1)}>Try again</button></div> : null}
        {!loading && !error && items.length === 0 ? <div className="complaint-state"><MessageSquareWarning size={25} aria-hidden="true" /><strong>No complaints found</strong><span>{isStudent ? "Submit a complaint when you need hostel support." : "There are no matching complaint records in this hostel."}</span></div> : null}
        {!loading && !error ? <div className="complaint-list">{items.map((item) => (
          <article className="complaint-card" key={item._id}>
            <div className="complaint-card-top"><div><span className="complaint-category">{label(item.category)}</span><h3>{item.title}</h3>{(isParent || canManage) && item.studentId ? <span className="complaint-student">{item.studentId.name || "Student"}{item.studentId.studentId ? ` - ${item.studentId.studentId}` : ""}</span> : null}</div><span className={`complaint-status ${String(item.status || "").toLowerCase().replaceAll("_", "-")}`}>{label(item.status)}</span></div>
            <p className="complaint-description">{item.description}</p>
            <div className="complaint-meta"><span>Priority: <strong>{label(item.priority)}</strong></span><span>Submitted: <strong>{formatDate(item.createdAt)}</strong></span>{item.resolvedAt ? <span>Resolved: <strong>{formatDate(item.resolvedAt)}</strong></span> : null}</div>
            {item.statusNote ? <p className="complaint-note">Latest update: {item.statusNote}</p> : null}
            {canManage && item.status !== "RESOLVED" ? <div className="complaint-actions"><label className="complaint-field"><span>Update note</span><input maxLength="1000" value={notes[item._id] || ""} onChange={(event) => setNotes({ ...notes, [item._id]: event.target.value })} placeholder="Optional update for the student" /></label><div><button className="facility-secondary" type="button" disabled={busyId === item._id} onClick={() => updateStatus(item._id, "IN_PROGRESS")}><Clock3 size={16} aria-hidden="true" />In progress</button><button className="facility-primary" type="button" disabled={busyId === item._id} onClick={() => updateStatus(item._id, "RESOLVED")}><CheckCircle2 size={16} aria-hidden="true" />Resolve</button></div></div> : null}
            {Array.isArray(item.history) && item.history.length ? <details className="complaint-history"><summary>View history ({item.history.length})</summary><ol>{item.history.map((history, index) => <li key={`${history.at || index}-${history.action}`}><strong>{label(history.action)}</strong><span>{label(history.fromStatus)} to {label(history.toStatus)} by {label(history.actorRole)}</span><time>{formatDate(history.at)}</time>{history.note ? <p>{history.note}</p> : null}</li>)}</ol></details> : null}
          </article>
        ))}</div> : null}
      </section>
    </section>
  );
}
