$ErrorActionPreference = "Stop"

$root = "F:\Project\SMART HOSTEL MANAGEMENT SYSTEM"
$appPath = Join-Path $root "client\src\App.jsx"
$cssPath = Join-Path $root "client\src\styles\global.css"
$componentDir = Join-Path $root "client\src\components"
$componentPath = Join-Path $componentDir "FacilityOverview.jsx"

foreach ($requiredPath in @($appPath, $cssPath, $componentDir)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required project path not found: $requiredPath. No changes made."
    }
}

if (Test-Path -LiteralPath $componentPath) {
    throw "FacilityOverview.jsx already exists. This patch is designed for the audited source version; no changes made."
}

$appOriginal = [System.IO.File]::ReadAllText($appPath)
$cssOriginal = [System.IO.File]::ReadAllText($cssPath)

if ($appOriginal.Contains('import FacilityOverview from "./components/FacilityOverview.jsx";') -or $cssOriginal.Contains(".facility-overview")) {
    throw "A Facility Overview patch appears to be present already. No changes made."
}

$importAnchor = 'import FacilityManager from "./pages/FacilityManager.jsx";'
$dashboardAnchor = '        <section className="dashboard-grid">'

if ([regex]::Matches($appOriginal, [regex]::Escape($importAnchor)).Count -ne 1) {
    throw "Could not uniquely locate the FacilityManager import in App.jsx. No changes made."
}
if ([regex]::Matches($appOriginal, [regex]::Escape($dashboardAnchor)).Count -ne 1) {
    throw "Could not uniquely locate the dashboard insertion point in App.jsx. No changes made."
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $root "backups\facility_overview_$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item -LiteralPath $appPath -Destination (Join-Path $backupDir "App.jsx")
Copy-Item -LiteralPath $cssPath -Destination (Join-Path $backupDir "global.css")

$componentSource = @'
import { useEffect, useMemo, useState } from "react";
import { Bed, Building2, DoorOpen, Layers3, MapPin, RefreshCw, Settings2, Wrench } from "lucide-react";
import { apiRequest } from "../services/api.js";

const PAGE_SIZE = 100;
const MAX_PAGES = 500;
const idOf = (value) => String(value?._id ?? value ?? "");
const numberOf = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

async function fetchAll(resource, token, signal) {
  const collected = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await apiRequest(
      `/api/facilities/${resource}?page=${page}&limit=${PAGE_SIZE}`,
      { token, signal }
    );
    const data = response?.data;
    if (!Array.isArray(data?.items) || !data?.pagination) {
      throw new Error(`The ${resource} response was incomplete.`);
    }
    collected.push(...data.items);
    totalPages = Math.max(1, Number(data.pagination.pages) || 1);
    if (totalPages > MAX_PAGES) {
      throw new Error(`Too many ${resource} pages to load safely in one dashboard request.`);
    }
    page += 1;
  } while (page <= totalPages);

  return collected;
}

function summarizeRooms(rooms, allBeds) {
  const roomIds = new Set(rooms.map((room) => idOf(room._id)));
  const beds = allBeds.filter((bed) => roomIds.has(idOf(bed.roomId)));
  const roomById = new Map(rooms.map((room) => [idOf(room._id), room]));
  const bedsByRoom = new Map();

  for (const bed of beds) {
    const roomId = idOf(bed.roomId);
    const current = bedsByRoom.get(roomId) || [];
    current.push(bed);
    bedsByRoom.set(roomId, current);
  }

  const capacity = rooms.reduce((total, room) => total + numberOf(room.capacity), 0);
  const occupied = beds.filter((bed) => bed.status === "OCCUPIED").length;
  const reserved = beds.filter((bed) => bed.status === "RESERVED").length;
  const maintenance = beds.filter((bed) => bed.status === "MAINTENANCE").length;
  const rawAvailable = beds.filter((bed) => bed.status === "AVAILABLE").length;
  const assignable = beds.filter((bed) => {
    const room = roomById.get(idOf(bed.roomId));
    return bed.status === "AVAILABLE" && room && !["RESERVED", "MAINTENANCE"].includes(room.status);
  }).length;
  const blockedByRoom = rawAvailable - assignable;
  const missingBedRecords = rooms.reduce((total, room) => {
    const created = (bedsByRoom.get(idOf(room._id)) || []).length;
    return total + Math.max(0, numberOf(room.capacity) - created);
  }, 0);
  const fullRooms = rooms.filter((room) => {
    const roomCapacity = numberOf(room.capacity);
    const roomOccupied = (bedsByRoom.get(idOf(room._id)) || []).filter((bed) => bed.status === "OCCUPIED").length;
    return roomCapacity > 0 && roomOccupied >= roomCapacity;
  }).length;
  const roomMaintenance = rooms.filter((room) => room.status === "MAINTENANCE").length;
  const roomReserved = rooms.filter((room) => room.status === "RESERVED").length;

  return {
    rooms: rooms.length,
    capacity,
    bedRecords: beds.length,
    occupied,
    reserved,
    maintenance,
    rawAvailable,
    assignable,
    blockedByRoom,
    missingBedRecords,
    fullRooms,
    roomMaintenance,
    roomReserved,
    occupancyPercent: capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0
  };
}

function Count({ label, value, hint, tone = "blue", icon: Icon }) {
  return (
    <article className={`facility-overview-stat ${tone}`}>
      <div className="facility-overview-stat-icon"><Icon size={19} aria-hidden="true" /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function StatusLine({ label, value, tone }) {
  return <span className="facility-overview-status-line"><i className={tone} aria-hidden="true" />{label}<strong>{value}</strong></span>;
}

export default function FacilityOverview({ token, hostelInfo, onManage }) {
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      fetchAll("blocks", token, controller.signal),
      fetchAll("floors", token, controller.signal),
      fetchAll("rooms", token, controller.signal),
      fetchAll("beds", token, controller.signal)
    ]).then(([blocks, floors, rooms, beds]) => {
      if (active) setRecords({ blocks, floors, rooms, beds });
    }).catch((requestError) => {
      if (active && requestError.name !== "AbortError") setError(requestError.message || "Unable to load facility details.");
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [token, refreshKey]);

  const overview = useMemo(() => {
    if (!records) return null;

    const activeBlocks = records.blocks.filter((block) => block.status === "ACTIVE");
    const activeBlockIds = new Set(activeBlocks.map((block) => idOf(block._id)));
    const activeFloors = records.floors.filter((floor) =>
      floor.status === "ACTIVE" && activeBlockIds.has(idOf(floor.blockId))
    );
    const activeFloorIds = new Set(activeFloors.map((floor) => idOf(floor._id)));
    const rooms = records.rooms.filter((room) =>
      activeBlockIds.has(idOf(room.blockId)) && activeFloorIds.has(idOf(room.floorId))
    );
    const beds = records.beds;
    const overall = summarizeRooms(rooms, beds);

    const blocks = activeBlocks.map((block) => {
      const blockFloors = activeFloors.filter((floor) => idOf(floor.blockId) === idOf(block._id));
      const blockRooms = rooms.filter((room) => idOf(room.blockId) === idOf(block._id));
      return {
        ...block,
        summary: summarizeRooms(blockRooms, beds),
        floors: blockFloors.map((floor) => ({
          ...floor,
          summary: summarizeRooms(blockRooms.filter((room) => idOf(room.floorId) === idOf(floor._id)), beds)
        }))
      };
    });

    return { overall, blocks, floors: activeFloors.length };
  }, [records]);

  const locationText = [hostelInfo?.address, hostelInfo?.city, hostelInfo?.state, hostelInfo?.pincode]
    .map((part) => typeof part === "string" ? part.trim() : "")
    .filter(Boolean)
    .join(", ");
  const mapUrl = locationText
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText)}`
    : "";

  return (
    <section className="facility-overview" aria-labelledby="facility-overview-title">
      <div className="facility-overview-header">
        <div>
          <span className="dashboard-kicker">HOSTEL INVENTORY</span>
          <h2 id="facility-overview-title">Capacity &amp; Availability</h2>
          <p>Track configured capacity, beds actually created, occupied beds and spaces available for allocation.</p>
        </div>
        <div className="facility-overview-actions">
          <button type="button" className="facility-secondary" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" /> {loading ? "Refreshing…" : "Refresh inventory"}
          </button>
          <button type="button" className="facility-overview-primary" onClick={onManage}>
            <Settings2 size={16} aria-hidden="true" /> Manage facilities
          </button>
        </div>
      </div>

      {error ? <div className="facility-overview-error" role="alert">{error} <button type="button" onClick={() => setRefreshKey((key) => key + 1)}>Retry</button></div> : null}
      {loading && !records ? <p className="facility-overview-empty" role="status">Loading Block, Floor, Room and Bed inventory…</p> : null}

      {!loading && !error && overview ? <>
        <div className="facility-overview-stats" aria-label="Facility totals">
          <Count label="Configured capacity" value={overview.overall.capacity} hint="Slots defined by room capacity" tone="blue" icon={Building2} />
          <Count label="Beds created" value={overview.overall.bedRecords} hint={`${overview.overall.missingBedRecords} capacity slots without a bed record`} tone="violet" icon={Bed} />
          <Count label="Occupied" value={overview.overall.occupied} hint={`${overview.overall.fullRooms} fully occupied rooms`} tone="orange" icon={DoorOpen} />
          <Count label="Assignable now" value={overview.overall.assignable} hint={`${overview.overall.blockedByRoom} available bed(s) blocked by room status`} tone="green" icon={Settings2} />
        </div>

        <div className="facility-overview-layout">
          <article className="facility-overview-panel">
            <div className="facility-overview-panel-title">
              <div><h3>Block &amp; Floor occupancy</h3><p>Percent of configured room capacity currently occupied.</p></div>
              <span>{overview.blocks.length} active blocks · {overview.floors} active floors</span>
            </div>

            {overview.blocks.length === 0 ? <p className="facility-overview-empty">No active blocks yet. Use Manage facilities to create a block first.</p> : null}
            <div className="facility-overview-block-list">
              {overview.blocks.map((block) => (
                <div className="facility-overview-block" key={block._id}>
                  <div className="facility-overview-block-heading">
                    <div><Building2 size={17} aria-hidden="true" /><strong>{block.name}</strong></div>
                    <span>{block.summary.occupied}/{block.summary.capacity} occupied</span>
                  </div>
                  <div className="facility-overview-track" role="progressbar" aria-label={`${block.name} occupancy`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={block.summary.occupancyPercent}>
                    <i style={{ width: `${block.summary.occupancyPercent}%` }} />
                  </div>
                  <div className="facility-overview-block-stats">
                    <span>Rooms <strong>{block.summary.rooms}</strong></span>
                    <span>Free now <strong>{block.summary.assignable}</strong></span>
                    <span>Reserved <strong>{block.summary.reserved}</strong></span>
                    <span>Maintenance beds <strong>{block.summary.maintenance}</strong></span>
                    <span>Set up needed <strong>{block.summary.missingBedRecords}</strong></span>
                  </div>
                  {block.floors.length ? <div className="facility-overview-floor-list">
                    {block.floors.map((floor) => (
                      <div className="facility-overview-floor" key={floor._id}>
                        <div className="facility-overview-floor-heading">
                          <span><Layers3 size={14} aria-hidden="true" /> {floor.name || `Floor ${floor.number}`}</span>
                          <strong>{floor.summary.occupied}/{floor.summary.capacity}</strong>
                        </div>
                        <div className="facility-overview-track thin" role="progressbar" aria-label={`Floor ${floor.number} occupancy`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={floor.summary.occupancyPercent}>
                          <i style={{ width: `${floor.summary.occupancyPercent}%` }} />
                        </div>
                        <div className="facility-overview-floor-meta">
                          <span>{floor.summary.assignable} free</span>
                          <span>{floor.summary.fullRooms} full rooms</span>
                          <span>{floor.summary.missingBedRecords} bed records pending</span>
                        </div>
                      </div>
                    ))}
                  </div> : <p className="facility-overview-muted">No active floors in this block.</p>}
                </div>
              ))}
            </div>

            {overview.overall.capacity > 0 ? <div className="facility-overview-status-summary">
              <StatusLine label="Occupied beds" value={overview.overall.occupied} tone="occupied" />
              <StatusLine label="Assignable beds" value={overview.overall.assignable} tone="available" />
              <StatusLine label="Reserved beds" value={overview.overall.reserved} tone="reserved" />
              <StatusLine label="Maintenance beds" value={overview.overall.maintenance} tone="maintenance" />
            </div> : <p className="facility-overview-empty">No room capacity configured yet.</p>}
          </article>

          <article className="facility-overview-panel facility-overview-location">
            <div className="facility-overview-location-icon"><MapPin size={21} aria-hidden="true" /></div>
            <span className="dashboard-kicker">HOSTEL LOCATION</span>
            <h3>{hostelInfo?.name || "Selected hostel"}</h3>
            {locationText ? <>
              <p>{locationText}</p>
              <a className="facility-overview-map-link" href={mapUrl} target="_blank" rel="noreferrer">Open location in Google Maps</a>
            </> : <>
              <p>Address details have not been added to the hostel profile yet.</p>
              <small>The Hostel Owner/System Admin can add the address under Facilities → Hostel profile.</small>
            </>}
            <div className="facility-overview-location-facts">
              <span><Building2 size={15} aria-hidden="true" /> {overview.blocks.length} active blocks</span>
              <span><Layers3 size={15} aria-hidden="true" /> {overview.floors} active floors</span>
              <span><DoorOpen size={15} aria-hidden="true" /> {overview.overall.rooms} active-hierarchy rooms</span>
              <span><Wrench size={15} aria-hidden="true" /> {overview.overall.roomMaintenance} maintenance rooms</span>
            </div>
            <button type="button" className="facility-overview-primary full-width" onClick={onManage}>Open Facilities Management</button>
          </article>
        </div>
      </> : null}
    </section>
  );
}
'@

$cssAppend = @'

/* Hostel capacity, occupancy and location overview */
.facility-overview { display: grid; gap: 16px; margin: 18px 0 24px; }
.facility-overview-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; }
.facility-overview-header h2 { margin: 4px 0 6px; color: #102a47; font-size: clamp(1.25rem, 1.7vw, 1.75rem); }
.facility-overview-header p { margin: 0; max-width: 700px; color: #607b95; font-size: .92rem; line-height: 1.55; }
.facility-overview-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.facility-overview-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; border: 0; border-radius: 9px; padding: 0 14px; background: linear-gradient(135deg, #0d7df2, #0759bd); color: #fff; font-weight: 800; cursor: pointer; }
.facility-overview-primary:hover { filter: brightness(.96); }
.facility-overview-primary.full-width { width: 100%; margin-top: auto; }
.facility-overview-primary:focus-visible, .facility-overview-actions button:focus-visible, .facility-overview-error button:focus-visible, .facility-overview-map-link:focus-visible { outline: 3px solid #86bbff; outline-offset: 2px; }
.facility-overview-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.facility-overview-stat { display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: center; column-gap: 11px; row-gap: 3px; min-width: 0; padding: 15px; border: 1px solid #d4e3f2; border-radius: 13px; background: #fff; box-shadow: 0 9px 24px rgba(28, 75, 122, .055); }
.facility-overview-stat-icon { grid-row: span 3; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 11px; background: #e7f2ff; color: #0759bd; }
.facility-overview-stat.violet .facility-overview-stat-icon { background: #f0eafe; color: #6842b8; }
.facility-overview-stat.orange .facility-overview-stat-icon { background: #fff0db; color: #a15b06; }
.facility-overview-stat.green .facility-overview-stat-icon { background: #e2f7eb; color: #137744; }
.facility-overview-stat > span { color: #668099; font-size: .79rem; font-weight: 750; }
.facility-overview-stat > strong { color: #173653; font-size: 1.55rem; line-height: 1.2; font-variant-numeric: tabular-nums; }
.facility-overview-stat > small { color: #7c91a5; font-size: .72rem; line-height: 1.45; }
.facility-overview-layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(260px, .75fr); align-items: start; gap: 14px; }
.facility-overview-panel { min-width: 0; padding: 18px; border: 1px solid #d4e3f2; border-radius: 14px; background: #fff; box-shadow: 0 11px 26px rgba(28, 75, 122, .06); }
.facility-overview-panel-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 13px; }
.facility-overview-panel-title h3, .facility-overview-location h3 { margin: 0 0 5px; color: #173653; font-size: 1.05rem; }
.facility-overview-panel-title p { margin: 0; color: #6e859a; font-size: .8rem; line-height: 1.45; }
.facility-overview-panel-title > span { color: #6e859a; font-size: .75rem; white-space: nowrap; }
.facility-overview-block-list { display: grid; gap: 12px; }
.facility-overview-block { border: 1px solid #e1ebf5; border-radius: 11px; padding: 13px; background: #fbfdff; }
.facility-overview-block-heading, .facility-overview-floor-heading { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.facility-overview-block-heading > div, .facility-overview-floor-heading > span { display: flex; align-items: center; gap: 7px; min-width: 0; color: #315777; }
.facility-overview-block-heading strong { color: #153957; overflow-wrap: anywhere; }
.facility-overview-block-heading > span, .facility-overview-floor-heading > strong { color: #54718a; font-size: .78rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.facility-overview-track { width: 100%; height: 9px; margin-top: 10px; overflow: hidden; border-radius: 999px; background: #e5eef8; }
.facility-overview-track i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #1687f8, #0759bd); transition: width .2s ease; }
.facility-overview-track.thin { height: 6px; margin-top: 7px; }
.facility-overview-block-stats { display: flex; flex-wrap: wrap; gap: 7px 15px; margin-top: 10px; color: #6b8399; font-size: .73rem; }
.facility-overview-block-stats span { display: inline-flex; gap: 4px; }
.facility-overview-block-stats strong { color: #244866; font-variant-numeric: tabular-nums; }
.facility-overview-floor-list { display: grid; gap: 9px; margin-top: 12px; padding-top: 11px; border-top: 1px solid #e6eef7; }
.facility-overview-floor { padding: 7px 0 2px; }
.facility-overview-floor-heading { font-size: .78rem; }
.facility-overview-floor-meta { display: flex; flex-wrap: wrap; gap: 5px 12px; margin-top: 5px; color: #8093a5; font-size: .7rem; }
.facility-overview-muted { margin: 12px 0 0; color: #8597a8; font-size: .78rem; }
.facility-overview-status-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 14px; padding-top: 13px; border-top: 1px solid #e6eef7; }
.facility-overview-status-line { display: flex; align-items: center; gap: 7px; color: #607b95; font-size: .78rem; }
.facility-overview-status-line strong { margin-left: auto; color: #183957; font-variant-numeric: tabular-nums; }
.facility-overview-status-line i { display: inline-block; flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%; background: #0759bd; }
.facility-overview-status-line i.available { background: #1c9857; }
.facility-overview-status-line i.reserved { background: #bf8417; }
.facility-overview-status-line i.maintenance { background: #b94d4d; }
.facility-overview-location { display: flex; flex-direction: column; min-height: 270px; }
.facility-overview-location-icon { display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 13px; border-radius: 12px; background: #e7f2ff; color: #0759bd; }
.facility-overview-location .dashboard-kicker { margin-bottom: 5px; }
.facility-overview-location p { margin: 6px 0 12px; color: #607b95; font-size: .87rem; line-height: 1.6; overflow-wrap: anywhere; }
.facility-overview-location small { margin-bottom: 15px; color: #7d91a4; line-height: 1.55; }
.facility-overview-map-link { display: inline-flex; align-self: flex-start; margin: 0 0 16px; color: #0759bd; font-size: .84rem; font-weight: 800; text-decoration: none; }
.facility-overview-map-link:hover { text-decoration: underline; }
.facility-overview-location-facts { display: grid; gap: 9px; margin: 8px 0 17px; padding: 12px 0; border-top: 1px solid #e6eef7; border-bottom: 1px solid #e6eef7; }
.facility-overview-location-facts span { display: flex; align-items: center; gap: 8px; color: #54718a; font-size: .8rem; }
.facility-overview-empty { margin: 0; padding: 15px; border: 1px dashed #cadbea; border-radius: 10px; color: #607b95; text-align: center; font-size: .85rem; line-height: 1.5; }
.facility-overview-error { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px; border: 1px solid #f1caca; border-radius: 9px; background: #fff4f4; color: #a62b2b; font-size: .84rem; }
.facility-overview-error button { border: 1px solid #e2abab; border-radius: 7px; padding: 6px 10px; background: #fff; color: #9b2929; font-weight: 800; }
.facility-overview-select { margin: 18px 0 24px; padding: 16px; border: 1px solid #d4e3f2; border-radius: 12px; background: #fff; color: #607b95; }
.facility-overview-select strong { display: block; margin-bottom: 4px; color: #173653; }
@media (max-width: 1100px) { .facility-overview-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .facility-overview-layout { grid-template-columns: 1fr; } .facility-overview-location { min-height: 0; } }
@media (max-width: 680px) { .facility-overview-header { flex-direction: column; } .facility-overview-actions { width: 100%; } .facility-overview-actions button { flex: 1; } .facility-overview-stats { grid-template-columns: 1fr 1fr; } .facility-overview-stat { padding: 11px; grid-template-columns: 32px minmax(0, 1fr); column-gap: 8px; } .facility-overview-stat-icon { width: 32px; height: 32px; } .facility-overview-stat > strong { font-size: 1.25rem; } .facility-overview-panel { padding: 13px; } .facility-overview-panel-title { flex-direction: column; } .facility-overview-panel-title > span { white-space: normal; } .facility-overview-status-summary { grid-template-columns: 1fr; } .facility-overview-block-stats { gap: 7px 11px; } }
'@

$insertBeforeDashboard = @'
        {user.role === "SYSTEM_ADMIN" && (!activeHostelId || activeHostelId === ALL_HOSTELS_VALUE) ? (
          <section className="facility-overview-select" aria-label="Select a hostel for facility overview">
            <strong>View a hostel's occupancy and location</strong>
            Select one hostel from the Active Hostel switcher above to load its Block, Floor, Room and Bed breakdown.
          </section>
        ) : activeHostelId ? (
          <FacilityOverview token={token} hostelInfo={hostelInfo} onManage={() => setSection("facilities")} />
        ) : null}

        <section className="dashboard-grid">
'@

$componentCreated = $false
$appChanged = $false
$cssChanged = $false

try {
    [System.IO.File]::WriteAllText($componentPath, $componentSource, [System.Text.UTF8Encoding]::new($false))
    $componentCreated = $true

    $appPatched = $appOriginal.Replace(
        $importAnchor,
        $importAnchor + "`r`nimport FacilityOverview from `"./components/FacilityOverview.jsx`";"
    )
    $appPatched = $appPatched.Replace($dashboardAnchor, $insertBeforeDashboard.TrimEnd())
    [System.IO.File]::WriteAllText($appPath, $appPatched, [System.Text.UTF8Encoding]::new($false))
    $appChanged = $true

    [System.IO.File]::WriteAllText($cssPath, $cssOriginal + $cssAppend, [System.Text.UTF8Encoding]::new($false))
    $cssChanged = $true

    Write-Host "Source patch applied. Running frontend production build..." -ForegroundColor Cyan
    Push-Location (Join-Path $root "client")
    $savedErrorActionPreference = $ErrorActionPreference
    try {
        # npm can write routine status text to stderr; use its exit code as the build result.
        $ErrorActionPreference = "Continue"
        npm run build
        $buildExit = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $savedErrorActionPreference
        Pop-Location
    }

    if ($buildExit -ne 0) {
        throw "Frontend build failed with exit code $buildExit. Source files will be restored from the in-memory originals."
    }

    Write-Host "`nFACILITY OVERVIEW PATCH PASSED" -ForegroundColor Green
    Write-Host "Backup: $backupDir" -ForegroundColor Cyan
    Write-Host "Added: client\src\components\FacilityOverview.jsx" -ForegroundColor Cyan
    Write-Host "Updated: client\src\App.jsx and client\src\styles\global.css" -ForegroundColor Cyan
    Write-Host "No backend files or database records were changed." -ForegroundColor Green
}
catch {
    if ($appChanged) {
        [System.IO.File]::WriteAllText($appPath, $appOriginal, [System.Text.UTF8Encoding]::new($false))
    }
    if ($cssChanged) {
        [System.IO.File]::WriteAllText($cssPath, $cssOriginal, [System.Text.UTF8Encoding]::new($false))
    }
    if ($componentCreated -and (Test-Path -LiteralPath $componentPath)) {
        Remove-Item -LiteralPath $componentPath -Force
    }
    Write-Host "Patch did not complete. Source changes were rolled back." -ForegroundColor Red
    Write-Host "A safety backup remains at: $backupDir" -ForegroundColor Yellow
    throw
}
