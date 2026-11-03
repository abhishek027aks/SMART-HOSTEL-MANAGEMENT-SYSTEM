import { useEffect, useState } from "react";
import { ClipboardList, RefreshCw } from "lucide-react";
import { apiRequest } from "../services/api.js";

const label = (value) => String(value || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AuditLogsPage({ token }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = async () => { setLoading(true); setError(""); try { const result = await apiRequest("/api/audit-logs?limit=100", { token }); setItems(result.data?.items || []); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [token]);
  return <section className="facility-manager" aria-labelledby="audit-heading"><div className="facility-heading-row"><div><span className="dashboard-kicker">ACCOUNTABILITY</span><h2 id="audit-heading">Audit Log</h2><p>Permanent activity history for the selected hostel.</p></div><button className="facility-secondary" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} />Refresh</button></div>{error ? <p className="facility-error" role="alert">{error}</p> : null}{loading ? <p className="facility-state">Loading audit records...</p> : !items.length ? <p className="facility-empty">No recorded actions yet.</p> : <section className="facility-panel audit-log-list">{items.map((entry) => <article key={entry._id}><ClipboardList size={18} aria-hidden="true" /><div><strong>{label(entry.action)}</strong><span>{entry.actorId?.name || "Unknown user"} · {label(entry.actorRole)} · {new Date(entry.createdAt).toLocaleString()}</span><small>{label(entry.entityType)} record: {String(entry.entityId)}</small></div></article>)}</section>}</section>;
}
