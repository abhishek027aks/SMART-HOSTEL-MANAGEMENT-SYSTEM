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
const EMPTY = { name: "", blockId: "", number: "", floorId: "", roomNumber: "", roomType: "Standard", airConditioning: "NON_AC", customRoomDescription: "", capacity: "1", roomId: "", bedNumber: "", status: "AVAILABLE" };
const LABELS = { name: "Block name", blockId: "Block", number: "Floor number", floorId: "Floor", roomNumber: "Room number", roomType: "Sharing type", airConditioning: "Air conditioning", customRoomDescription: "Other room description", capacity: "Total beds in room", roomId: "Room", bedNumber: "Bed number", status: "Status" };
const ROOM_TYPES = ["Standard", "Single Sharing", "Double Sharing", "Triple Sharing", "Four Sharing", "Other"];
const DEFAULT_CAPACITY = { Standard: "1", "Single Sharing": "1", "Double Sharing": "2", "Triple Sharing": "3", "Four Sharing": "4" };
const STEP_COPY = {
  blocks: "1. Create hostel blocks",
  floors: "2. Add floors to a block",
  rooms: "3. Add rooms to a floor",
  beds: "4. Create beds inside each room"
};

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
  const [rotatingCode, setRotatingCode] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const canManage = role === "OWNER" || (role === "SYSTEM_ADMIN" && hasTenant);

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
    if (resource === "rooms") return ["blockId", "floorId", "roomNumber", "roomType", "airConditioning", "customRoomDescription", "capacity", "status"];
    return ["roomId", "bedNumber", "status"];
  }, [resource]);
  const fieldLabel = (field) => field === "name" && resource === "floors" ? "Floor label (optional)" : field === "blockId" && resource === "rooms" ? "Block (for selecting a floor)" : LABELS[field];

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
  const labelFor = (record) => resource === "blocks" ? record.name : resource === "floors" ? `Floor ${record.number}${record.name ? ` - ${record.name}` : ""}` : resource === "rooms" ? `Room ${record.roomNumber}` : `Bed ${record.bedNumber}`;
  const statusSummary = useMemo(() => {
    const counts = items.reduce((result, item) => {
      const key = item.status || "UNSPECIFIED";
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).map(([status, count]) => ({ status, count, percent: items.length ? Math.round(count / items.length * 100) : 0 }));
  }, [items]);
  if (showProfile) return <HostelProfile token={token} onBack={() => setShowProfile(false)} onSaved={onHostelChanged} />;

  return (
    <section className="facility-manager" aria-labelledby="facility-heading">
      <div className="facility-heading-row">
        <div><span className="dashboard-kicker">HOSTEL CONFIGURATION</span><h2 id="facility-heading">Facility Management</h2><p>Manage real blocks, floors, rooms, and beds in the selected hostel.</p></div>
        <div className="facility-heading-actions">{role === "OWNER" || (role === "SYSTEM_ADMIN" && hasTenant) ? <button type="button" className="facility-secondary" onClick={() => setShowProfile(true)}><Building2 size={16} aria-hidden="true" /> Hostel profile</button> : null}<button type="button" className="facility-secondary" onClick={() => setRefreshKey((key) => key + 1)}><RefreshCw size={16} aria-hidden="true" /> Refresh</button></div>
      </div>
      <div className="facility-tabs" role="tablist" aria-label="Facility type">
        {RESOURCES.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={resource === id} aria-label={`${STEP_COPY[id]}: ${label}`} className={resource === id ? "active" : ""} onClick={() => { setResource(id); clearForm(); setSelectedRecord(null); setNotice(""); setError(""); }}><Icon size={17} aria-hidden="true" /><span className="facility-step-number">{RESOURCES.findIndex((item) => item.id === id) + 1}</span>{label}</button>)}
      </div>
      <div className="facility-workflow-context" role="status">
        <strong>{STEP_COPY[resource]}</strong>
        <span>Block <b>›</b> Floor <b>›</b> Room <b>›</b> Bed</span>
        {resource === "floors" && parents.blocks.length === 0 ? <em>Create a block first.</em> : null}
        {resource === "rooms" && parents.floors.length === 0 ? <em>Create a floor first.</em> : null}
        {resource === "beds" && parents.rooms.length === 0 ? <em>Create a room first.</em> : null}
      </div>
      {!loading && items.length ? <section className="facility-tab-summary" aria-label={`${resource} status summary`}>
        <div><strong>{items.length}</strong><span>{resource} in the current result</span></div>
        <div className="facility-tab-summary-bars">{statusSummary.map(({ status, count, percent }) => <div key={status}><span>{status.replaceAll("_", " ")} <b>{count}</b></span><i><em style={{ width: `${percent}%` }} /></i></div>)}</div>
      </section> : null}
      <div className="facility-layout">
        <section className="facility-panel" aria-label={`${resource} records`}>
          <div className="facility-list-toolbar"><label htmlFor="facility-search">Search {resource}<input id="facility-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search current hostel records" /></label><span>{items.length} shown</span></div>
          {loading ? <p className="facility-state" role="status">Loading {resource} from the server…</p> : null}
          {!loading && !error && items.length === 0 ? <p className="facility-empty">No records yet</p> : null}
          {!loading && items.length > 0 ? <div className="facility-record-list">{items.map((record) => <article className="facility-record" key={record._id}><div><strong>{labelFor(record)}</strong><span>{resource === "floors" ? `Block ${parents.blocks.find((item) => String(item._id) === String(record.blockId))?.name || "—"}` : resource === "rooms" ? `${record.roomType || "Room"} · ${record.airConditioning === "AC" ? "AC" : "Non-AC"} · ${record.capacity} beds` : resource === "beds" ? `${parents.rooms.find((item) => String(item._id) === String(record.roomId))?.roomNumber || "Room —"} · ${record.status}` : record.status}</span></div><div className="facility-row-actions">
  <button type="button" onClick={() => view(record)}>View</button>
  {canManage ? <>
    <button type="button" onClick={() => startEdit(record)}>Edit</button>
    <button type="button" className="archive" onClick={() => deleteFacility(record)}>Delete</button>
  </> : null}
</div></article>)}</div> : null}
          {selectedRecord ? <aside className="student-details" aria-label="Facility details"><strong>{labelFor(selectedRecord)}</strong>{Object.entries(selectedRecord).filter(([key, value]) => !["_id", "__v", "hostelId", "isDeleted", "createdAt", "updatedAt"].includes(key) && value !== null && typeof value !== "object").map(([key, value]) => <span key={key}>{key}: {String(value)}</span>)}</aside> : null}
        </section>
        {canManage ? (
        <form className="facility-panel facility-form" onSubmit={submit}>
          <div className="facility-form-heading"><div><h3>{editingId ? `Edit ${resource.slice(0, -1)}` : `Add ${resource.slice(0, -1)}`}</h3><p>Changes are saved to the hostel database.</p></div>{editingId ? <button type="button" className="facility-icon-button" aria-label="Cancel edit" onClick={clearForm}><X size={17} /></button> : null}</div>
          {resource === "rooms" ? <p className="facility-help">Choose the sharing type first. The bed count is filled automatically; choose Other for a custom layout and enter its capacity yourself.</p> : null}
          {fields.filter((field) => field !== "customRoomDescription" || form.roomType === "Other").map((field) => <label className="facility-field" key={field}><span>{field === "capacity" && form.roomType === "Other" ? "Custom total beds in room" : fieldLabel(field)}</span>{["blockId", "floorId", "roomId", "status", "roomType", "airConditioning"].includes(field) ? <select required={field !== "status"} value={form[field]} onChange={(event) => setForm((current) => {
            const value = event.target.value;
            if (field === "blockId") return { ...current, blockId: value, floorId: "" };
            if (field === "roomType") return { ...current, roomType: value, capacity: DEFAULT_CAPACITY[value] || current.capacity, customRoomDescription: value === "Other" ? current.customRoomDescription : "" };
            return { ...current, [field]: value };
          })}><option value="">{field === "status" ? "Use default status" : `Select ${fieldLabel(field).toLowerCase()}`}</option>{field === "status" ? ["AVAILABLE", "RESERVED", "MAINTENANCE"].map((status) => <option key={status} value={status}>{status}</option>) : field === "roomType" ? ROOM_TYPES.map((type) => <option key={type} value={type}>{type}</option>) : field === "airConditioning" ? <><option value="NON_AC">Non-AC</option><option value="AC">AC</option></> : relatedOptions(field).map((item) => <option key={item._id} value={item._id}>{field === "blockId" ? item.name : field === "floorId" ? `Floor ${item.number}${item.name ? ` - ${item.name}` : ""}` : `Room ${item.roomNumber}`}</option>)}</select> : field === "customRoomDescription" ? <textarea required value={form[field]} maxLength={300} placeholder="Example: family room with attached washroom" onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} /> : <input required={!["name"].includes(field) || resource === "blocks"} type={field === "capacity" || field === "number" ? "number" : "text"} min={field === "capacity" ? 1 : field === "number" ? -10 : undefined} max={field === "capacity" ? 500 : field === "number" ? 1000 : undefined} placeholder={field === "name" && resource === "floors" ? "Example: Ground floor" : field === "roomNumber" ? "Example: A-101" : field === "bedNumber" ? "Example: A-101-1" : undefined} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} />}</label>)}
          {error ? <p className="facility-error" role="alert">{error}</p> : null}{notice ? <p className="facility-notice" role="status">{notice}</p> : null}
          <button type="submit" className="facility-submit" disabled={saving}><Save size={16} aria-hidden="true" />{saving ? "Saving…" : editingId ? "Save changes" : <><Plus size={16} aria-hidden="true" /> Add facility</>}</button>
        </form>
        ) : (
          <aside className="facility-panel facility-readonly" role="note">
            <strong>Read-only facility view</strong>
            <p>Only the Hostel Owner or System Admin can create, edit, or delete Blocks, Floors, Rooms and Beds. Warden accounts can review the records here.</p>
          </aside>
        )}
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
  const rotateCode = async () => {
    if (!window.confirm("Rotate the hostel access code? Students must use the new code for their next login.")) return;
    setRotatingCode(true); setError(""); setNotice("");
    try {
      const response = await apiRequest("/api/hostels/current/access-code/rotate", { token, method: "POST" });
      setProfile((current) => ({ ...current, accessCode: response.data.accessCode }));
      setNotice("Hostel access code rotated. Share the new code only with authorized residents.");
      onSaved?.();
    } catch (requestError) { setError(requestError.message); }
    finally { setRotatingCode(false); }
  };
  return <section className="facility-manager" aria-labelledby="hostel-profile-heading"><div className="facility-heading-row"><div><span className="dashboard-kicker">HOSTEL SETTINGS</span><h2 id="hostel-profile-heading">Hostel Profile</h2><p>{profile?.name || "Current hostel"} · update contact and location information.</p></div><button className="facility-secondary" type="button" onClick={onBack}>Back to facilities</button></div><form className="facility-panel facility-profile-form" onSubmit={submit}>{loading ? <p className="facility-state" role="status">Loading hostel profile…</p> : null}{!loading ? <><div className="hostel-identity-details"><strong>Hostel Name: {profile?.name}</strong><span>Hostel ID: {profile?._id}</span><span>Hostel Code: {profile?.hostelCode || "Not available"}</span>{profile?.accessCode ? <span>Hostel Access Code: {profile.accessCode}</span> : null}<button className="facility-secondary" type="button" onClick={() => void rotateCode()} disabled={rotatingCode}>{rotatingCode ? "Rotating..." : "Rotate access code"}</button></div><PhotoField token={token} subject="hostel" label="Hostel Photo" value={form.photoUrl} onChange={(photoUrl) => setForm((current) => ({ ...current, photoUrl }))} />{Object.entries({ name: "Hostel name", address: "Address", city: "City", state: "State / Union Territory", pincode: "Pincode", contact: "Contact number", email: "Email address" }).map(([key, label]) => <label className="facility-field" key={key}><span>{label}</span><input required={key === "name"} type={key === "email" ? "email" : "text"} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}{PUBLIC_PRICING_FIELDS.map(({ key, label }) => (
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
    <option value="no">No</option>
  </select>
</label></> : null}{error ? <p className="facility-error" role="alert">{error}</p> : null}{notice ? <p className="facility-notice" role="status">{notice}</p> : null}<button className="facility-submit" type="submit" disabled={loading || saving}><Save size={16} aria-hidden="true" />{saving ? "Saving…" : "Save hostel profile"}</button></form></section>;
}
export default FacilityManager;
