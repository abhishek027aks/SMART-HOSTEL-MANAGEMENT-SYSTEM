import { useEffect, useState } from "react";
import { Check, Edit3, Plus, Search, Trash2, UserRound } from "lucide-react";
import { apiRequest } from "../services/api.js";
import InternationalPhoneInput from "../components/InternationalPhoneInput.jsx";

const EMPTY = {
  parentId: "",
  name: "",
  email: "",
  mobile: "",
  relationship: "FATHER",
  studentIds: [],
  password: "",
  confirmPassword: "",
  status: "ACTIVE"
};

function ParentManagement({ token }) {
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState("");
  const [deleting, setDeleting] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      page: String(page),
      limit: "25"
    });

    if (query.trim()) params.set("q", query.trim());
    if (statusFilter) params.set("status", statusFilter);

    apiRequest(`/api/parents?${params}`, {
      token,
      signal: controller.signal
    })
      .then((response) => {
        setItems(response.data.items || []);
        setPagination(response.data.pagination || { pages: 0, total: 0 });
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "Unable to load parent accounts.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, query, statusFilter, page, reload]);

  useEffect(() => {
    const controller = new AbortController();

    setStudentsLoading(true);
    setStudentsError("");

    (async () => {
      try {
        const first = await apiRequest("/api/students?page=1&limit=100&status=ACTIVE", {
          token,
          signal: controller.signal
        });

        if (!Array.isArray(first?.data?.items)) {
          throw new Error("Student API returned an unexpected response format.");
        }

        const pageCount = Math.max(1, Number(first.data.pagination?.pages) || 1);
        const allStudents = [...first.data.items];

        for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
          const response = await apiRequest(
            `/api/students?page=${pageNumber}&limit=100&status=ACTIVE`,
            { token, signal: controller.signal }
          );

          if (!Array.isArray(response?.data?.items)) {
            throw new Error(`Unexpected response while loading student page ${pageNumber}.`);
          }
          allStudents.push(...response.data.items);
        }

        const uniqueStudents = new Map(
          allStudents
            .filter((student) => student?._id && student.status === "ACTIVE")
            .map((student) => [String(student._id), student])
        );

        if (!controller.signal.aborted) {
          setStudents([...uniqueStudents.values()]);
        }
      } catch (requestError) {
        if (requestError.name !== "AbortError" && !controller.signal.aborted) {
          setStudentsError(`Unable to load active students: ${requestError.message}`);
        }
      } finally {
        if (!controller.signal.aborted) setStudentsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [token, reload]);
  const reset = () => {
    setEditing("");
    setForm(EMPTY);
    setSelected(null);
  };

  const changeField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleStudent = (studentId) => {
    setForm((current) => ({
      ...current,
      studentIds: current.studentIds.includes(studentId)
        ? current.studentIds.filter((id) => id !== studentId)
        : [...current.studentIds, studentId]
    }));
  };

  const startEdit = async (parent) => {
    setError("");
    setNotice("");

    try {
      const response = await apiRequest(`/api/parents/${parent._id}`, { token });
      const item = response.data;

      setSelected(item);
      setEditing(item._id);
      setForm({
        parentId: item.parentId || "",
        name: item.name || "",
        email: item.email || "",
        mobile: item.mobile || "",
        relationship: item.relationship || "GUARDIAN",
        studentIds: (item.studentIds || []).map((student) =>
          typeof student === "string" ? student : student._id
        ),
        password: "",
        confirmPassword: "",
        status: item.status || "ACTIVE"
      });
    } catch (requestError) {
      setError(requestError.message || "Unable to load parent details.");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!form.email.trim() && !form.mobile.trim()) {
      setError("Enter at least an email address or mobile number for login.");
      return;
    }

    if (!form.studentIds.length) {
      setError("Link at least one active student to this parent.");
      return;
    }

    if (!editing && form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (form.password && form.password !== form.confirmPassword) {
      setError("Password and confirmation do not match.");
      return;
    }

    const body = {
      name: form.name.trim(),
      relationship: form.relationship,
      studentIds: form.studentIds,
      status: form.status
    };

    if (!editing) body.parentId = form.parentId.trim();
    if (form.email.trim()) body.email = form.email.trim();
    if (form.mobile.trim()) body.mobile = form.mobile.trim();
    if (form.password) body.password = form.password;

    setSaving(true);

    try {
      await apiRequest(`/api/parents${editing ? `/${editing}` : ""}`, {
        token,
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body)
      });

      setNotice(
        editing
          ? "Parent details and account settings updated."
          : "Parent account created. Login uses the registered email or mobile number and the chosen password."
      );

      reset();
      setReload((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to save parent account.");
    } finally {
      setSaving(false);
    }
  };

  const archiveParent = async (parent) => {
    if (!window.confirm(
      `Delete the Parent account for ${parent.name}? Their login will be disabled. Student records and history will be retained.`
    )) return;

    setError("");
    setNotice("");
    setDeleting(parent._id);

    try {
      await apiRequest(`/api/parents/${parent._id}`, {
        token,
        method: "DELETE"
      });
      setNotice(`Parent ${parent.name} deleted. Student records were retained.`);
      if (editing === parent._id) reset();
      setReload((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete parent account.");
    } finally {
      setDeleting("");
    }
  };
  return (
    <section className="facility-manager" aria-labelledby="parents-heading">
      <div className="facility-heading-row">
        <div>
          <span className="dashboard-kicker">FAMILY ACCESS</span>
          <h2 id="parents-heading">Parent Management</h2>
          <p>Create parent login accounts and securely link them to hostel students.</p>
        </div>
        <button
          className="facility-secondary"
          type="button"
          onClick={() => reset()}
        >
          <Plus size={16} /> Add parent
        </button>
      </div>

      <div className="staff-layout">
        <section className="facility-panel" aria-label="Parent accounts">
          <div className="staff-toolbar">
            <label className="staff-search">
              <Search size={16} />
              <input
                aria-label="Search parents"
                placeholder="Search name, ID, email or mobile"
                value={query}
                onChange={(event) => {
                  setPage(1);
                  setQuery(event.target.value);
                }}
              />
            </label>
            <select
              aria-label="Filter parents by status"
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="">All statuses</option>
            </select>
          </div>

          {loading ? <p className="facility-state" role="status">Loading parent accounts...</p> : null}
          {error ? <p className="facility-error" role="alert">{error}</p> : null}
          {notice ? <p className="facility-notice" role="status">{notice}</p> : null}

          {!loading && !error && items.length === 0
            ? <p className="facility-empty">No parent accounts found.</p>
            : null}

          {items.length > 0 ? (
            <div className="staff-table-wrap">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Parent ID</th>
                    <th>Name</th>
                    <th>Relationship</th>
                    <th>Login contact</th>
                    <th>Linked students</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((parent) => (
                    <tr key={parent._id}>
                      <td>{parent.parentId}</td>
                      <td>
                        <button
                          type="button"
                          className="student-name-link"
                          onClick={() => void startEdit(parent)}
                        >
                          {parent.name}
                        </button>
                      </td>
                      <td>{parent.relationship}</td>
                      <td>{parent.mobile || parent.email || "-"}</td>
                      <td>
                        {(parent.studentIds || []).map((student) =>
                          `${student.name} (${student.studentId})`
                        ).join(", ") || "-"}
                      </td>
                      <td>
                        <span className={`student-status ${(parent.status || "INACTIVE").toLowerCase()}`}>
                          {parent.status}
                        </span>
                      </td>
                      <td>
                        <div className="facility-row-actions">
                          <button type="button" onClick={() => void startEdit(parent)}>
                            <Edit3 size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            className="archive"
                            disabled={deleting === parent._id}
                            onClick={() => void archiveParent(parent)}
                          >
                            <Trash2 size={14} /> {deleting === parent._id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {pagination.pages > 1 ? (
            <div className="student-pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <span>Page {page} of {pagination.pages} · {pagination.total} parents</span>
              <button
                type="button"
                disabled={page >= pagination.pages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          ) : null}

          <p className="staff-model-note">
            <UserRound size={15} /> Parent login uses the registered email or mobile number and password.
          </p>
        </section>

        <form className="facility-panel facility-form" onSubmit={submit}>
          <div className="facility-form-heading">
            <div>
              <h3>{editing ? "Edit parent account" : "Create parent account"}</h3>
              <p>
                {editing
                  ? "Update contact details, linked students, status or password."
                  : "Set an initial password and link one or more active students."}
              </p>
            </div>
            {editing ? (
              <button
                type="button"
                className="facility-icon-button"
                aria-label="Cancel edit"
                onClick={reset}
              >
                ×
              </button>
            ) : null}
          </div>

          {!editing ? (
            <label className="facility-field">
              <span>Parent ID</span>
              <input
                required
                maxLength={64}
                value={form.parentId}
                onChange={(event) => changeField("parentId", event.target.value)}
                placeholder="Example: PARENT-001"
              />
            </label>
          ) : (
            <label className="facility-field">
              <span>Parent ID</span>
              <input value={form.parentId} readOnly />
            </label>
          )}

          <label className="facility-field">
            <span>Full name</span>
            <input
              required
              maxLength={128}
              value={form.name}
              onChange={(event) => changeField("name", event.target.value)}
              autoComplete="name"
            />
          </label>

          <label className="facility-field">
            <span>Email address (optional if mobile is provided)</span>
            <input
              type="email"
              maxLength={254}
              value={form.email}
              onChange={(event) => changeField("email", event.target.value)}
              autoComplete="email"
            />
          </label>

          <label className="facility-field">
            <span>Mobile number (optional if email is provided)</span>
            <InternationalPhoneInput
              name="parent-mobile"
              label="Parent mobile number"
              value={form.mobile}
              onChange={(mobile) => changeField("mobile", mobile)}
            />
          </label>

          <label className="facility-field">
            <span>Relationship to student</span>
            <select
              required
              value={form.relationship}
              onChange={(event) => changeField("relationship", event.target.value)}
            >
              <option value="FATHER">Father</option>
              <option value="MOTHER">Mother</option>
              <option value="GUARDIAN">Guardian</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <fieldset className="facility-field">
            <legend>Link active students</legend>
            {studentsError ? <div className="facility-error" role="alert">{studentsError} <button type="button" onClick={() => setReload((current) => current + 1)}>Retry</button></div> : null}
            {studentsLoading ? <p className="facility-state">Loading students...</p> : null}
            {!studentsLoading && !studentsError && students.length === 0
              ? <p className="facility-empty">No active students found. Create a student first or check the student status.</p>
              : null}
            {students.map((student) => (
              <label key={student._id} className="parent-student-option">
                <input
                  type="checkbox"
                  checked={form.studentIds.includes(student._id)}
                  onChange={() => toggleStudent(student._id)}
                />
                <span>
                  <strong>{student.name}</strong>
                  <small>{student.studentId}{student.mobile ? ` · ${student.mobile}` : ""}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="facility-field">
            <span>{editing ? "New password (leave blank to keep current password)" : "Initial password (minimum 8 characters)"}</span>
            <input
              type="password"
              minLength={editing ? 0 : 8}
              maxLength={1024}
              autoComplete="new-password"
              required={!editing}
              value={form.password}
              onChange={(event) => changeField("password", event.target.value)}
            />
          </label>

          <label className="facility-field">
            <span>Confirm password{editing ? " (if changing)" : ""}</span>
            <input
              type="password"
              maxLength={1024}
              autoComplete="new-password"
              required={!editing}
              value={form.confirmPassword}
              onChange={(event) => changeField("confirmPassword", event.target.value)}
            />
          </label>

          <label className="facility-field">
            <span>Account status</span>
            <select
              value={form.status}
              onChange={(event) => changeField("status", event.target.value)}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>

          <button
            className="facility-submit"
            type="submit"
            disabled={saving || studentsLoading}
          >
            <Check size={16} />
            {saving ? "Saving..." : editing ? "Save parent changes" : "Create parent account"}
          </button>

          {selected ? (
            <aside className="staff-details">
              <strong>{selected.name}</strong>
              <span>{selected.email || "No email address"}</span>
              <span>{selected.mobile || "No mobile number"}</span>
              <span>{selected.relationship} · {selected.status}</span>
            </aside>
          ) : null}
        </form>
      </div>
    </section>
  );
}

export default ParentManagement;
