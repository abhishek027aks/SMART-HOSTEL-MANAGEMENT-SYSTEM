import { useEffect, useMemo, useState } from "react";
import { Archive, Building2, DoorOpen, Layers3, Plus, RefreshCw, Save, X } from "lucide-react";
import { apiRequest } from "../services/api.js";
import PhotoField from "../components/PhotoField.jsx";

const RESOURCES = [
  { id: "blocks", label: "Blocks", icon: Building2 },
  { id: "floors", label: "Floors", icon: Layers3 },
  { id: "rooms", label: "Rooms", icon: DoorOpen },
  { id: "beds", label: "Beds", icon: Archive }
];
const EMPTY = { name: "", blockId: "", number: "", floorId: "", roomNumber: "", roomType: "Standard", capacity: "1", roomId: "", bedNumber: "", status: "AVAILABLE" };
const LABELS = { name: "Block name", blockId: "Block", number: "Floor number", floorId: "Floor", roomNumber: "Room number", roomType: "Room type", capacity: "Bed capacity", roomId: "Room", bedNumber: "Bed number", status: "Status" };

const PUBLIC_PRICING_FIELDS = [
  { key: "singleSharing", label: "Single sharing rent / month" },
  { key: "doubleSharing", label: "Double sharing rent / month" },
  { key: "tripleSharing", label: "Triple sharing rent / month" },
  { key: "fourSharing", label: "Four sharing rent / month" },
  { key: "securityDeposit", label: "Security deposit" },
  { key: "messCharges", label: "Mess charges / month" }
];

function FacilityManager({ token, role, hasTenant, onHostelChanged }) {
  const [resource, setResource] = useState("blocks");
  const [items, setItems] = useState([]);
  const [parents, setParents] = useState({ blocks: [], floors: [], rooms: [] });
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all(["blocks", "floors", "rooms"].map(async (key) => {
      const result = await apiRequest(`/api/facilities/${key}?limit=100`, { token, signal: controller.signal });
      return [key, result.data.items];
    })).then((records) => setParents(Object.fromEntries(records)))
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); });
    return () => controller.abort();
  }, [token, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    apiRequest(`/api/facilities/${resource}?limit=100${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}`, { token, signal: controller.signal })
      .then((result) => setItems(result.data.items))
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [resource, query, token, refreshKey]);

  const fields = useMemo(() => {
    if (resource === "blocks") return ["name"];
    if (resource === "floors") return ["blockId", "number", "name"];
    if (resource === "rooms") return ["blockId", "floorId", "roomNumber", "roomType", "capacity", "status"];
    return ["roomId", "bedNumber", "status"];
  }, [resource]);

  const clearForm = () => { setForm(EMPTY); setEditingId(""); };
  const startEdit = (record) => {
    setEditingId(record._id);
    setForm({ ...EMPTY, ...record, blockId: record.blockId || "", floorId: record.floorId || "", roomId: record.roomId || "" });
    setError("");
    setNotice("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {};
    for (const field of fields) {
      if (form[field] === "" || form[field] === undefined) continue;
      payload[field] = ["number", "capacity"].includes(field) ? Number(form[field]) : form[field];
    }
    try {
      await apiRequest(`/api/facilities/${resource}${editingId ? `/${editingId}` : ""}`, {
        token,
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      setNotice(editingId ? "Facility updated." : "Facility created.");
      clearForm();
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteFacility = async (record) => {
    if (!window.confirm(`Delete ${record.name || record.roomNumber || record.bedNumber || "this facility"} from active hostel records? This is a soft delete; historical data is retained and dependent or occupied records are protected.`)) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/facilities/${resource}/${record._id}`, { token, method: "DELETE" });
      setNotice("Facility deleted from active records. Historical data is retained.");
      setSelectedRecord(null);
      if (editingId === record._id) clearForm();
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const view = async (record) => {
    setError("");
    try {
      const result = await apiRequest(`/api/facilities/${resource}/${record._id}`, { token });
      setSelectedRecord(result.data);
    } catch (requestError) { setError(requestError.message); }
  };

  const relatedOptions = (field) => field === "blockId" ? parents.blocks : field === "floorId" ? parents.floors.filter((item) => !form.blockId || String(item.blockId) === String(form.blockId)) : parents.rooms;
  const labelFor = (record) => resource === "blocks" ? record.name : resource === "floors" ? (record.name || `Floor ${record.number}`) : resource === "rooms" ? record.roomNumber : record.bedNumber;
  if (showProfile) return <HostelProfile token={token} onBack={() => setShowProfile(false)} onSaved={onHostelChanged} />;

  return (
    <section className="facility-manager" aria-labelledby="facility-heading">
      <div className="facility-heading-row">
        <div><span className="dashboard-kicker">HOSTEL CONFIGURATION</span><h2 id="facility-heading">Facility Management</h2><p>Manage real blocks, floors, rooms, and beds in the selected hostel.</p></div>
        <div className="facility-heading-actions">{role === "OWNER" || (role === "SYSTEM_ADMIN" && hasTenant) ? <button type="button" className="facility-secondary" onClick={() => setShowProfile(true)}><Building2 size={16} aria-hidden="true" /> Hostel profile</button> : null}<button type="button" className="facility-secondary" onClick={() => setRefreshKey((key) => key + 1)}><RefreshCw size={16} aria-hidden="true" /> Refresh</button></div>
      </div>
      <div className="facility-tabs" role="tablist" aria-label="Facility type">
        {RESOURCES.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={resource === id} className={resource === id ? "active" : ""} onClick={() => { setResource(id); clearForm(); setSelectedRecord(null); setNotice(""); setError(""); }}><Icon size={17} aria-hidden="true" />{label}</button>)}
      </div>
      <div className="facility-layout">
        <section className="facility-panel" aria-label={`${resource} records`}>
          <div className="facility-list-toolbar"><label htmlFor="facility-search">Search {resource}<input id="facility-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search current hostel records" /></label><span>{items.length} shown</span></div>
          {loading ? <p className="facility-state" role="status">Loading {resource} from the server…</p> : null}
          {!loading && !error && items.length === 0 ? <p className="facility-empty">No records yet</p> : null}
          {!loading && items.length > 0 ? <div className="facility-record-list">{items.map((record) => <article className="facility-record" key={record._id}><div><strong>{labelFor(record)}</strong><span>{resource === "floors" ? `Block ${parents.blocks.find((item) => String(item._id) === String(record.blockId))?.name || "—"}` : resource === "rooms" ? `${record.roomType || "Room"} · Capacity ${record.capacity}` : resource === "beds" ? `${parents.rooms.find((item) => String(item._id) === String(record.roomId))?.roomNumber || "Room —"} · ${record.status}` : record.status}</span></div><div className="facility-row-actions"><button type="button" onClick={() => view(record)}>View</button><button type="button" onClick={() => startEdit(record)}>Edit</button><button type="button" className="archive" onClick={() => deleteFacility(record)}>Delete</button></div></article>)}</div> : null}
          {selectedRecord ? <aside className="student-details" aria-label="Facility details"><strong>{labelFor(selectedRecord)}</strong>{Object.entries(selectedRecord).filter(([key, value]) => !["_id", "__v", "hostelId", "isDeleted", "createdAt", "updatedAt"].includes(key) && value !== null && typeof value !== "object").map(([key, value]) => <span key={key}>{key}: {String(value)}</span>)}</aside> : null}
        </section>
        <form className="facility-panel facility-form" onSubmit={submit}>
          <div className="facility-form-heading"><div><h3>{editingId ? `Edit ${resource.slice(0, -1)}` : `Add ${resource.slice(0, -1)}`}</h3><p>Changes are saved to the hostel database.</p></div>{editingId ? <button type="button" className="facility-icon-button" aria-label="Cancel edit" onClick={clearForm}><X size={17} /></button> : null}</div>
          {fields.map((field) => <label className="facility-field" key={field}><span>{LABELS[field]}</span>{["blockId", "floorId", "roomId", "status"].includes(field) ? <select required={field !== "status"} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value, ...(field === "blockId" ? { floorId: "" } : {}) }))}><option value="">{field === "status" ? "Use default status" : `Select ${LABELS[field].toLowerCase()}`}</option>{field === "status" ? ["AVAILABLE", "RESERVED", "MAINTENANCE"].map((status) => <option key={status} value={status}>{status}</option>) : relatedOptions(field).map((item) => <option key={item._id} value={item._id}>{field === "blockId" ? item.name : field === "floorId" ? (item.name || `Floor ${item.number}`) : item.roomNumber}</option>)}</select> : <input required={!["name"].includes(field) || resource === "blocks"} type={field === "capacity" || field === "number" ? "number" : "text"} min={field === "capacity" ? 1 : field === "number" ? -10 : undefined} max={field === "capacity" ? 500 : field === "number" ? 1000 : undefined} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} />}</label>)}
          {error ? <p className="facility-error" role="alert">{error}</p> : null}{notice ? <p className="facility-notice" role="status">{notice}</p> : null}
          <button type="submit" className="facility-submit" disabled={saving}><Save size={16} aria-hidden="true" />{saving ? "Saving…" : editingId ? "Save changes" : <><Plus size={16} aria-hidden="true" /> Add facility</>}</button>
        </form>
      </div>
    </section>
  );
}


function HostelProfile({ token, onBack, onSaved }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: "", address: "", city: "", state: "", pincode: "", contact: "", email: "", photoUrl: "", paymentSettings: { upiId: "", payeeName: "" }, pricing: { singleSharing: "", doubleSharing: "", tripleSharing: "", fourSharing: "", securityDeposit: "", messCharges: "", messIncluded: "unknown" } });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    apiRequest("/api/hostels/current", { token, signal: controller.signal }).then((response) => {
      setProfile(response.data);
      setForm({
        name: response.data.name || "",
        address: response.data.address || "",
        city: response.data.city || "",
        state: response.data.state || "",
        pincode: response.data.pincode || "",
        contact: response.data.contact || "",
        email: response.data.email || "",
        photoUrl: response.data.photoUrl || "",
        pricing: {
          singleSharing: response.data.pricing?.singleSharing ?? "",
          doubleSharing: response.data.pricing?.doubleSharing ?? "",
          tripleSharing: response.data.pricing?.tripleSharing ?? "",
          fourSharing: response.data.pricing?.fourSharing ?? "",
          securityDeposit: response.data.pricing?.securityDeposit ?? "",
          messCharges: response.data.pricing?.messCharges ?? "",
          messIncluded: response.data.pricing?.messIncluded === true
            ? "yes"
            : response.data.pricing?.messIncluded === false
              ? "no"
              : "unknown"
        }
      });
    }).catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const amountFields = [
        "singleSharing", "doubleSharing", "tripleSharing", "fourSharing",
        "securityDeposit", "messCharges"
      ];
      const payload = {
        ...form,
        pricing: {
          ...Object.fromEntries(amountFields.map((key) => [
            key,
            form.pricing[key] === "" || form.pricing[key] == null
              ? null
              : Number(form.pricing[key])
          ])),
          messIncluded: form.pricing.messIncluded === "yes"
            ? true
            : form.pricing.messIncluded === "no"
              ? false
              : null
        }
      };

      const response = await apiRequest("/api/hostels/current", {
        token,
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setProfile(response.data); setNotice("Hostel profile updated."); onSaved?.();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };
  return <section className="facility-manager" aria-labelledby="hostel-profile-heading"><div className="facility-heading-row"><div><span className="dashboard-kicker">HOSTEL SETTINGS</span><h2 id="hostel-profile-heading">Hostel Profile</h2><p>{profile?.name || "Current hostel"} · update contact and location information.</p></div><button className="facility-secondary" type="button" onClick={onBack}>Back to facilities</button></div><form className="facility-panel facility-profile-form" onSubmit={submit}>{loading ? <p className="facility-state" role="status">Loading hostel profile…</p> : null}{!loading ? <><div className="hostel-identity-details"><strong>Hostel Name: {profile?.name}</strong><span>Hostel ID: {profile?._id}</span><span>Hostel Code: {profile?.hostelCode || "Not available"}</span>{profile?.accessCode ? <span>Hostel Access Code: {profile.accessCode}</span> : null}</div><PhotoField token={token} subject="hostel" label="Hostel Photo" value={form.photoUrl} onChange={(photoUrl) => setForm((current) => ({ ...current, photoUrl }))} />{Object.entries({ name: "Hostel name", address: "Address", city: "City", state: "State / Union Territory", pincode: "Pincode", contact: "Contact number", email: "Email address" }).map(([key, label]) => <label className="facility-field" key={key}><span>{label}</span><input required={key === "name"} type={key === "email" ? "email" : "text"} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}{PUBLIC_PRICING_FIELDS.map(({ key, label }) => (
  <label className="facility-field" key={key}>
    <span>{label} (INR)</span>
    <input
      type="number"
      min={key === "securityDeposit" || key === "messCharges" ? 0 : 1}
      max="10000000"
      step="1"
      value={form.pricing[key]}
      onChange={(event) => setForm((current) => ({
        ...current,
        pricing: { ...current.pricing, [key]: event.target.value }
      }))}
    />
  </label>
))}
<label className="facility-field">
  <span>Mess included in rent?</span>
  <select
    value={form.pricing.messIncluded}
    onChange={(event) => setForm((current) => ({
      ...current,
      pricing: { ...current.pricing, messIncluded: event.target.value }
    }))}
  >
    <option value="unknown">Not specified</option>
    <option value="yes">Yes</option>
+
  </select>
</label></> : null}{error ? <p className="facility-error" role="alert">{error}</p> : null}{notice ? <p className="facility-notice" role="status">{notice}</p> : null}<button className="facility-submit" type="submit" disabled={loading || saving}><Save size={16} aria-hidden="true" />{saving ? "Saving…" : "Save hostel profile"}</button></form></section>;
}
export default FacilityManager;
