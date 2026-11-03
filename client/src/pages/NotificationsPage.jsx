import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { apiRequest } from "../services/api.js";

const label = (value) =>
  String(value || "GENERAL")
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

export default function NotificationsPage({ token, role }) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest("/api/notifications", {
        token,
        signal
      });

      const data = response?.data;
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnreadCount(Math.max(0, Number(data?.unreadCount) || 0));
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(
          requestError.message ||
          "Unable to load notifications. Please try again."
        );
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reload]);

  const markRead = async (item) => {
    if (item.readAt || busyId) return;

    setBusyId(String(item._id));
    setError("");
    setMessage("");

    try {
      await apiRequest(
        `/api/notifications/${encodeURIComponent(item._id)}/read`,
        { token, method: "PATCH" }
      );

      const now = new Date().toISOString();

      setItems((current) => current.map((entry) =>
        entry._id === item._id
          ? { ...entry, readAt: now }
          : entry
      ));
      setUnreadCount((current) => Math.max(0, current - 1));
      setMessage("Notification marked as read.");
    } catch (requestError) {
      setError(requestError.message || "Could not update this notification.");
    } finally {
      setBusyId("");
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;

    setMarkingAll(true);
    setError("");
    setMessage("");

    try {
      await apiRequest("/api/notifications/read-all", {
        token,
        method: "PATCH"
      });

      const now = new Date().toISOString();

      setItems((current) => current.map((entry) => ({
        ...entry,
        readAt: entry.readAt || now
      })));
      setUnreadCount(0);
      setMessage("All notifications have been marked as read.");
    } catch (requestError) {
      setError(requestError.message || "Could not mark all notifications as read.");
    } finally {
      setMarkingAll(false);
    }
  };

  const description = role === "STUDENT"
    ? "Keep track of new hostel notices and important updates."
    : role === "PARENT"
      ? "View updates intended for your linked hostel account."
      : "Review recent notifications for your selected hostel.";

  return (
    <section className="notifications-module" aria-labelledby="notifications-heading">
      <header className="notifications-heading">
        <span className="notifications-heading-icon">
          <Bell size={24} aria-hidden="true" />
        </span>

        <div className="notifications-heading-copy">
          <span className="dashboard-kicker">HOSTEL UPDATES</span>
          <h2 id="notifications-heading">Notifications</h2>
          <p>{description}</p>
        </div>

        <span className="notifications-unread" aria-live="polite">
          {unreadCount} unread
        </span>
      </header>

      <div className="notifications-toolbar">
        <button
          className="facility-secondary"
          type="button"
          onClick={() => setReload((current) => current + 1)}
          disabled={loading || markingAll}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>

        <button
          className="facility-primary"
          type="button"
          onClick={markAllRead}
          disabled={loading || markingAll || unreadCount === 0}
        >
          <CheckCheckIcon />
          {markingAll ? "Updating..." : "Mark all as read"}
        </button>
      </div>

      {error ? (
        <div className="notifications-message error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => setReload((current) => current + 1)}>
            Try again
          </button>
        </div>
      ) : null}

      {message ? (
        <div className="notifications-message success" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{message}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="notifications-state" role="status">
          Loading notifications...
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="notifications-state">
          <Bell size={26} aria-hidden="true" />
          <strong>You are all caught up</strong>
          <span>New hostel notifications will appear here.</span>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="notifications-list">
          {items.map((item) => (
            <article
              className={`notifications-card${item.readAt ? " is-read" : " is-unread"}`}
              key={item._id}
            >
              <div className="notifications-card-top">
                <span className={`notifications-priority ${String(item.priority || "GENERAL").toLowerCase()}`}>
                  {label(item.priority)}
                </span>
                <time dateTime={item.createdAt || undefined}>
                  {formatDate(item.createdAt)}
                </time>
              </div>

              <h3>{item.title}</h3>
              <p className="notifications-card-message">
                {item.message || "No additional details."}
              </p>

              <footer className="notifications-card-footer">
                <span className="notifications-type">{label(item.type)}</span>

                {item.readAt ? (
                  <span className="notifications-read-label">
                    <Check size={15} aria-hidden="true" /> Read
                  </span>
                ) : (
                  <button
                    className="notifications-mark-read"
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => void markRead(item)}
                  >
                    {busyId === String(item._id) ? "Updating..." : "Mark as read"}
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CheckCheckIcon() {
  return <CheckCircle2 size={16} aria-hidden="true" />;
}