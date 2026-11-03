import { useEffect, useState } from "react";
import { Check, Edit3, Plus, Search, UserRound } from "lucide-react";
import { apiRequest } from "../services/api.js";
import AuthenticatedPhoto from "../components/AuthenticatedPhoto.jsx";
import PhotoField from "../components/PhotoField.jsx";
import InternationalPhoneInput from "../components/InternationalPhoneInput.jsx";

const EMPTY = { name: "", studentId: "", mobile: "", email: "", photoUrl: "", status: "ACTIVE", password: "", confirmPassword: "" };
function StudentManagement({ token, onAllocate, role = "OWNER" }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState("");
  const [selected, setSelected] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [reload, setReload] = useState(0);
  const canCreateLogin = role === "OWNER" || role === "SYSTEM_ADMIN";

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page), limit: "15" });
    if (showArchived) params.set("archived", "true");
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    apiRequest(`/api/students?${params}`, { token, signal: controller.signal }).then((response) => { setItems(response.data.items); setPagination(response.data.pagination); })
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, query, status, page, reload, showArchived]);

  const resetForm = () => { setForm(EMPTY); setEditing(""); };
  const startEdit = (student) => { setEditing(student._id); setForm({ name: student.name, studentId: student.studentId, mobile: student.mobile || "", email: student.email || "", photoUrl: student.photoUrl || "", status: student.status, password: "", confirmPassword: "" }); setNotice(""); setError(""); };
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!editing && canCreateLogin) {
      if (form.password.length < 8) {
        setError("Set an initial password with at least 8 characters.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError("The password and confirmation do not match.");
        return;
      }
    }

    const payload = { ...form };
    delete payload.confirmPassword;

    if (editing || !canCreateLogin) {
      delete payload.password;
    }

    setSaving(true);
    try {
      await apiRequest(`/api/students${editing ? `/${editing}` : ""}`, {
        token,
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });

      if (editing) {
        setNotice("Student details updated.");
      } else if (canCreateLogin) {
        setNotice(`Student and login account created. Login ID: ${form.studentId}. Login also requires the hostel access code and chosen password.`);
      } else {
        setNotice("Student record created.");
      }

      resetForm();
      setReload((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };
  const showDetails = async (student) => {
    if (selected?._id === student._id) { setSelected(null); return; }
    setError("");
    if (showArchived) { setSelected(student); return; }
    try { const response = await apiRequest(`/api/students/${student._id}`, { token }); setSelected(response.data); }
    catch (requestError) { setError(requestError.message); }
  };
  const toggleStatus = async (student) => {
    setError(""); setNotice("");
    try { await apiRequest(`/api/students/${student._id}`, { token, method: "PATCH", body: JSON.stringify({ status: student.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) }); setNotice("Student status updated."); setReload((current) => current + 1); }
    catch (requestError) { setError(requestError.message); }
  };
  const archiveStudent = async (student) => {
    if (!window.confirm(`Delete ${student.name}? The student record and its history will be retained. This cannot be done while they have an active bed allocation.`)) return;
    setError(""); setNotice("");
    try {
      await apiRequest(`/api/students/${student._id}`, { token, method: "DELETE" });
      setNotice("Student deleted (archived). Historical records have been retained.");
      setSelected(null); setReload((current) => current + 1);
    } catch (requestError) { setError(requestError.message); }
  };
  const restoreStudent = async (student) => {
    setError(""); setNotice("");
    try {
      await apiRequest(`/api/students/${student._id}/restore`, { token, method: "POST", body: JSON.stringify({}) });
      setNotice("Student restored."); setReload((current) => current + 1);
    } catch (requestError) { setError(requestError.message); }
  };
  return <section className="facility-manager" aria-labelledby="students-heading">
    <div className="facility-heading-row"><div><span className="dashboard-kicker">RESIDENT RECORDS</span><h2 id="students-heading">Students</h2><p>Search and manage resident records in the verified hostel.</p></div><button className="facility-secondary" type="button" onClick={() => { resetForm(); document.getElementById("student-name")?.focus(); }}><Plus size={16} /> Add student</button></div>
    <div className="student-layout">
      <section className="facility-panel" aria-label="Student records"><div className="student-filter-row"><label><Search size={16} /><input aria-label="Search students" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} placeholder="Search name, student ID, phone" /></label><select aria-label="Filter by student status" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select><button type="button" className="facility-secondary" aria-pressed={showArchived} onClick={() => { setPage(1); setSelected(null); setShowArchived((visible) => !visible); }}>{showArchived ? "Show active students" : "Show archived"}</button><span>{pagination.total} total</span></div>
      {loading ? <p className="facility-state" role="status">Loading students…</p> : null}{error ? <p className="facility-error" role="alert">{error}</p> : null}{notice ? <p className="facility-notice" role="status">{notice}</p> : null}
      {!loading && !error && !items.length ? <p className="facility-empty">No records yet</p> : null}
      {items.length ? <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Photo</th><th>Name</th><th>Student ID</th><th>Mobile</th><th>Room / Bed</th><th>Status</th><th>Allocation</th><th>QR</th><th>Actions</th></tr></thead><tbody>{items.map((student) => <tr key={student._id}><td>{student.photoUrl ? <AuthenticatedPhoto token={token} className="student-table-photo" value={student.photoUrl} /> : "—"}</td><td><button className="student-name-link" type="button" onClick={() => showDetails(student)}><UserRound size={15} />{student.name}</button></td><td>{student.studentId}</td><td>{student.mobile || "—"}</td><td>{student.roomId?.roomNumber || "—"} / {student.bedId?.bedNumber || "—"}</td><td><span className={`student-status ${student.status.toLowerCase()}`}>{showArchived ? "ARCHIVED" : student.status}</span></td><td>{student.allocationStatus}</td><td>{student.qrStatus}</td><td><div className="facility-row-actions">{showArchived ? <button type="button" onClick={() => restoreStudent(student)}>Restore</button> : <><button type="button" onClick={() => startEdit(student)}><Edit3 size={14} /> Edit</button>{student.bedId ? <button type="button" className="archive" onClick={() => onAllocate(student._id)}>Transfer / Release</button> : <button type="button" onClick={() => onAllocate(student._id)}>Assign</button>}<button type="button" className="archive" onClick={() => toggleStatus(student)}>{student.status === "ACTIVE" ? "Deactivate" : "Activate"}</button><button type="button" className="archive" onClick={() => archiveStudent(student)}>Delete</button></>}</div></td></tr>)}</tbody></table></div> : null}
      {pagination.pages > 1 ? <div className="student-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pagination.pages}</span><button type="button" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next</button></div> : null}
      {selected ? <aside className="student-details">{selected.photoUrl ? <AuthenticatedPhoto token={token} className="student-detail-photo" value={selected.photoUrl} alt={`${selected.name} photo`} /> : null}<strong>{selected.name}</strong><span>ID: {selected.studentId}</span><span>Room: {selected.roomId?.roomNumber || "Unassigned"} · Bed: {selected.bedId?.bedNumber || "Unassigned"}</span><span>QR status: {selected.qrStatus}</span></aside> : null}
      </section>
      <form className="facility-panel facility-form" onSubmit={submit}><div className="facility-form-heading"><div><h3>{editing ? "Edit student" : "Add student"}</h3><p>{canCreateLogin ? "Creates a resident record and secure login account." : "Creates a resident record in this hostel."}</p></div>{editing ? <button type="button" className="facility-icon-button" aria-label="Cancel edit" onClick={resetForm}>×</button> : null}</div>{[["name","Full name"],["studentId","Student ID"],["email","Email"]].map(([key,label]) => <label className="facility-field" key={key}><span>{label}</span><input id={key === "name" ? "student-name" : undefined} type={key === "email" ? "email" : "text"} required={key === "name" || key === "studentId"} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<label className="facility-field"><span>Mobile number (optional)</span><InternationalPhoneInput name="student-mobile" label="Student mobile number" value={form.mobile} onChange={(mobile) => setForm((current) => ({ ...current, mobile }))} /></label>{!editing && canCreateLogin ? <>
        <label className="facility-field"><span>Initial password (minimum 8 characters)</span><input type="password" autoComplete="new-password" minLength={8} maxLength={1024} required value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
        <label className="facility-field"><span>Confirm password</span><input type="password" autoComplete="new-password" required value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
        <p className="facility-help">Student login uses the Student ID, hostel access code and this password.</p>
      </> : null}<PhotoField token={token} subject="student" label="Student Photo" value={form.photoUrl} onChange={(photoUrl) => setForm((current) => ({ ...current, photoUrl }))} />{editing ? <label className="facility-field"><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label> : null}<button className="facility-submit" type="submit" disabled={saving}><Check size={16} />{saving ? "Saving…" : editing ? "Save student" : canCreateLogin ? "Create student & login" : "Create student"}</button></form>
    </div>
  </section>;
}
export default StudentManagement;
