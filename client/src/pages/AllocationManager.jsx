import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, BedDouble, Check, DoorOpen, RefreshCw, Trash2, UserRound } from "lucide-react";
import { apiRequest } from "../services/api.js";

const today = () => new Date().toISOString().slice(0, 10);
function AllocationManager({ token, initialStudentId = "", onComplete }) {
  const [blocks, setBlocks] = useState([]); const [floors, setFloors] = useState([]); const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]); const [beds, setBeds] = useState([]); const [allocations, setAllocations] = useState([]);
  const [hostel, setHostel] = useState(null); const [blockId, setBlockId] = useState(""); const [floorId, setFloorId] = useState(""); const [roomId, setRoomId] = useState("");
  const [studentId, setStudentId] = useState(initialStudentId); const [studentQuery, setStudentQuery] = useState(""); const [bedId, setBedId] = useState(""); const [allocationDate, setAllocationDate] = useState(today());
  const [mode, setMode] = useState("assign"); const [current, setCurrent] = useState(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reload, setReload] = useState(0);
  useEffect(() => { if (initialStudentId) setStudentId(initialStudentId); }, [initialStudentId]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    Promise.all([
      apiRequest("/api/allocations/options", { token, signal: controller.signal }),
      apiRequest("/api/allocations?limit=100", { token, signal: controller.signal }),
      apiRequest("/api/hostels/current", { token, signal: controller.signal }).catch(() => null)
    ]).then(([options, currentAllocations, hostelResult]) => {
      setBlocks(options.data.blocks); setFloors(options.data.floors); setRooms(options.data.rooms); setAllocations(currentAllocations.data.items); setHostel(hostelResult?.data || null);
      if (!blockId && options.data.blocks.length) setBlockId(options.data.blocks[0]._id);
    }).catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, reload]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiRequest(`/api/facilities/rooms?limit=100`, { token, signal: controller.signal }),
      apiRequest(`/api/students?status=ACTIVE&limit=20${studentQuery.trim() ? `&q=${encodeURIComponent(studentQuery.trim())}` : ""}`, { token, signal: controller.signal })
    ]).then(([roomResult, studentResult]) => {
      setRooms(roomResult.data.items);
      setStudents(studentResult.data.items.filter((student) => !student.bedId || String(student._id) === studentId));
    }).catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); });
    return () => controller.abort();
  }, [token, studentQuery, studentId, reload]);
  useEffect(() => {
    if (!roomId) { setBeds([]); setBedId(""); return undefined; }
    const controller = new AbortController();
    apiRequest(`/api/allocations/available-beds?roomId=${encodeURIComponent(roomId)}`, { token, signal: controller.signal })
      .then((response) => { setBeds(response.data); if (!response.data.some((bed) => String(bed._id) === bedId)) setBedId(""); })
      .catch((requestError) => { if (requestError.name !== "AbortError") { setBeds([]); setError(requestError.message); } });
    return () => controller.abort();
  }, [token, roomId, reload]);
  const availableFloors = useMemo(() => floors.filter((floor) => String(floor.blockId) === String(blockId)), [floors, blockId]);
  const availableRooms = useMemo(() => rooms.filter((room) => String(room.floorId) === String(floorId) && String(room.blockId) === String(blockId) && !["MAINTENANCE", "RESERVED"].includes(room.status)), [rooms, floorId, blockId]);
  const selectedRoom = rooms.find((room) => String(room._id) === String(roomId));
  const occupiedCount = allocations.filter((allocation) => String(allocation.roomId) === String(roomId)).length;
  const roomAvailable = selectedRoom ? Math.max(0, selectedRoom.capacity - occupiedCount) : 0;
  const reloadData = () => setReload((value) => value + 1);
  const chooseTransfer = (allocation) => { setCurrent(allocation); setMode("transfer"); setStudentId(String(allocation.studentId?._id || allocation.studentId)); const oldBed = allocation.bedId; const oldRoom = oldBed?.roomId?._id || oldBed?.roomId; const room = rooms.find((item) => String(item._id) === String(oldRoom)); if (room) { setBlockId(String(room.blockId)); setFloorId(String(room.floorId)); setRoomId(""); } setBedId(""); setNotice(""); setError(""); };
  const submit = async (event) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = { studentId, roomId, bedId, allocationDate };
      const response = mode === "transfer"
        ? await apiRequest(`/api/allocations/${current._id}/transfer`, { token, method: "POST", body: JSON.stringify({ roomId, bedId }) })
        : await apiRequest("/api/allocations", { token, method: "POST", body: JSON.stringify(payload) });
      setNotice(`Student successfully ${mode === "transfer" ? "transferred to" : "assigned to"} Room ${response.data.room.roomNumber} / Bed ${response.data.bed.bedNumber}.`);
      setMode("assign"); setCurrent(null); setBedId(""); setStudentId(""); setAllocationDate(today()); reloadData(); onComplete?.();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };
  const deleteAllocation = async (allocation) => {
    const student = allocation.studentId?.name || allocation.studentId?.studentId || "this resident";
    if (!window.confirm(`Delete ${student} from current allocations and release their bed? Allocation history will be retained.`)) return;
    setError(""); setNotice("");
    try { await apiRequest(`/api/allocations/${allocation._id}`, { token, method: "DELETE" }); setNotice(`${student} was removed from current allocations. Allocation history has been retained.`); reloadData(); onComplete?.(); }
    catch (requestError) { setError(requestError.message); }
  };
  return <section className="facility-manager allocation-page" aria-labelledby="allocation-heading">
    <div className="facility-heading-row"><div><span className="dashboard-kicker">HOSTEL STRUCTURE & ALLOCATION</span><h2 id="allocation-heading">Assign Resident</h2><p>Hostel <strong>{hostel?.name || "Current verified hostel"}</strong> <span className="hierarchy-crumb">→ Block → Floor → Room → Bed → Student</span></p></div><button className="facility-secondary" type="button" onClick={reloadData}><RefreshCw size={16} /> Refresh</button></div>
    <div className="allocation-grid">
      <form className="facility-panel allocation-form" onSubmit={submit}>
        <div className="facility-form-heading"><div><h3>{mode === "transfer" ? "Transfer Student" : "Assign Resident"}</h3><p>{mode === "transfer" ? `Current: ${current?.bedId?.roomId?.roomNumber || "Room"} / ${current?.bedId?.bedNumber || "Bed"}` : "Select an active, unallocated student and an available bed."}</p></div></div>
        <label className="facility-field"><span>Student Search</span><input type="search" value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search by name or student ID" /></label>
        <label className="facility-field"><span>Student</span><select required value={studentId} disabled={mode === "transfer"} onChange={(event) => setStudentId(event.target.value)}><option value="">Select active student</option>{students.map((student) => <option key={student._id} value={student._id}>{student.name} · {student.studentId}</option>)}</select></label>
        <div className="allocation-student-summary"><UserRound size={17} /><span>{students.find((student) => String(student._id) === String(studentId)) ? `${students.find((student) => String(student._id) === String(studentId)).name} · ${students.find((student) => String(student._id) === String(studentId)).studentId}` : "No student selected"}</span></div>
        <label className="facility-field"><span>Block</span><select required value={blockId} onChange={(event) => { setBlockId(event.target.value); setFloorId(""); setRoomId(""); }}><option value="">Select block</option>{blocks.map((block) => <option key={block._id} value={block._id}>{block.name}</option>)}</select></label>
        <label className="facility-field"><span>Floor</span><select required value={floorId} onChange={(event) => { setFloorId(event.target.value); setRoomId(""); }}><option value="">Select floor</option>{availableFloors.map((floor) => <option key={floor._id} value={floor._id}>{floor.name || `Floor ${floor.number}`}</option>)}</select></label>
        <label className="facility-field"><span>Room</span><select required value={roomId} onChange={(event) => setRoomId(event.target.value)}><option value="">Select room</option>{availableRooms.map((room) => <option key={room._id} value={room._id}>Room {room.roomNumber} · Capacity {room.capacity}</option>)}</select></label>
        {selectedRoom ? <div className="room-capacity-card"><div className="capacity-icon"><DoorOpen size={18} /></div><div><strong>Room {selectedRoom.roomNumber}</strong><span>Capacity {selectedRoom.capacity} · Occupied {occupiedCount} · Available {roomAvailable}</span></div><span className="capacity-status">{selectedRoom.status}</span><small>Available beds: {beds.length}</small></div> : null}
        <label className="facility-field"><span>Bed</span><select required value={bedId} disabled={!roomId || !beds.length} onChange={(event) => setBedId(event.target.value)}><option value="">{!roomId ? "Select a room first" : beds.length ? "Select available bed" : "No available beds"}</option>{beds.map((bed) => <option key={bed._id} value={bed._id}>Bed {bed.bedNumber} · AVAILABLE</option>)}</select></label>
        {mode === "assign" ? <label className="facility-field"><span>Allocation Date</span><input type="date" max={today()} value={allocationDate} onChange={(event) => setAllocationDate(event.target.value)} /></label> : null}
        {error ? <p className="facility-error" role="alert">{error}</p> : null}{notice ? <p className="facility-notice" role="status">{notice}</p> : null}
        <button className="facility-submit" type="submit" disabled={saving || loading || !studentId || !roomId || !bedId}>{saving ? "Saving…" : mode === "transfer" ? <><ArrowRightLeft size={16} /> Transfer Student</> : <><Check size={16} /> Assign Bed</>}</button>
        {mode === "transfer" ? <button className="facility-secondary" type="button" onClick={() => { setMode("assign"); setCurrent(null); setBedId(""); }}>Cancel transfer</button> : null}
      </form>
      <section className="facility-panel current-allocation-panel"><div className="facility-form-heading"><div><h3>Current Allocations</h3><p>Active bed assignments for this hostel.</p></div><span className="allocation-total">{allocations.length}</span></div>{loading ? <p className="facility-state" role="status">Loading allocations…</p> : null}{!loading && allocations.length === 0 ? <p className="facility-empty">No records yet</p> : null}<div className="active-allocation-list">{allocations.map((allocation) => <article className="active-allocation" key={allocation._id}><div className="allocation-person"><span className="allocation-avatar"><UserRound size={16} /></span><div><strong>{allocation.studentId?.name || "Resident"}</strong><small>{allocation.studentId?.studentId || "Student ID unavailable"} · {allocation.studentId?.mobile || ""}</small></div></div><div className="allocation-location"><BedDouble size={15} /><span>Room {allocation.bedId?.roomId?.roomNumber || "—"} / Bed {allocation.bedId?.bedNumber || "—"}</span><small>Since {new Date(allocation.allocationDate).toLocaleDateString()}</small></div><div className="allocation-actions"><button type="button" onClick={() => chooseTransfer(allocation)}><ArrowRightLeft size={14} /> Transfer</button><button className="archive" type="button" onClick={() => deleteAllocation(allocation)}><Trash2 size={14} /> Delete</button></div></article>)}</div></section>
    </div>
  </section>;
}
export default AllocationManager;
