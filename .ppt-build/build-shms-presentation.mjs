import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "F:/Project/SMART HOSTEL MANAGEMENT SYSTEM";
const skillDir = "C:/Users/aks27/.codex/plugins/cache/openai-primary-runtime/presentations/26.1013.11914/skills/presentations";
const outputDir = path.join(workspaceDir, "deliverables");
const draftDir = path.join(workspaceDir, ".ppt-build");
const finalPath = path.join(outputDir, "SHMS_Project_Presentation_Enhanced_20_Slides.pptx");
const draftPath = path.join(draftDir, "SHMS_Project_Presentation_Enhanced_20_Slides_draft.pptx");
const W = 1280;
const H = 720;
const C = {
  navy: "102A4C", blue: "147EEF", sky: "EAF4FF", ink: "17243C", muted: "61738D",
  line: "D8E5F2", white: "FFFFFF", green: "0C9B63", amber: "E79722", red: "D64F4F",
  violet: "6D4AEF", pale: "F6F9FD", teal: "129B9A"
};
const font = "Aptos";

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}
async function imageBytes(filePath) {
  const bytes = await fs.readFile(filePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
function addBox(slide, x, y, w, h, fill = C.white, radius = "rounded-lg", line = C.line) {
  return slide.shapes.add({ geometry: "roundRect", position: { left: x, top: y, width: w, height: h }, fill, line: { style: "solid", fill: line, width: 1 }, borderRadius: radius });
}
function text(slide, value, x, y, w, h, opts = {}) {
  const shape = slide.shapes.add({ geometry: "textbox", position: { left: x, top: y, width: w, height: h }, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  shape.text = value;
  shape.text.style = { fontFamily: font, fontSize: opts.size ?? 20, color: opts.color ?? C.ink, bold: opts.bold ?? false, align: opts.align ?? "left", verticalAlign: opts.valign ?? "top", marginLeft: opts.margin ?? 0, marginRight: opts.margin ?? 0, marginTop: opts.margin ?? 0, marginBottom: opts.margin ?? 0 };
  return shape;
}
function title(slide, num, heading, sub = "") {
  text(slide, `SMART HOSTEL MANAGEMENT SYSTEM  |  ${String(num).padStart(2, "0")}`, 64, 38, 620, 20, { size: 11, color: C.blue, bold: true });
  text(slide, heading, 64, 70, 950, 48, { size: 32, color: C.navy, bold: true });
  if (sub) text(slide, sub, 64, 122, 1030, 40, { size: 16, color: C.muted });
  const rule = slide.shapes.add({ geometry: "rect", position: { left: 64, top: 170, width: 1152, height: 2 }, fill: C.line, line: { style: "solid", fill: C.line, width: 0 } });
  return rule;
}
function footer(slide, page) {
  text(slide, `SHMS Project Presentation`, 64, 684, 300, 16, { size: 10, color: C.muted });
  text(slide, String(page).padStart(2, "0"), 1174, 684, 42, 16, { size: 10, color: C.muted, align: "right" });
}
function pill(slide, label, x, y, w, color = C.sky, textColor = C.blue) {
  const s = addBox(slide, x, y, w, 28, color, "rounded-full", color);
  text(slide, label, x + 10, y + 7, w - 20, 14, { size: 11, color: textColor, bold: true, align: "center" });
  return s;
}
function bulletList(slide, items, x, y, w, size = 18, gap = 42) {
  items.forEach((item, i) => {
    const cy = y + i * gap;
    const dot = slide.shapes.add({ geometry: "ellipse", position: { left: x, top: cy + 7, width: 10, height: 10 }, fill: C.blue, line: { style: "solid", fill: C.blue, width: 0 } });
    text(slide, item, x + 22, cy, w - 22, gap - 2, { size, color: C.ink });
  });
}
function fitImage(slide, filePath, x, y, w, h, alt) {
  return imageBytes(filePath).then((blob) => slide.images.add({ blob, contentType: filePath.endsWith(".jpg") ? "image/jpeg" : "image/png", alt, fit: "contain", position: { left: x, top: y, width: w, height: h }, geometry: "roundRect", borderRadius: "rounded-lg" }));
}
function connect(slide, from, to, opts = {}) {
  return slide.shapes.connect(from, to, { kind: "elbow", fromSide: opts.fromSide ?? "right", toSide: opts.toSide ?? "left", line: { style: "solid", fill: opts.color ?? C.blue, width: 2 }, head: { type: "arrow", width: "sm", length: "sm" } });
}
function entity(slide, name, fields, x, y, w = 190) {
  const h = 44 + fields.length * 24;
  const box = addBox(slide, x, y, w, h, C.white, "rounded-md", C.line);
  const head = slide.shapes.add({ geometry: "rect", position: { left: x, top: y, width: w, height: 38 }, fill: C.navy, line: { style: "solid", fill: C.navy, width: 0 } });
  text(slide, name, x + 12, y + 10, w - 24, 18, { size: 15, color: C.white, bold: true, align: "center" });
  fields.forEach((field, i) => text(slide, field, x + 12, y + 47 + i * 24, w - 24, 18, { size: 12, color: i === 0 ? C.blue : C.ink, bold: i === 0 }));
  return box;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const deck = Presentation.create({ slideSize: { width: W, height: H } });
  const screenshots = [
    path.join(workspaceDir, ".audit/video-frames/frame_001.jpg"),
    path.join(workspaceDir, ".audit/video-frames/frame_002.jpg"),
    path.join(workspaceDir, ".audit/video-frames/frame_007.jpg"),
    path.join(workspaceDir, ".audit/video-frames/frame_013.jpg")
  ];
  const sourceErDeck = await PresentationFile.importPptx(await FileBlob.load("C:/Users/aks27/Downloads/Hostel_ER_Diagram_Editable.pptx"));
  const sourceErPng = await sourceErDeck.export({ slide: sourceErDeck.slides.items[0], format: "png", scale: 1 });
  const sourceErBytes = await sourceErPng.arrayBuffer();

  // 1 Cover
  { const s = deck.slides.add(); s.background.fill = C.navy;
    const band = s.shapes.add({ geometry: "rect", position: { left: 0, top: 0, width: W, height: H }, fill: { color: C.navy }, line: { style: "solid", fill: C.navy, width: 0 } });
    s.shapes.add({ geometry: "ellipse", position: { left: 840, top: 0, width: 440, height: 440 }, fill: "0B4A88", line: { style: "solid", fill: "0B4A88", width: 0 } });
    s.shapes.add({ geometry: "ellipse", position: { left: 950, top: 410, width: 330, height: 310 }, fill: "1468B7", line: { style: "solid", fill: "1468B7", width: 0 } });
    text(s, "COLLEGE PROJECT PRESENTATION", 74, 82, 470, 24, { size: 13, color: "9CCBFF", bold: true });
    text(s, "Smart Hostel\nManagement System", 74, 128, 660, 150, { size: 50, color: C.white, bold: true });
    text(s, "A MERN-based platform for secure hostel operations, residents, facilities, and gate management", 78, 305, 580, 58, { size: 20, color: "D8E8FA" });
    pill(s, "MERN Stack", 78, 410, 112, "1D4E80", C.white); pill(s, "Multi-hostel", 202, 410, 130, "1D4E80", C.white); pill(s, "Role-based", 344, 410, 126, "1D4E80", C.white);
    text(s, "Prepared for project review and poster presentation", 78, 600, 520, 22, { size: 16, color: "BBD8F8" });
    await fitImage(s, screenshots[0], 760, 128, 420, 470, "SHMS dashboard screenshot from project recording");
  }
  // 2 Introduction
  { const s = deck.slides.add(); title(s, 2, "Introduction", "Hostel operations often rely on disconnected registers, calls, and manual follow-up.");
    const problem = addBox(s, 72, 218, 500, 330, "FDF4F1", "rounded-lg", "F1D5CE");
    text(s, "Current operational problems", 104, 252, 380, 28, { size: 22, color: C.red, bold: true });
    bulletList(s, ["Manual student, room, and bed records", "Slow gate verification and movement tracking", "Limited role control across hostel staff", "No single view of occupancy and operations"], 108, 308, 410, 17, 48);
    const solution = addBox(s, 620, 218, 530, 330, C.sky, "rounded-lg", "C8DCF3");
    text(s, "SHMS solution", 654, 252, 360, 28, { size: 22, color: C.blue, bold: true });
    text(s, "SHMS centralizes hostel data under verified hostel context and role-based access.", 654, 305, 416, 74, { size: 22, color: C.ink, bold: true });
    text(s, "The system supports real records, protected tenant data, resident administration, room allocation, photo handling, fee workflows, and QR-based gate activity.", 654, 404, 416, 94, { size: 17, color: C.muted }); footer(s, 2); }
  // 3 Objectives
  { const s = deck.slides.add(); title(s, 3, "Project Objectives", "The project focuses on operational clarity, data isolation, and secure role-based workflows.");
    const objectives = [["01", "Centralize hostel records", "Manage students, staff, parents, rooms, beds, and allocations in one system."], ["02", "Secure every hostel", "Verify the active hostel context on the backend for tenant-scoped data."], ["03", "Improve daily operations", "Support resident handling, facility management, payments, photos, and gate records."], ["04", "Keep history", "Use lifecycle states and allocation history instead of removing important records."]];
    objectives.forEach((o, i) => { const x = 72 + (i % 2) * 562, y = 215 + Math.floor(i / 2) * 190; addBox(s, x, y, 518, 154, C.white, "rounded-lg", C.line); text(s, o[0], x + 26, y + 28, 54, 38, { size: 28, color: C.blue, bold: true }); text(s, o[1], x + 100, y + 28, 360, 28, { size: 21, color: C.navy, bold: true }); text(s, o[2], x + 100, y + 72, 372, 56, { size: 16, color: C.muted }); }); footer(s, 3); }
  // 4 technology
  { const s = deck.slides.add(); title(s, 4, "Technology Stack", "The application uses a modern web stack with a separate client, API server, and MongoDB data layer.");
    const layers = [["React + Vite", "Responsive user interface, component state, forms, dashboard", C.blue], ["Node.js + Express", "REST APIs, validation, authorization, secure file handling", C.green], ["MongoDB + Mongoose", "Tenant-scoped documents, lifecycle fields, and model relations", C.teal], ["JWT + Scrypt", "Signed access tokens and protected password verification", C.violet]];
    layers.forEach((l, i) => { const x = 96 + i * 276; addBox(s, x, 250, 230, 230, C.white, "rounded-lg", C.line); const circ = s.shapes.add({ geometry: "ellipse", position: { left: x + 86, top: 272, width: 58, height: 58 }, fill: l[2], line: { style: "solid", fill: l[2], width: 0 } }); text(s, String(i + 1), x + 86, 286, 58, 25, { size: 18, color: C.white, bold: true, align: "center" }); text(s, l[0], x + 20, 356, 190, 28, { size: 18, color: C.navy, bold: true, align: "center" }); text(s, l[1], x + 22, 399, 186, 56, { size: 14, color: C.muted, align: "center" }); });
    text(s, "Supporting libraries: Multer for uploads, Lucide React icons, HTML5 QR scanner, QRCode generator, and Google OAuth integration.", 110, 550, 1060, 40, { size: 17, color: C.ink, align: "center" }); footer(s, 4); }
  // 5 roles
  { const s = deck.slides.add(); title(s, 5, "Role-Based Access Model", "Six roles define what each person can access within the platform.");
    const roles = [["System Admin", "Platform and hostel oversight", C.violet], ["Owner", "Own hostel administration", C.blue], ["Warden", "Daily resident operations", C.green], ["Guard", "QR verification and gate activity", C.amber], ["Student", "Own profile, QR, and services", C.teal], ["Parent", "Linked child information", C.red]];
    roles.forEach((r, i) => { const x = 74 + (i % 3) * 380, y = 220 + Math.floor(i / 3) * 190; addBox(s, x, y, 344, 144, C.white, "rounded-lg", C.line); const icon = s.shapes.add({ geometry: "ellipse", position: { left: x + 28, top: y + 37, width: 52, height: 52 }, fill: r[2], line: { style: "solid", fill: r[2], width: 0 } }); text(s, String(i + 1), x + 28, y + 51, 52, 20, { size: 15, color: C.white, bold: true, align: "center" }); text(s, r[0], x + 104, y + 35, 210, 26, { size: 19, color: C.navy, bold: true }); text(s, r[1], x + 104, y + 74, 210, 40, { size: 15, color: C.muted }); }); footer(s, 5); }
  // 6 modules
  { const s = deck.slides.add(); title(s, 6, "Implemented Modules", "The current build contains working modules backed by API routes, model logic, and automated tests.");
    const mods = [["Authentication", "Login, registration, session persistence"], ["Hostel & Facilities", "Blocks, floors, rooms, beds, lifecycle state"], ["Students & Parents", "Profiles, accounts, parent linkage"], ["Staff", "Warden and Guard creation with access control"], ["Allocation", "Assign, release, transfer, history"], ["Gate & QR", "One-time QR token and entry or exit records"], ["Payments", "Fee payment workflow and receipts"], ["Uploads", "Photo validation, preview, camera capture states"]];
    mods.forEach((m, i) => { const x = 72 + (i % 4) * 284, y = 210 + Math.floor(i / 4) * 185; addBox(s, x, y, 250, 145, i % 2 ? C.sky : C.white, "rounded-lg", C.line); text(s, String(i + 1).padStart(2, "0"), x + 22, y + 22, 50, 22, { size: 13, color: C.blue, bold: true }); text(s, m[0], x + 22, y + 55, 205, 24, { size: 18, color: C.navy, bold: true }); text(s, m[1], x + 22, y + 91, 205, 36, { size: 14, color: C.muted }); }); footer(s, 6); }
  // 7 ER
  { const s = deck.slides.add(); title(s, 7, "Entity Relationship Diagram", "Core entities use hostelId to keep records within the verified hostel scope.");
    const hostel = entity(s, "HOSTEL", ["PK  _id", "hostelCode", "accessCode"], 550, 205, 190);
    const user = entity(s, "USER", ["PK  _id", "role", "status"], 78, 238, 180);
    const membership = entity(s, "HOSTEL MEMBERSHIP", ["PK  _id", "FK  userId", "FK  hostelId", "role"], 318, 215, 200);
    const student = entity(s, "STUDENT", ["PK  _id", "FK  hostelId", "studentId", "status"], 820, 205, 180);
    const block = entity(s, "BLOCK", ["PK  _id", "FK  hostelId"], 110, 468, 160);
    const floor = entity(s, "FLOOR", ["PK  _id", "FK  blockId"], 342, 468, 160);
    const room = entity(s, "ROOM", ["PK  _id", "FK  floorId", "status"], 574, 456, 165);
    const bed = entity(s, "BED", ["PK  _id", "FK  roomId", "status"], 812, 468, 165);
    const allocation = entity(s, "ALLOCATION", ["FK  studentId", "FK  bedId", "status"], 1030, 350, 170);
    connect(s, user, membership); connect(s, membership, hostel); connect(s, hostel, student); connect(s, hostel, block, { fromSide: "bottom", toSide: "top" }); connect(s, block, floor); connect(s, floor, room); connect(s, room, bed); connect(s, student, allocation, { fromSide: "right", toSide: "top" }); connect(s, bed, allocation, { fromSide: "right", toSide: "bottom" });
    text(s, "Relationships shown are simplified for presentation clarity. Each operational entity also retains tenant and lifecycle information where applicable.", 75, 638, 1110, 24, { size: 13, color: C.muted, align: "center" }); footer(s, 7); }
  // 8 DFD level 0
  { const s = deck.slides.add(); title(s, 8, "Data Flow Diagram: Context Level", "SHMS acts as the central process for hostel users, records, and controlled operations.");
    const owner = addBox(s, 78, 288, 190, 88, C.sky, "rounded-lg", "BDD7F5"); text(s, "Owner / Warden", 96, 312, 154, 22, { size: 18, color: C.navy, bold: true, align: "center" });
    const student = addBox(s, 78, 452, 190, 88, "EAF8F3", "rounded-lg", "BFE8D8"); text(s, "Student / Parent", 96, 476, 154, 22, { size: 18, color: C.green, bold: true, align: "center" });
    const core = addBox(s, 490, 252, 300, 215, C.navy, "rounded-lg", C.navy); text(s, "SMART HOSTEL\nMANAGEMENT SYSTEM", 530, 315, 220, 62, { size: 24, color: C.white, bold: true, align: "center" });
    const guard = addBox(s, 1012, 288, 190, 88, "FFF6E8", "rounded-lg", "F3D5A2"); text(s, "Guard", 1030, 312, 154, 22, { size: 18, color: C.amber, bold: true, align: "center" });
    const db = addBox(s, 986, 452, 215, 88, "F1EEFF", "rounded-lg", "D5CBFF"); text(s, "MongoDB Database", 1004, 476, 178, 22, { size: 18, color: C.violet, bold: true, align: "center" });
    connect(s, owner, core); connect(s, student, core); connect(s, core, guard); connect(s, core, db, { fromSide: "bottom", toSide: "left" });
    text(s, "Profiles, facility records, allocations, staff, payment actions", 85, 397, 236, 36, { size: 13, color: C.muted, align: "center" }); text(s, "QR token requests, profile access, payment status", 85, 560, 236, 36, { size: 13, color: C.muted, align: "center" }); text(s, "QR scan and entry or exit result", 994, 397, 226, 36, { size: 13, color: C.muted, align: "center" }); text(s, "Tenant-scoped documents and history", 989, 560, 226, 36, { size: 13, color: C.muted, align: "center" }); footer(s, 8); }
  // 9 DFD level 1
  { const s = deck.slides.add(); title(s, 9, "Data Flow Diagram: Operational Flow", "A request passes through authentication and tenant checks before the system performs a business operation.");
    const steps = [["1", "Authenticate", "Verify credentials and issue a signed token"], ["2", "Authorize", "Check role and active membership"], ["3", "Scope", "Bind request to the verified hostel"], ["4", "Operate", "Create, read, update, archive, or record activity"], ["5", "Persist", "Write validated data and retain history"]];
    const shapes = steps.map((st, i) => { const x = 70 + i * 230; const b = addBox(s, x, 275, 190, 185, i === 2 ? C.navy : C.white, "rounded-lg", i === 2 ? C.navy : C.line); text(s, st[0], x + 20, 300, 40, 30, { size: 20, color: i === 2 ? "A9D5FF" : C.blue, bold: true }); text(s, st[1], x + 20, 348, 148, 26, { size: 18, color: i === 2 ? C.white : C.navy, bold: true }); text(s, st[2], x + 20, 390, 150, 44, { size: 13, color: i === 2 ? "D7E7F8" : C.muted }); return b; });
    shapes.slice(0, -1).forEach((shape, i) => connect(s, shape, shapes[i + 1]));
    text(s, "This server-side flow prevents a client from selecting another hostel or accessing data outside its membership.", 138, 545, 1000, 30, { size: 18, color: C.ink, align: "center", bold: true }); footer(s, 9); }
  // 10 UI screens
  { const s = deck.slides.add(); title(s, 10, "Application Screens", "Screens captured from the existing project recording show the dashboard, student management, photo flow, and facilities area.");
    await fitImage(s, screenshots[0], 72, 206, 520, 292, "Dashboard screenshot"); await fitImage(s, screenshots[1], 628, 206, 520, 292, "Students module screenshot");
    text(s, "Dashboard overview", 72, 520, 520, 24, { size: 17, color: C.navy, bold: true, align: "center" }); text(s, "Student management and profile workflow", 628, 520, 520, 24, { size: 17, color: C.navy, bold: true, align: "center" });
    text(s, "The current interface uses responsive panels, role-aware navigation, feedback states, and a final animation layer with reduced-motion support.", 105, 590, 1080, 38, { size: 16, color: C.muted, align: "center" }); footer(s, 10); }
  // 11 security
  { const s = deck.slides.add(); title(s, 11, "Security and Data Integrity", "Security controls belong in the backend, not only in the visible navigation.");
    const items = [["Authentication", "Scrypt password hashing and signed JWT verification"], ["Authorization", "Role middleware blocks unsupported operations"], ["Tenant isolation", "hostelId is derived from verified membership context"], ["Data lifecycle", "Archive and restore preserve important records"], ["Upload safety", "Image type and signature validation with size limits"], ["QR security", "Single-use short-lived tokens prevent replay"]];
    items.forEach((it, i) => { const x = 80 + (i % 2) * 565, y = 210 + Math.floor(i / 2) * 130; addBox(s, x, y, 530, 96, C.white, "rounded-lg", C.line); const badge = s.shapes.add({ geometry: "ellipse", position: { left: x + 25, top: y + 25, width: 46, height: 46 }, fill: [C.blue, C.green, C.violet, C.amber, C.teal, C.red][i], line: { style: "solid", fill: [C.blue, C.green, C.violet, C.amber, C.teal, C.red][i], width: 0 } }); text(s, "✓", x + 25, y + 34, 46, 18, { size: 18, color: C.white, bold: true, align: "center" }); text(s, it[0], x + 94, y + 23, 360, 24, { size: 18, color: C.navy, bold: true }); text(s, it[1], x + 94, y + 54, 392, 24, { size: 14, color: C.muted }); }); footer(s, 11); }
  // 12 tests
  { const s = deck.slides.add(); title(s, 12, "Verification Evidence", "The current project has automated coverage for core security, lifecycle, and API behavior.");
    const big = addBox(s, 90, 220, 355, 265, C.navy, "rounded-lg", C.navy); text(s, "94", 90, 255, 355, 88, { size: 76, color: C.white, bold: true, align: "center" }); text(s, "backend tests passed", 90, 354, 355, 30, { size: 22, color: "CBE1FA", align: "center" }); text(s, "Frontend production build also passed", 110, 417, 315, 25, { size: 14, color: "A8C9E9", align: "center" });
    const evidences = ["Authentication and password security", "Tenant and cross-hostel rejection", "Student, parent, and staff lifecycle", "Facility dependency checks", "Allocation, release, and transfer", "QR single-use and gate scan rules"];
    bulletList(s, evidences, 555, 235, 560, 18, 45);
    text(s, "Evidence reflects the most recent local test run performed during the project audit.", 553, 525, 540, 24, { size: 13, color: C.muted }); footer(s, 12); }
  // 13 status roadmap
  { const s = deck.slides.add(); title(s, 13, "Current Progress and Remaining Scope", "The project has a working foundation, with the next modules focused on resident services and reporting.");
    const completed = addBox(s, 80, 226, 470, 300, "EAF8F3", "rounded-lg", "BFE8D8"); text(s, "Implemented foundation", 112, 258, 310, 28, { size: 23, color: C.green, bold: true }); bulletList(s, ["Authentication and tenant context", "Hostel, facility, student, staff, parent modules", "Allocation and room-bed history", "Photo, payment, QR, and gate workflows"], 116, 316, 365, 16, 42);
    const remaining = addBox(s, 715, 226, 470, 300, "FFF6E8", "rounded-lg", "F3D5A2"); text(s, "Remaining planned modules", 747, 258, 340, 28, { size: 23, color: C.amber, bold: true }); bulletList(s, ["Outpass approval workflow", "Complaints, help, notices, notifications", "Mess, camera, security events", "Reports, exports, audit log UI, settings"], 751, 316, 365, 16, 42);
    const line = s.shapes.add({ geometry: "rect", position: { left: 580, top: 260, width: 70, height: 8 }, fill: C.blue, line: { style: "solid", fill: C.blue, width: 0 } }); text(s, "Current audited estimate: around 40% complete", 465, 570, 350, 24, { size: 16, color: C.navy, bold: true, align: "center" }); footer(s, 13); }
  // 14 future
  { const s = deck.slides.add(); title(s, 14, "Future Enhancements", "The next work expands the current foundation without changing the established security model.");
    const roadmap = [["Phase 1", "Resident services", "Outpass, complaints, help contacts, notices, notifications"], ["Phase 2", "Operations insights", "Mess management, camera events, reports, export"], ["Phase 3", "Final readiness", "Role dashboards, mobile verification, production deployment"]];
    const shapes = roadmap.map((r, i) => { const x = 120 + i * 355; addBox(s, x, 265, 280, 230, C.white, "rounded-lg", C.line); pill(s, r[0], x + 24, 292, 94, i === 0 ? C.sky : i === 1 ? "EAF8F3" : "F1EEFF", i === 0 ? C.blue : i === 1 ? C.green : C.violet); text(s, r[1], x + 24, 349, 228, 28, { size: 20, color: C.navy, bold: true }); text(s, r[2], x + 24, 399, 225, 64, { size: 15, color: C.muted }); return x; });
    text(s, "The roadmap keeps tenant boundaries, role checks, lifecycle history, and real database values as non-negotiable rules.", 130, 565, 1010, 36, { size: 17, color: C.ink, align: "center" }); footer(s, 14); }
  // 15 conclusion
  { const s = deck.slides.add(); s.background.fill = C.navy;
    text(s, "SMART HOSTEL MANAGEMENT SYSTEM", 84, 88, 800, 26, { size: 13, color: "9CCBFF", bold: true });
    text(s, "Conclusion", 84, 148, 530, 54, { size: 40, color: C.white, bold: true });
    text(s, "SHMS provides a real, secure foundation for managing hostel operations across people, facilities, and daily activity.", 84, 230, 650, 66, { size: 24, color: "D8E8FA" });
    text(s, "The next development stages will complete resident services, reporting, and all remaining role-specific workflows.", 84, 330, 640, 56, { size: 18, color: "BBD8F8" });
    const band = addBox(s, 84, 472, 490, 78, "164577", "rounded-lg", "164577"); text(s, "Thank you", 110, 495, 438, 26, { size: 24, color: C.white, bold: true, align: "center" });
    await fitImage(s, screenshots[3], 790, 120, 365, 405, "SHMS staff management screenshot from project recording");
  }
  // 16 Detailed scope from project plan
  { const s = deck.slides.add(); title(s, 16, "Complete Functional Scope", "The supplied project plan defines the final SHMS scope. The completed features and planned features remain clearly separated.");
    const groups = [["Resident services", "Student profile, parent link, QR, entry or exit, outpass, complaints, help"], ["Hostel operations", "Blocks, floors, rooms, beds, allocation, release, transfer, staff"], ["Management", "Fees, mess menu, notices, notifications, reports, audit logs"], ["Security", "Access-code control, gate verification, camera monitoring, security events"]];
    groups.forEach((g, i) => { const x = 75 + (i % 2) * 565, y = 210 + Math.floor(i / 2) * 170; addBox(s, x, y, 530, 135, i % 2 ? C.sky : C.white, "rounded-lg", C.line); text(s, g[0], x + 28, y + 28, 250, 24, { size: 19, color: C.navy, bold: true }); text(s, g[1], x + 28, y + 68, 458, 42, { size: 15, color: C.muted }); });
    text(s, "This scope comes from the provided SHMS feature and access plan. Current build status is shown separately in the progress slides.", 126, 575, 1028, 34, { size: 15, color: C.ink, align: "center" }); footer(s, 16); }
  // 17 Student to gate workflow
  { const s = deck.slides.add(); title(s, 17, "Student QR and Gate Workflow", "The final planned flow uses a short-lived, single-use QR token for secure movement records.");
    const steps = [["Student", "Generates a QR token"], ["System", "Adds token, expiry, and usage status"], ["Guard", "Scans and verifies the QR"], ["System", "Checks student, hostel, gate, expiry, and replay"], ["Gate log", "Creates Entry or Exit record and marks QR used"]];
    const workflow = steps.map((st, i) => { const x = 55 + i * 237; const color = [C.teal, C.blue, C.amber, C.violet, C.green][i]; const b = addBox(s, x, 270, 190, 190, C.white, "rounded-lg", C.line); const circle = s.shapes.add({ geometry: "ellipse", position: { left: x + 70, top: 292, width: 48, height: 48 }, fill: color, line: { style: "solid", fill: color, width: 0 } }); text(s, String(i + 1), x + 70, 306, 48, 19, { size: 15, color: C.white, bold: true, align: "center" }); text(s, st[0], x + 18, 360, 154, 22, { size: 18, color: C.navy, bold: true, align: "center" }); text(s, st[1], x + 18, 400, 154, 38, { size: 14, color: C.muted, align: "center" }); return b; });
    workflow.slice(0, -1).forEach((b, i) => connect(s, b, workflow[i + 1]));
    text(s, "Security rules: valid token, not expired, not already used, active student, matching hostel, and allowed gate.", 160, 555, 960, 30, { size: 18, color: C.ink, align: "center", bold: true }); footer(s, 17); }
  // 18 Access matrix
  { const s = deck.slides.add(); title(s, 18, "Access Summary", "Every role receives only the access needed for its hostel responsibilities.");
    const rows = [["Hostel data", "All", "Own", "Assigned", "Assigned", "Own", "Linked child"], ["Students", "All", "Manage", "Manage", "Verify", "Own", "Child"], ["Rooms and beds", "All", "Manage", "Manage", "View", "Own", "Child"], ["QR and gate", "All", "View", "View", "Scan", "Generate", "View status"], ["Fees", "All", "Manage", "Authorized", "No access", "Own", "Child"], ["Settings", "Platform", "Own hostel", "No access", "No access", "No access", "No access"]];
    const headers = ["Feature", "System Admin", "Owner", "Warden", "Guard", "Student", "Parent"]; const widths = [230, 145, 135, 135, 125, 125, 155]; let x = 55;
    headers.forEach((head, i) => { addBox(s, x, 205, widths[i], 46, C.navy, "rounded-sm", C.navy); text(s, head, x + 7, 219, widths[i] - 14, 16, { size: 12, color: C.white, bold: true, align: "center" }); x += widths[i]; });
    rows.forEach((row, r) => { let colX = 55; row.forEach((value, c) => { addBox(s, colX, 251 + r * 52, widths[c], 52, r % 2 ? C.pale : C.white, "rounded-sm", C.line); text(s, value, colX + 7, 267 + r * 52, widths[c] - 14, 18, { size: c === 0 ? 13 : 12, color: c === 0 ? C.navy : C.ink, bold: c === 0, align: "center" }); colX += widths[c]; }); }); footer(s, 18); }
  // 19 ER source and design alignment
  { const s = deck.slides.add(); title(s, 19, "Expanded Data Model", "The editable ER diagram source informed the detailed entity coverage in this presentation.");
    s.images.add({ blob: sourceErBytes, contentType: "image/png", alt: "Editable hostel ER diagram supplied as a PowerPoint source", fit: "contain", position: { left: 70, top: 205, width: 610, height: 360 }, geometry: "roundRect", borderRadius: "rounded-lg" });
    addBox(s, 740, 205, 420, 360, C.white, "rounded-lg", C.line);
    text(s, "Key entities covered", 775, 238, 320, 26, { size: 21, color: C.navy, bold: true });
    bulletList(s, ["Users and role memberships", "Students and linked parents", "Staff and security records", "Blocks, floors, rooms, and beds", "Allocations and historical releases", "Outpass and entry or exit records"], 780, 292, 330, 15, 38);
    text(s, "The production model also uses hostelId to maintain tenant isolation across major operational records.", 770, 590, 420, 36, { size: 15, color: C.muted, align: "center" }); footer(s, 19); }
  // 20 poster summary
  { const s = deck.slides.add(); s.background.fill = C.navy;
    text(s, "PROJECT POSTER SUMMARY", 78, 62, 400, 20, { size: 12, color: "9CCBFF", bold: true }); text(s, "Smart Hostel Management System", 78, 104, 820, 50, { size: 38, color: C.white, bold: true });
    const poster = [["Problem", "Hostel records and daily operations need a secure digital workflow."], ["Solution", "A MERN platform with role-aware dashboards, tenant rules, and operational modules."], ["Current work", "Authentication, facilities, students, staff, parents, allocation, QR gate flow, uploads, and payments."], ["Next work", "Outpass, complaints, notices, mess, camera events, reports, audit logs, and final deployment."]];
    poster.forEach((p, i) => { const x = 78 + (i % 2) * 555, y = 220 + Math.floor(i / 2) * 170; addBox(s, x, y, 510, 132, "173A64", "rounded-lg", "315A88"); text(s, p[0], x + 28, y + 26, 190, 22, { size: 18, color: "9CCBFF", bold: true }); text(s, p[1], x + 28, y + 62, 440, 45, { size: 16, color: C.white }); });
    text(s, "Secure hostel operations with real database records and server-side access control", 160, 606, 960, 30, { size: 19, color: "D9E9FA", align: "center", bold: true });
  }

  await (await PresentationFile.exportPptx(deck)).save(draftPath);
  const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools", "artifact_tool_utils.mjs")).href);
  const result = await finalizePresentation({
    explicitTotalSlideCount: 20,
    workspaceDir,
    candidatePath: draftPath,
    finalPath,
    pythonExecutable: "C:/Users/aks27/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
    integrityValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_package_integrity.py"),
    layoutValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_layout_geometry.py"),
    layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"],
    fontPolicy: { basis: "design", families: [font] },
    verifyArtifactToolImport: true,
    receiptPath: path.join(draftDir, "SHMS_Project_Presentation_Enhanced_20_Slides.validation.json")
  });
  await fs.writeFile(path.join(draftDir, "finalization.json"), JSON.stringify(result, null, 2));
  for (const [index, slide] of deck.slides.items.entries()) await writeBlob(path.join(draftDir, `slide-${String(index + 1).padStart(2, "0")}.png`), await deck.export({ slide, format: "png", scale: 1 }));
  await writeBlob(path.join(draftDir, "montage.webp"), await deck.export({ format: "webp", montage: true }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
