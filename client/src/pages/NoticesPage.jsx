import { useCallback, useEffect, useState } from "react";
import { Bell, Plus, RefreshCw, AlertCircle } from "lucide-react";
import { apiRequest } from "../services/api.js";

const EMPTY_FORM = {
  title: "",
  body: "",
  target: "ALL",
  priority: "GENERAL",
  targetBlockId: "",
  targetFloorId: "",
  targetStudentId: ""
};

const label = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());

function formatDate(value) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export default function NoticesPage({ token, role }) {
  const canPublish = ["OWNER", "WARDEN", "SYSTEM_ADMIN"].includes(role);

  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetError, setTargetError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadNotices = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      const path = canPublish ? "/api/notices" : "/api/notices/mine";
      const response = await apiRequest(path, { token, signal });

      setItems(
        Array.isArray(response?.data?.items)
          ? response.data.items
          : []
      );
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message || "Unable to load notices.");
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [canPublish, token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadNotices(controller.signal);
    return () => controller.abort();
  }, [loadNotices, reload]);

  useEffect(() => {
    if (!canPublish) return undefined;

    const controller = new AbortController();
    let active = true;

    const loadTargets = async () => {
      setTargetsLoading(true);
      setTargetError("");

      const results = await Promise.allSettled([
        apiRequest(
          "/api/students?page=1&limit=100&status=ACTIVE",
          { token, signal: controller.signal }
        ),
        apiRequest(
          "/api/facilities/blocks?limit=100",
          { token, signal: controller.signal }
        ),
        apiRequest(
          "/api/facilities/floors?limit=100",
          { token, signal: controller.signal }
        )
      ]);

      if (!active) return;

      if (results[0].status === "fulfilled") {
        setStudents(results[0].value?.data?.items || []);
      }
      if (results[1].status === "fulfilled") {
        setBlocks(results[1].value?.data?.items || []);
      }
      if (results[2].status === "fulfilled") {
        setFloors(results[2].value?.data?.items || []);
      }

      if (results.some((result) => result.status === "rejected")) {
        setTargetError(
          "Some audience lists could not load. Refresh and try again before choosing a specific target."
        );
      }

      setTargetsLoading(false);
    };

    void loadTargets();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canPublish, token]);

  const updateForm = (event) => {
    const { name, value } = event.target;

    if (name === "target") {
      setForm((current) => ({
        ...current,
        target: value,
        targetBlockId: "",
        targetFloorId: "",
        targetStudentId: ""
      }));
    } else {
      setForm((current) => ({
        ...current,
        [name]: value
      }));
    }
  };

  const publish = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      target: form.target,
      priority: form.priority
    };

    if (form.target === "BLOCK") {
      if (!form.targetBlockId) {
        setError("Please select a block.");
        return;
      }
      payload.targetBlockId = form.targetBlockId;
    }

    if (form.target === "FLOOR") {
      if (!form.targetFloorId) {
        setError("Please select a floor.");
        return;
      }
      payload.targetFloorId = form.targetFloorId;
    }

    if (form.target === "STUDENT") {
      if (!form.targetStudentId) {
        setError("Please select a student.");
        return;
      }
      payload.targetStudentId = form.targetStudentId;
    }

    setBusy(true);

    try {
      await apiRequest("/api/notices", {
        token,
        method: "POST",
        body: JSON.stringify(payload)
      });

      setForm({ ...EMPTY_FORM });
      setNotice(
        "Notice published. Notifications are generated for the selected audience."
      );
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to publish notice.");
    } finally {
      setBusy(false);
    }
  };

  const blockNameById = new Map(
    blocks.map((block) => [String(block._id), block.name])
  );

  return (
    <section className="notices-module" aria-labelledby="notices-heading">
      <header className="complaint-heading">
        <span className="complaint-heading-icon">
          <Bell size={24} aria-hidden="true" />
        </span>

        <div>
          <span className="dashboard-kicker">HOSTEL UPDATES</span>
          <h2 id="notices-heading">Notices</h2>
          <p>
            {canPublish
              ? "Publish notices to everyone or to a specific hostel audience."
              : "Notices published for your hostel account."}
          </p>
        </div>

        <button
          className="facility-secondary"
          type="button"
          onClick={() => setReload((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {canPublish ? (
        <form className="complaint-form" onSubmit={publish}>
          <div className="complaint-section-title">
            <div>
              <span>PUBLISH NOTICE</span>
              <h3>Hostel communication</h3>
            </div>
            <Plus size={21} aria-hidden="true" />
          </div>

          <div className="complaint-form-grid">
            <label className="complaint-field complaint-field-wide">
              Title
              <input
                name="title"
                required
                minLength={3}
                maxLength={160}
                value={form.title}
                onChange={updateForm}
              />
            </label>

            <label className="complaint-field">
              Audience
              <select
                name="target"
                value={form.target}
                onChange={updateForm}
              >
                <option value="ALL">Everyone in hostel</option>
                <option value="ALL_STUDENTS">All students</option>
                <option value="ALL_PARENTS">All parents</option>
                <option value="BLOCK">Specific block</option>
                <option value="FLOOR">Specific floor</option>
                <option value="STUDENT">Specific student</option>
              </select>
            </label>

            <label className="complaint-field">
              Priority
              <select
                name="priority"
                value={form.priority}
                onChange={updateForm}
              >
                <option value="GENERAL">General</option>
                <option value="IMPORTANT">Important</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>

            {form.target === "BLOCK" ? (
              <label className="complaint-field complaint-field-wide">
                Select block
                <select
                  name="targetBlockId"
                  required
                  value={form.targetBlockId}
                  onChange={updateForm}
                  disabled={targetsLoading}
                >
                  <option value="">
                    {targetsLoading ? "Loading blocks..." : "Choose a block"}
                  </option>
                  {blocks.map((block) => (
                    <option key={block._id} value={block._id}>
                      {block.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {form.target === "FLOOR" ? (
              <label className="complaint-field complaint-field-wide">
                Select floor
                <select
                  name="targetFloorId"
                  required
                  value={form.targetFloorId}
                  onChange={updateForm}
                  disabled={targetsLoading}
                >
                  <option value="">
                    {targetsLoading ? "Loading floors..." : "Choose a floor"}
                  </option>
                  {floors.map((floor) => {
                    const blockName =
                      blockNameById.get(String(floor.blockId)) || "Block";
                    const floorName =
                      floor.name || `Floor ${floor.number}`;

                    return (
                      <option key={floor._id} value={floor._id}>
                        {blockName} — {floorName}
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : null}

            {form.target === "STUDENT" ? (
              <label className="complaint-field complaint-field-wide">
                Select student
                <select
                  name="targetStudentId"
                  required
                  value={form.targetStudentId}
                  onChange={updateForm}
                  disabled={targetsLoading}
                >
                  <option value="">
                    {targetsLoading
                      ? "Loading students..."
                      : students.length
                        ? "Choose a student"
                        : "No active students found"}
                  </option>
                  {students.map((student) => (
                    <option key={student._id} value={student._id}>
                      {student.name} — {student.studentId}
                    </option>
                  ))}
                </select>
                <span>Student options list up to 100 active records.</span>
              </label>
            ) : null}

            {targetError &&
            ["BLOCK", "FLOOR", "STUDENT"].includes(form.target) ? (
              <p className="facility-error complaint-field-wide" role="alert">
                {targetError}
              </p>
            ) : null}

            <label className="complaint-field complaint-field-wide">
              Message
              <textarea
                name="body"
                required
                minLength={5}
                maxLength={4000}
                rows={4}
                value={form.body}
                onChange={updateForm}
              />
            </label>
          </div>

          <button
            className="facility-submit"
            disabled={busy || targetsLoading}
            type="submit"
          >
            <Plus size={16} aria-hidden="true" />
            {busy ? "Publishing..." : "Publish notice"}
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="facility-error" role="alert">
          <AlertCircle size={16} aria-hidden="true" /> {error}
        </p>
      ) : null}

      {notice ? (
        <p className="facility-notice" role="status">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <div className="complaint-state" role="status">
          Loading notices...
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="complaint-state">
          <Bell size={25} aria-hidden="true" />
          <strong>No notices found</strong>
          <span>New hostel notices will appear here.</span>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="notice-grid">
          {items.map((item) => (
            <article className="notice-card" key={item._id}>
              <span className={`notice-tag ${String(item.priority || "").toLowerCase()}`}>
                {label(item.priority)}
              </span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <footer>
                <span>{label(item.target)}</span>
                <time dateTime={item.createdAt || undefined}>
                  {formatDate(item.createdAt)}
                </time>
              </footer>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}