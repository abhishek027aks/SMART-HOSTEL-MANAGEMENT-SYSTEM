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
  const [roomQuery, setRoomQuery] = useState("");
  const [roomStatusFilter, setRoomStatusFilter] = useState("ALL");

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

    const blockNames = new Map(activeBlocks.map((block) => [
      idOf(block._id),
      block.name || "Block"
    ]));
    const floorNames = new Map(activeFloors.map((floor) => [
      idOf(floor._id),
      floor.name || `Floor ${floor.number}`
    ]));

    const roomDetails = rooms.map((room) => {
      const roomBeds = beds.filter((bed) => idOf(bed.roomId) === idOf(room._id));
      const capacity = numberOf(room.capacity);
      const occupiedBeds = roomBeds.filter((bed) => bed.status === "OCCUPIED").length;
      const reservedBeds = roomBeds.filter((bed) => bed.status === "RESERVED").length;
      const maintenanceBeds = roomBeds.filter((bed) => bed.status === "MAINTENANCE").length;
      const roomCanAcceptAllocation = !["RESERVED", "MAINTENANCE"].includes(room.status);
      const assignableBeds = roomCanAcceptAllocation
        ? roomBeds.filter((bed) => bed.status === "AVAILABLE").length
        : 0;

      return {
        ...room,
        blockName: blockNames.get(idOf(room.blockId)) || "Block",
        floorLabel: floorNames.get(idOf(room.floorId)) || "Floor",
        bedRecords: roomBeds.length,
        occupiedBeds,
        reservedBeds,
        maintenanceBeds,
        assignableBeds,
        missingBedRecords: Math.max(0, capacity - roomBeds.length),
        occupancyPercent: capacity > 0
          ? Math.min(100, Math.round((occupiedBeds / capacity) * 100))
          : 0
      };
    });

    return {
      overall,
      blocks,
      floors: activeFloors.length,
      roomDetails
    };
  }, [records]);

  // SHMS_ROOM_DIRECTORY_V1: searchable, status-filtered room inventory.
// SHMS_BLOCK_FLOOR_CAPACITY_V1: aggregate live room and bed records by hierarchy level.
  const levelDetails = useMemo(() => {
    const sourceRooms = overview?.roomDetails || [];
    const groups = new Map();

    for (const room of sourceRooms) {
      const levels = [
        {
          kind: "BLOCK",
          id: idOf(room.blockId),
          label: room.blockName || "Block"
        },
        {
          kind: "FLOOR",
          id: idOf(room.floorId),
          label: `${room.blockName || "Block"} · ${room.floorLabel || "Floor"}`
        }
      ];

      for (const level of levels) {
        const key = `${level.kind}:${level.id || level.label}`;

        if (!groups.has(key)) {
          groups.set(key, {
            key,
            kind: level.kind,
            label: level.label,
            roomCount: 0,
            capacity: 0,
            createdBeds: 0,
            occupiedBeds: 0,
            assignableBeds: 0,
            reservedBeds: 0,
            maintenanceBeds: 0,
            missingBedRecords: 0
          });
        }

        const summary = groups.get(key);
        summary.roomCount += 1;
        summary.capacity += numberOf(room.capacity);
        summary.createdBeds += numberOf(room.bedRecords);
        summary.occupiedBeds += numberOf(room.occupiedBeds);
        summary.assignableBeds += numberOf(room.assignableBeds);
        summary.reservedBeds += numberOf(room.reservedBeds);
        summary.maintenanceBeds += numberOf(room.maintenanceBeds);
        summary.missingBedRecords += numberOf(room.missingBedRecords);
      }
    }

    return Array.from(groups.values())
      .map((level) => ({
        ...level,
        occupancyPercent: level.capacity > 0
          ? Math.min(100, Math.round((level.occupiedBeds / level.capacity) * 100))
          : 0
      }))
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "BLOCK" ? -1 : 1;
        return a.label.localeCompare(b.label);
      });
  }, [overview]);
  const filteredRoomDetails = useMemo(() => {
    const query = roomQuery.trim().toLowerCase();

    return (overview?.roomDetails || []).filter((room) => {
      const matchesQuery = !query || [
        room.roomNumber,
        room.roomType,
        room.blockName,
        room.floorLabel
      ].some((value) => String(value || "").toLowerCase().includes(query));

      const matchesStatus =
        roomStatusFilter === "ALL" || room.status === roomStatusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [overview, roomQuery, roomStatusFilter]);

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
            <RefreshCw size={16} aria-hidden="true" /> {loading ? "Refreshing..." : "Refresh inventory"}
          </button>
          <button type="button" className="facility-overview-primary" onClick={onManage}>
            <Settings2 size={16} aria-hidden="true" /> Manage facilities
          </button>
        </div>
      </div>

      {error ? <div className="facility-overview-error" role="alert">{error} <button type="button" onClick={() => setRefreshKey((key) => key + 1)}>Retry</button></div> : null}
      {loading && !records ? <p className="facility-overview-empty" role="status">Loading Block, Floor, Room and Bed inventory...</p> : null}

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
              <span>{overview.blocks.length} active blocks / {overview.floors} active floors</span>
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
              <small>The Hostel Owner/System Admin can add the address under Facilities â†’ Hostel profile.</small>
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

        <article className="facility-overview-panel facility-overview-room-directory" aria-labelledby="room-directory-title">
          <div className="facility-overview-panel-title">
            <div>
              <h3 id="room-directory-title">Room-wise capacity details</h3>
              <p>Compare configured capacity with real bed records and current bed status.</p>
            </div>
            <span>{filteredRoomDetails.length} of {overview.roomDetails.length} rooms</span>
          </div>

          <div className="facility-overview-room-filters">
            <label>
              Search room, Block or Floor
              <input
                type="search"
                value={roomQuery}
                onChange={(event) => setRoomQuery(event.target.value)}
                placeholder="e.g. 501, Block A, Floor 2"
                aria-label="Search rooms by room number, type, block or floor"
              />
            </label>

            <label>
              Room status
              <select
                value={roomStatusFilter}
                onChange={(event) => setRoomStatusFilter(event.target.value)}
                aria-label="Filter rooms by status"
              >
                <option value="ALL">All statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="RESERVED">Reserved</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </label>

            <button
              type="button"
              className="facility-secondary"
              onClick={() => {
                setRoomQuery("");
                setRoomStatusFilter("ALL");
              }}
            >
              Clear filters
            </button>
          </div>

          {filteredRoomDetails.length === 0 ? (
            <p className="facility-overview-empty">
              No rooms match these filters. Create rooms under Manage Facilities if the hostel has none yet.
            </p>
          ) : (
            <div className="facility-overview-table-wrap">
              <table className="facility-overview-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Cooling</th>
                    <th>Block / Floor</th>
                    <th>Capacity</th>
                    <th>Beds created</th>
                    <th>Occupied</th>
                    <th>Assignable</th>
                    <th>Reserved</th>
                    <th>Maintenance beds</th>
                    <th>Bed setup pending</th>
                    <th>Room status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoomDetails.map((room) => (
                    <tr key={room._id}>
                      <td>
                        <strong>{room.roomNumber || "Unnamed room"}</strong>
                        <small>{room.roomType || "Standard"}{room.roomType === "Other" && room.customRoomDescription ? ` · ${room.customRoomDescription}` : ""}</small>
                      </td>
                      <td>{room.airConditioning === "AC" ? "AC" : "Non-AC"}</td>
                      <td>
                        {room.blockName}
                        <small>{room.floorLabel}</small>
                      </td>
                      <td>{numberOf(room.capacity)}</td>
                      <td>{room.bedRecords}</td>
                      <td>{room.occupiedBeds}</td>
                      <td>{room.assignableBeds}</td>
                      <td>{room.reservedBeds}</td>
                      <td>{room.maintenanceBeds}</td>
                      <td>
                        <strong className={room.missingBedRecords > 0 ? "facility-overview-pending" : ""}>
                          {room.missingBedRecords}
                        </strong>
                      </td>
                      <td>
                        <span className={`facility-overview-room-status status-${String(room.status || "unknown").toLowerCase()}`}>
                          {room.status || "Unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </> : null}
    </section>
  );
}
