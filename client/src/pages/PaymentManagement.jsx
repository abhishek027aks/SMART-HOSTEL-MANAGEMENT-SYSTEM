import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CreditCard, Eye, PlusCircle, RefreshCw, XCircle } from "lucide-react";
import { API_BASE_URL, apiRequest } from "../services/api.js";
import "../styles/payments.css";

const money = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
}).format(Number(value || 0));
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "Not set";

export default function PaymentManagement({ token }) {
  const [students, setStudents] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({
    studentId: "", title: "Monthly hostel rent", description: "",
    amount: "", dueDate: ""
  });

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [fees, studentsResult] = await Promise.all([
        apiRequest("/api/payments", { token, signal }),
        apiRequest("/api/students?limit=100", { token, signal })
      ]);
      setItems(fees.data?.items || []);
      setStudents(studentsResult.data?.items || []);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "Unable to load fees.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  const createInvoice = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest("/api/payments", {
        token,
        method: "POST",
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          dueDate: form.dueDate || null
        })
      });
      setForm({ studentId: "", title: "Monthly hostel rent", description: "", amount: "", dueDate: "" });
      setNotice("Fee invoice created and assigned to the student.");
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not create fee invoice.");
    } finally {
      setSaving(false);
    }
  };

  const review = async (item, decision) => {
    let rejectionReason = "";
    if (decision === "REJECT") {
      rejectionReason = window.prompt("Reason for rejecting this payment proof:")?.trim() || "";
      if (!rejectionReason) return;
    }
    if (decision === "APPROVE" && !window.confirm(`Verify receipt of ${money(item.amount)} and mark this fee Paid?`)) return;

    setBusyId(item._id);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/payments/${item._id}/review`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ decision, rejectionReason })
      });
      setNotice(decision === "APPROVE" ? "Payment verified. Receipt number generated." : "Payment proof rejected.");
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Review action failed.");
    } finally {
      setBusyId("");
    }
  };

  const openProof = async (item) => {
    const popup = window.open("about:blank", "_blank");
    setError("");
    try {
      const response = await fetch(
        `${API_BASE_URL.replace(/\/+$/, "")}/api/payments/${item._id}/proof`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "Could not open payment proof.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (popup) popup.location.href = url;
      else window.open(url, "_blank");
    } catch (requestError) {
      if (popup) popup.close();
      setError(requestError.message || "Could not open payment proof.");
    }
  };

  return (
    <section className="payment-management" aria-labelledby="payment-management-title">
      <header className="payment-heading">
        <div>
          <span className="dashboard-kicker">HOSTEL ACCOUNTS</span>
          <h2 id="payment-management-title">Fee Management</h2>
          <p>Create student fee invoices, verify payment screenshots and issue receipts.</p>
        </div>
        <button type="button" className="facility-secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      {error ? <p className="payment-error" role="alert">{error}</p> : null}
      {notice ? <p className="payment-success" role="status">{notice}</p> : null}

      <form className="payment-invoice-form" onSubmit={createInvoice}>
        <h3><PlusCircle size={18} /> Create fee invoice</h3>
        <div className="payment-form-grid">
          <label className="payment-field">
            <span>Student</span>
            <select required value={form.studentId} onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))}>
              <option value="">Select student</option>
              {students.filter((student) => student.status === "ACTIVE").map((student) => (
                <option value={student._id} key={student._id}>{student.name} · {student.studentId}</option>
              ))}
            </select>
          </label>
          <label className="payment-field">
            <span>Fee title</span>
            <input required maxLength="120" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label className="payment-field">
            <span>Amount (INR)</span>
            <input required type="number" min="0.01" max="10000000" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
          </label>
          <label className="payment-field">
            <span>Due date</span>
            <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
          </label>
          <label className="payment-field payment-field-wide">
            <span>Description / billing period</span>
            <input maxLength="500" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="For example, October 2026 hostel rent" />
          </label>
        </div>
        <button className="facility-submit payment-button" type="submit" disabled={saving}>
          <CreditCard size={16} /> {saving ? "Creating..." : "Create fee invoice"}
        </button>
        {students.length === 0 ? <p className="payment-muted">No student records are available. Add an active student first.</p> : null}
      </form>

      <div className="payment-section-title">
        <h3>Fee records & payment submissions</h3>
        <span>{items.length} records loaded</span>
      </div>

      {loading ? <p className="payment-state">Loading fee records...</p> : null}
      {!loading && items.length === 0 ? <div className="payment-empty">No invoices created yet.</div> : null}

      <div className="payment-list">
        {items.map((item) => (
          <article className="payment-card" key={item._id}>
            <div className="payment-card-top">
              <div>
                <span className={`payment-status payment-status-${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span>
                <h3>{item.title}</h3>
                <p>{item.studentId?.name || "Student"} · ID: {item.studentId?.studentId || "—"}</p>
                {item.description ? <p>{item.description}</p> : null}
              </div>
              <strong className="payment-amount">{money(item.amount)}</strong>
            </div>
            <div className="payment-detail-grid">
              <div><span>Due date</span><strong>{dateLabel(item.dueDate)}</strong></div>
              <div><span>Method</span><strong>{item.paymentMethod || "—"}</strong></div>
              <div><span>Transaction reference</span><strong>{item.transactionReference || "—"}</strong></div>
            </div>

            {item.status === "PENDING_VERIFICATION" ? (
              <div className="payment-review-actions">
                {item.proofAvailable ? (
                  <button type="button" className="facility-secondary" onClick={() => openProof(item)}>
                    <Eye size={16} /> View payment screenshot
                  </button>
                ) : (
                  <span className="payment-muted">No screenshot attached (cash submission).</span>
                )}
                <button type="button" className="facility-submit payment-button" disabled={busyId === item._id} onClick={() => review(item, "APPROVE")}>
                  <CheckCircle2 size={16} /> Verify & mark Paid
                </button>
                <button type="button" className="facility-secondary payment-reject-button" disabled={busyId === item._id} onClick={() => review(item, "REJECT")}>
                  <XCircle size={16} /> Reject proof
                </button>
              </div>
            ) : null}

            {item.status === "REJECTED" ? <p className="payment-error">Rejected: {item.rejectionReason}</p> : null}
            {item.status === "PAID" ? (
              <p className="payment-success">Verified receipt: <strong>{item.receiptNumber}</strong> · Paid on {dateLabel(item.paidAt)}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}