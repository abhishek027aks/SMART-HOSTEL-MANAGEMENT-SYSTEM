import { useEffect, useState } from "react";
import { Download, FileBarChart, RefreshCw } from "lucide-react";
import { API_BASE_URL, apiRequest } from "../services/api.js";

const REPORTS = [
  ["students", "Students"], ["rooms", "Rooms"], ["beds", "Beds"], ["gate", "Entry / Exit"],
  ["outpasses", "Outpasses"], ["complaints", "Complaints"], ["fees", "Fee payments"]
];

export default function ReportsPage({ token }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");
  const load = async () => { setLoading(true); setError(""); try { const result = await apiRequest("/api/reports/summary", { token }); setSummary(result.data); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [token]);
  const download = async (type) => {
    setDownloading(type); setError("");
    try {
      const selectedHostelId = window.sessionStorage.getItem("shms.selectedHostelId");
      const headers = { Authorization: `Bearer ${token}` };
      if (selectedHostelId) headers["X-Hostel-Id"] = selectedHostelId;
      const response = await fetch(`${API_BASE_URL}/api/reports/${type}.csv`, { headers });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || "Export failed."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `shms-${type}.csv`; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); } finally { setDownloading(""); }
  };
  return <section className="facility-manager" aria-labelledby="reports-heading"><div className="facility-heading-row"><div><span className="dashboard-kicker">REPORTING</span><h2 id="reports-heading">Reports & Exports</h2><p>Download verified-hostel records. CSV exports contain live database data only.</p></div><button className="facility-secondary" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} />Refresh</button></div>{error ? <p className="facility-error" role="alert">{error}</p> : null}{loading ? <p className="facility-state">Loading report totals...</p> : <><div className="reports-summary">{REPORTS.map(([key, label]) => <article key={key}><FileBarChart size={18} /><span>{label}</span><strong>{summary?.[key] ?? 0}</strong></article>)}</div><section className="reports-export-grid">{REPORTS.map(([key, label]) => <article className="facility-panel" key={key}><div><h3>{label}</h3><p>Export all current records in CSV format.</p></div><button className="facility-submit" type="button" disabled={Boolean(downloading)} onClick={() => void download(key)}><Download size={16} />{downloading === key ? "Preparing..." : "Download CSV"}</button></article>)}</section></>}</section>;
}
