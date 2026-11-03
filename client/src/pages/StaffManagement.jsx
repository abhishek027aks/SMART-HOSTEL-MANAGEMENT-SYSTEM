import { useEffect, useState } from "react";
import { Check, Edit3, Plus, Search, Shield, UserRound } from "lucide-react";
import AuthenticatedPhoto from "../components/AuthenticatedPhoto.jsx";
import PhotoField from "../components/PhotoField.jsx";
import InternationalPhoneInput from "../components/InternationalPhoneInput.jsx";
import { apiRequest } from "../services/api.js";

const EMPTY = { name: "", email: "", mobile: "", role: "WARDEN", password: "", confirmPassword: "", photoUrl: "", status: "ACTIVE" };

function StaffManagement({ token }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (query.trim()) params.set("q", query.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    apiRequest(`/api/staff?${params}`, { token, signal: controller.signal })
      .then((response) => { setItems(response.data.items); setPagination(response.data.pagination); })
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, query, roleFilter, statusFilter, page, reload]);

  const reset = () => { setEditing(""); setForm(EMPTY); };
  const startEdit = async (staff) => {
    setError("");
    setNotice("");
    try {
      const response = await apiRequest(`/api/staff/${staff._id}`, { token });
      setSelected(response.data);
      setEditing(response.data._id);
      setForm({ name: response.data.name, email: response.data.email, mobile: response.data.mobile || "", role: response.data.role, password: "", confirmPassword: "", photoUrl: response.data.photoUrl || "" });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const viewStaff = async (staff) => {
    setError("");
    try {
      const response = await apiRequest(`/api/staff/${staff._id}`, { token });
      setSelected(response.data);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!editing && form.password !== form.confirmPassword) {
      setError("Password and confirmation do not match.");
      return;
    }
    const body = { name: form.name, email: form.email, mobile: form.mobile, photoUrl: form.photoUrl };
    if (!editing) Object.assign(body, { role: form.role, password: form.password, status: form.status });
    setSaving(true);
    try {
      await apiRequest(`/api/staff${editing ? `/${editing}` : ""}`, { token, method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      setNotice(editing ? "Staff details updated." : `${form.role.toLowerCase()} account created.`);
      reset();
      setReload((key) => key + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const setStaffStatus = async (staff, restore) => {
    const action = restore ? "restore access for" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${action} ${staff.name}?`)) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/staff/${staff._id}${restore ? "/restore" : ""}`, {
        token,
        method: restore ? "POST" : "DELETE",
        ...(restore ? { body: JSON.stringify({}) } : {})
      });
      setNotice(restore ? "Staff access restored." : "Staff access deactivated. Their account and history are retained.");
      if (selected?._id === staff._id) setSelected(null);
      setReload((key) => key + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const archiveStaff = async (staff) => {
    if (!window.confirm(
      `Delete ${staff.name} from this hostel? Access to this hostel will be removed and historical records retained.`
    )) return;

    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/staff/${staff._id}/archive`, {
        token,
        method: "DELETE"
      });
      setNotice(`${staff.name} deleted (archived). Historical records were retained.`);
      if (selected?._id === staff._id) setSelected(null);
      if (editing === staff._id) reset();
      setReload((key) => key + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete staff account.");
    }
  };
  return <section className="facility-manager" aria-labelledby="staff-heading">
    <div className="facility-heading-row">
      <div><span className="dashboard-kicker">TEAM ACCESS</span><h2 id="staff-heading">Staff Management</h2><p>Create and manage Warden and Guard access for this hostel.</p></div>
      <button className="facility-secondary" type="button" onClick={() => { reset(); setSelected(null); document.getElementById("staff-name")?.focus(); }}><Plus size={16} /> Add staff</button>
    </div>
    <div className="staff-layout">
      <section className="facility-panel" aria-label="Staff accounts">
        <div className="staff-toolbar">
          <label className="staff-search"><Search size={16} /><input aria-label="Search staff" placeholder="Search name, email, mobile" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} /></label>
          <select aria-label="Filter staff by role" value={roleFilter} onChange={(event) => { setPage(1); setRoleFilter(event.target.value); }}><option value="">All roles</option><option value="WARDEN">Wardens</option><option value="GUARD">Guards</option></select>
          <select aria-label="Filter staff by status" value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="">All statuses</option></select>
        </div>
        {loading ? <p className="facility-state" role="status">Loading staff…</p> : null}
        {error ? <p className="facility-error" role="alert">{error}</p> : null}
        {notice ? <p className="facility-notice" role="status">{notice}</p> : null}
        {!loading && !error && items.length === 0 ? <p className="facility-empty">No records yet</p> : null}
        {items.length > 0 ? <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>Name</th><th>Photo</th><th>Role</th><th>Mobile</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((staff) => <tr key={staff._id}>
          <td><button type="button" className="student-name-link" onClick={() => void viewStaff(staff)}>{staff.name}</button></td><td>{staff.photoUrl ? <AuthenticatedPhoto token={token} className="staff-avatar" value={staff.photoUrl} /> : "—"}</td>
          <td>{staff.role}</td><td>{staff.mobile || "—"}</td><td>{staff.email}</td><td><span className={`student-status ${staff.status.toLowerCase()}`}>{staff.status}</span></td>
          <td><div className="facility-row-actions"><button type="button" onClick={() => void viewStaff(staff)}>View</button><button type="button" onClick={() => void startEdit(staff)}><Edit3 size={14} /> Edit</button>{staff.status === "ACTIVE" ? <button type="button" className="archive" onClick={() => void setStaffStatus(staff, false)}>Deactivate</button> : <button type="button" onClick={() => void setStaffStatus(staff, true)}>Restore</button>}<button type="button" className="archive" onClick={() => void archiveStaff(staff)}>Delete</button></div></td>
        </tr>)}</tbody></table></div> : null}
        {pagination.pages > 1 ? <div className="student-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pagination.pages} · {pagination.total} staff</span><button type="button" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next</button></div> : null}
        <p className="staff-model-note"><Shield size={15} /> Gate and camera assignments are not available in the current data model.</p>
      </section>
      <form className="facility-panel facility-form" onSubmit={submit}>
        <div className="facility-form-heading"><div><h3>{editing ? "Edit staff" : "Add staff"}</h3><p>Only Warden and Guard accounts can be created here.</p></div>{editing ? <button type="button" className="facility-icon-button" aria-label="Cancel edit" onClick={reset}>×</button> : null}</div>
        {[["name","Full name"],["email","Email"]].map(([key, label]) => <label className="facility-field" key={key}><span>{label}</span><input id={key === "name" ? "staff-name" : undefined} required type={key === "email" ? "email" : "text"} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
        <label className="facility-field"><span>Mobile number (optional)</span><InternationalPhoneInput name="staff-mobile" label="Staff mobile number" value={form.mobile} onChange={(mobile) => setForm((current) => ({ ...current, mobile }))} /></label>
        {!editing ? <>
          <label className="facility-field"><span>Role</span><select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}><option value="WARDEN">Warden</option><option value="GUARD">Guard</option></select></label>
          <label className="facility-field"><span>Password</span><input type="password" minLength={8} maxLength={1024} autoComplete="new-password" required value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
          <label className="facility-field"><span>Confirm password</span><input type="password" minLength={8} maxLength={1024} autoComplete="new-password" required value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
          <label className="facility-field"><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
        </> : null}
        <PhotoField token={token} subject="staff" label="Staff Photo" value={form.photoUrl} onChange={(photoUrl) => setForm((current) => ({ ...current, photoUrl }))} />
        <button className="facility-submit" type="submit" disabled={saving}><Check size={16} />{saving ? "Saving…" : editing ? "Save staff" : "Create staff account"}</button>
        {selected ? <aside className="staff-details"><strong>{selected.name}</strong><span>{selected.email}</span><span>{selected.mobile || "No mobile number"}</span><span>{selected.role} · {selected.status}</span></aside> : null}
      </form>
    </div>
  </section>;
}

export default StaffManagement;
