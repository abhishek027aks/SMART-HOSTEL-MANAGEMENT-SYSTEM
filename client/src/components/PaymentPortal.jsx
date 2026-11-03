import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Clock, CreditCard, FileImage, Printer, RefreshCw, Upload } from "lucide-react";
import { API_BASE_URL, apiRequest } from "../services/api.js";
import "../styles/payments.css";

const money = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
}).format(Number(value || 0));

const dateLabel = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "Not set";

const payUri = (invoice, settings, hostelName) => {
  if (!settings?.upiId) return "";
  const query = new URLSearchParams({
    pa: settings.upiId,
    pn: settings.payeeName || hostelName || "Hostel",
    am: String(invoice.amount),
    cu: "INR",
    tn: invoice.title.slice(0, 80)
  });
  return `upi://pay?${query.toString()}`;
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

function printReceipt(invoice, hostelName) {
  if (!invoice.receiptNumber || invoice.status !== "PAID") return;
  const popup = window.open("", "_blank", "width=800,height=700");
  if (!popup) {
    window.alert("Please allow pop-ups to print the receipt.");
    return;
  }

  popup.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Fee Receipt ${escapeHtml(invoice.receiptNumber)}</title>
<style>
body{font-family:Arial,sans-serif;color:#172b42;margin:36px}
header{border-bottom:2px solid #1b72da;padding-bottom:18px}
h1{margin:0 0 8px}p{line-height:1.5}.row{display:flex;justify-content:space-between;gap:18px;padding:12px 0;border-bottom:1px solid #ddd}
.amount{font-size:24px;font-weight:bold}.stamp{margin-top:28px;color:#16814a;font-weight:bold}
@media print{button{display:none}body{margin:15mm}}
</style></head><body>
<header><h1>${escapeHtml(hostelName || "Smart Hostel Management System")}</h1>
<p>OFFICIAL FEE PAYMENT RECEIPT</p></header>
<div class="row"><span>Receipt number</span><strong>${escapeHtml(invoice.receiptNumber)}</strong></div>
<div class="row"><span>Student</span><strong>${escapeHtml(invoice.studentId?.name || "Student")}</strong></div>
<div class="row"><span>Student ID</span><strong>${escapeHtml(invoice.studentId?.studentId || "—")}</strong></div>
<div class="row"><span>Fee description</span><strong>${escapeHtml(invoice.title)}</strong></div>
<div class="row"><span>Payment method</span><strong>${escapeHtml(invoice.paymentMethod || "—")}</strong></div>
<div class="row"><span>Transaction reference</span><strong>${escapeHtml(invoice.transactionReference || "—")}</strong></div>
<div class="row"><span>Payment date</span><strong>${escapeHtml(dateLabel(invoice.paidAt))}</strong></div>
<div class="row"><span>Amount received</span><strong class="amount">${escapeHtml(money(invoice.amount))}</strong></div>
<p class="stamp">✓ PAYMENT VERIFIED</p>
<p>This receipt confirms that the above fee record was verified by the hostel administrator.</p>
<button onclick="window.print()">Print / Save as PDF</button>
</body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

export default function PaymentPortal({ token, mode = "student" }) {
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({});
  const [hostelName, setHostelName] = useState("Hostel");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState("");
  const [qrImages, setQrImages] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    apiRequest("/api/payments/mine", { token, signal: controller.signal })
      .then((response) => {
        setItems(response.data?.items || []);
        setSettings(response.data?.paymentSettings || {});
        setHostelName(response.data?.hostelName || "Hostel");
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message || "Unable to load fees.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, refreshKey]);

  useEffect(() => {
    let active = true;
    const generate = async () => {
      if (!settings.upiId) {
        setQrImages({});
        return;
      }
      const entries = await Promise.all(items
        .filter((item) => item.status === "DUE" || item.status === "REJECTED")
        .map(async (item) => {
          const uri = payUri(item, settings, hostelName);
          try {
            return [item._id, await QRCode.toDataURL(uri, { width: 180, margin: 1 })];
          } catch {
            return [item._id, ""];
          }
        }));
      if (active) setQrImages(Object.fromEntries(entries));
    };
    void generate();
    return () => { active = false; };
  }, [items, settings, hostelName]);

  const updateDraft = (id, patch) => setDrafts((current) => ({
    ...current,
    [id]: { method: "UPI", reference: "", file: null, ...current[id], ...patch }
  }));

  const submitProof = async (event, invoice) => {
    event.preventDefault();
    const draft = drafts[invoice._id] || { method: "UPI", reference: "", file: null };

    if (draft.method !== "CASH" && !draft.file) {
      setError("Upload the payment screenshot before submitting UPI/bank-transfer proof.");
      return;
    }
    if (draft.method !== "CASH" && !draft.reference.trim()) {
      setError("Enter the UTR or transaction reference.");
      return;
    }

    setBusyId(invoice._id);
    setError("");
    setNotice("");

    try {
      const body = new FormData();
      body.append("paymentMethod", draft.method);
      body.append("transactionReference", draft.reference.trim());
      if (draft.file) body.append("proof", draft.file);

      const response = await fetch(
        `${API_BASE_URL.replace(/\/+$/, "")}/api/payments/${invoice._id}/submit`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Payment proof could not be submitted.");

      setNotice("Proof submitted. Payment will be marked Paid only after hostel verification.");
      setDrafts((current) => ({ ...current, [invoice._id]: { method: "UPI", reference: "", file: null } }));
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Payment proof could not be submitted.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="payment-portal" aria-labelledby={`payments-title-${mode}`}>
      <header className="payment-heading">
        <div>
          <span className="dashboard-kicker">FEE MANAGEMENT</span>
          <h2 id={`payments-title-${mode}`}>Fees & Payments</h2>
          <p>View fee dues, submit payment proof and print verified receipts.</p>
        </div>
        <button type="button" className="facility-secondary" onClick={() => setRefreshKey((n) => n + 1)} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </header>

      {loading ? <p className="payment-state">Loading fee records...</p> : null}
      {error ? <p className="payment-error" role="alert">{error}</p> : null}
      {notice ? <p className="payment-success" role="status">{notice}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="payment-empty">
          <CreditCard size={28} aria-hidden="true" />
          <h3>No fee invoices yet</h3>
          <p>Your hostel administrator will publish your fee dues here.</p>
        </div>
      ) : null}

      <div className="payment-list">
        {items.map((invoice) => {
          const draft = drafts[invoice._id] || { method: "UPI", reference: "", file: null };
          const canSubmit = invoice.status === "DUE" || invoice.status === "REJECTED";
          return (
            <article className="payment-card" key={invoice._id}>
              <div className="payment-card-top">
                <div>
                  <span className={`payment-status payment-status-${invoice.status.toLowerCase()}`}>
                    {invoice.status.replaceAll("_", " ")}
                  </span>
                  <h3>{invoice.title}</h3>
                  {mode === "parent" && invoice.studentId ? (
                    <p className="payment-muted">
                      Student: {invoice.studentId.name} · ID: {invoice.studentId.studentId}
                    </p>
                  ) : null}
                  {invoice.description ? <p>{invoice.description}</p> : null}
                </div>
                <strong className="payment-amount">{money(invoice.amount)}</strong>
              </div>

              <div className="payment-detail-grid">
                <div><span>Due date</span><strong>{dateLabel(invoice.dueDate)}</strong></div>
                <div><span>Created</span><strong>{dateLabel(invoice.createdAt)}</strong></div>
                <div><span>Payment method</span><strong>{invoice.paymentMethod || "Not submitted"}</strong></div>
              </div>

              {invoice.status === "PENDING_VERIFICATION" ? (
                <p className="payment-pending-note"><Clock size={16} /> Proof submitted. Waiting for hostel verification.</p>
              ) : null}

              {invoice.status === "REJECTED" ? (
                <p className="payment-error">Rejected: {invoice.rejectionReason || "Please submit updated payment proof."}</p>
              ) : null}

              {invoice.status === "PAID" ? (
                <div className="payment-receipt-row">
                  <span><CheckCircle2 size={17} /> Verified receipt: {invoice.receiptNumber}</span>
                  <button type="button" className="facility-submit payment-button" onClick={() => printReceipt(invoice, hostelName)}>
                    <Printer size={16} /> Print / Save receipt
                  </button>
                </div>
              ) : null}

              {invoice.status !== "PAID" && invoice.proofAvailable ? (
                <p className="payment-muted"><FileImage size={15} /> Payment proof submitted.</p>
              ) : null}

              {canSubmit ? (
                <form className="payment-submit-form" onSubmit={(event) => submitProof(event, invoice)}>
                  <h4>Submit payment</h4>

                  {settings.upiId ? (
                    <div className="payment-upi-box">
                      <div>
                        <span>Pay to UPI ID</span>
                        <strong>{settings.upiId}</strong>
                        {settings.payeeName ? <small>{settings.payeeName}</small> : null}
                        <a className="payment-upi-link" href={payUri(invoice, settings, hostelName)}>
                          Open UPI app · {money(invoice.amount)}
                        </a>
                      </div>
                      {qrImages[invoice._id] ? (
                        <img src={qrImages[invoice._id]} alt={`UPI payment QR for ${invoice.title}`} width="130" height="130" />
                      ) : null}
                    </div>
                  ) : (
                    <p className="payment-muted">UPI details are not configured. Contact the hostel owner, or submit cash payment for manual confirmation.</p>
                  )}

                  <label className="payment-field">
                    <span>Payment method</span>
                    <select value={draft.method} onChange={(event) => updateDraft(invoice._id, { method: event.target.value })}>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="CASH">Cash paid to hostel</option>
                    </select>
                  </label>

                  {draft.method !== "CASH" ? (
                    <>
                      <label className="payment-field">
                        <span>UTR / transaction reference</span>
                        <input
                          required
                          maxLength="100"
                          value={draft.reference}
                          onChange={(event) => updateDraft(invoice._id, { reference: event.target.value })}
                          placeholder="Enter transaction reference"
                        />
                      </label>
                      <label className="payment-field">
                        <span>Payment screenshot (JPEG, PNG or WEBP; max 5 MB)</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          required
                          onChange={(event) => updateDraft(invoice._id, { file: event.target.files?.[0] || null })}
                        />
                      </label>
                    </>
                  ) : (
                    <p className="payment-muted">Cash submissions are also marked pending until the hostel verifies them.</p>
                  )}

                  <button className="facility-submit payment-button" type="submit" disabled={busyId === invoice._id}>
                    <Upload size={16} /> {busyId === invoice._id ? "Submitting..." : "Submit for verification"}
                  </button>
                </form>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}