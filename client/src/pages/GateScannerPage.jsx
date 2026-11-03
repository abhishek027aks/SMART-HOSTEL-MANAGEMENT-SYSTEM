import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CheckCircle2, LogOut, RefreshCw, ScanLine, ShieldCheck, XCircle } from "lucide-react";
import { apiRequest } from "../services/api.js";

export default function GateScannerPage({ token, logout, embedded = false }) {
  const [cameraRetry, setCameraRetry] = useState(0);
  const [cameraState, setCameraState] = useState("starting");
  const [cameraError, setCameraError] = useState("");
  const [scanType, setScanType] = useState("ENTRY");
  const [scanPhase, setScanPhase] = useState("ready");
  const [feedback, setFeedback] = useState(null);

  const scannerRef = useRef(null);
  const scanLockRef = useRef(false);
  const scanTypeRef = useRef(scanType);
  const abortControllerRef = useRef(null);

  scanTypeRef.current = scanType;

  useEffect(() => {
    let cancelled = false;
    let scanner = null;
    let resumeTimer = null;

    const startScanner = async () => {
      setCameraState("starting");
      setCameraError("");
      setScanPhase("ready");
      scanLockRef.current = false;

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!cameras.length) throw new Error("No camera was found. Connect a camera and retry.");

        const selectedCamera =
          cameras.find((camera) => /back|rear|environment/i.test(camera.label || "")) ||
          cameras[0];

        scanner = new Html5Qrcode("gate-qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          selectedCamera.id,
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
          async (decodedText) => {
            if (cancelled || scanLockRef.current) return;

            scanLockRef.current = true;
            setScanPhase("processing");
            setFeedback(null);

            try {
              try { scanner.pause(true); } catch { /* Server validates single-use tokens. */ }

              const controller = new AbortController();
              abortControllerRef.current = controller;

              const response = await apiRequest("/api/gate/scan", {
                method: "POST",
                token,
                signal: controller.signal,
                body: JSON.stringify({
                  token: decodedText.trim(),
                  type: scanTypeRef.current
                })
              });

              if (cancelled) return;
              const data = response?.data;

              if (!data?.entryExit?.id || !data?.student?.studentId) {
                throw new Error("Incomplete server response. Verify gate records before retrying.");
              }

              setFeedback({
                kind: "success",
                title: `${data.entryExit.type} recorded successfully`,
                detail: `${data.student.name} (${data.student.studentId}) · ${data.entryExit.gate}`
              });
            } catch (error) {
              if (!cancelled && error.name !== "AbortError") {
                setFeedback({
                  kind: "error",
                  title: "QR scan was not accepted",
                  detail: error.message || "The QR could not be verified."
                });
              }
            } finally {
              abortControllerRef.current = null;

              if (!cancelled) {
                resumeTimer = window.setTimeout(() => {
                  scanLockRef.current = false;
                  try { scanner?.resume(); } catch { /* User can retry camera if needed. */ }
                  setScanPhase("ready");
                }, 1800);
              } else {
                scanLockRef.current = false;
              }
            }
          },
          () => { /* Repeated per-frame decode failures are normal. */ }
        );

        if (cancelled) {
          try { if (scanner.isScanning) await scanner.stop(); } catch {}
          try { scanner.clear(); } catch {}
          return;
        }

        setCameraState("ready");
      } catch (error) {
        if (!cancelled) {
          setCameraState("error");
          setCameraError(error?.message || "Allow camera access and use localhost or HTTPS.");
        }

        if (scannerRef.current === scanner) scannerRef.current = null;
        if (scanner) {
          try { if (scanner.isScanning) await scanner.stop(); } catch {}
          try { scanner.clear(); } catch {}
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      if (resumeTimer) window.clearTimeout(resumeTimer);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;

      const instance = scannerRef.current;
      scannerRef.current = null;

      if (instance) {
        const stopped = instance.isScanning ? instance.stop() : Promise.resolve();
        stopped.catch(() => {}).finally(() => {
          try { instance.clear(); } catch {}
        });
      }
    };
  }, [token, cameraRetry]);

  const content = (
    <>
      <div className="gate-scanner-heading">
        <span className="gate-scanner-icon"><ScanLine size={23} aria-hidden="true" /></span>
        <div>
          <h2>{embedded ? "Gate Scanner" : "Hostel Gate Scanner"}</h2>
          <p>Scan a student's current one-time QR to record a gate event.</p>
        </div>
      </div>

      <div className="gate-scan-actions" role="group" aria-label="Gate event type">
        <button type="button" className={scanType === "ENTRY" ? "active" : ""}
          aria-pressed={scanType === "ENTRY"} disabled={scanPhase === "processing"}
          onClick={() => setScanType("ENTRY")}>Record Entry</button>
        <button type="button" className={scanType === "EXIT" ? "active" : ""}
          aria-pressed={scanType === "EXIT"} disabled={scanPhase === "processing"}
          onClick={() => setScanType("EXIT")}>Record Exit</button>
      </div>

      <div className="gate-scanner-status" role="status" aria-live="polite">
        <span className={`gate-camera-indicator ${cameraState}`} />
        {cameraState === "starting" ? "Starting camera..."
          : cameraState === "error" ? "Camera unavailable"
          : scanPhase === "processing" ? "Verifying QR with server..."
          : `Camera ready · ${scanType === "ENTRY" ? "Entry mode" : "Exit mode"}`}
      </div>

      {cameraState === "error" ? (
        <div className="gate-camera-error" role="alert">
          <Camera size={20} aria-hidden="true" />
          <p>{cameraError}</p>
          <button type="button" onClick={() => setCameraRetry((value) => value + 1)}>
            <RefreshCw size={16} aria-hidden="true" /> Retry camera
          </button>
        </div>
      ) : (
        <div id="gate-qr-reader" className="gate-qr-reader"
          aria-label="Camera view for scanning student QR codes" />
      )}

      {feedback ? (
        <div className={`gate-scan-feedback ${feedback.kind}`}
          role={feedback.kind === "error" ? "alert" : "status"} aria-live="polite">
          {feedback.kind === "success"
            ? <CheckCircle2 size={22} aria-hidden="true" />
            : <XCircle size={22} aria-hidden="true" />}
          <div><strong>{feedback.title}</strong><p>{feedback.detail}</p></div>
        </div>
      ) : null}

      <p className="gate-scanner-note">
        QR codes are single-use and expire quickly. Expired, reused or wrong-hostel tokens are rejected by the server.
      </p>

      {!embedded && logout ? (
        <button className="auth-logout" type="button" onClick={logout}>
          <LogOut size={16} aria-hidden="true" /> Sign Out
        </button>
      ) : null}
    </>
  );

  if (embedded) return <section className="panel gate-scanner-panel">{content}</section>;

  return (
    <main className="auth-page qr-page">
      <section className="auth-card gate-scanner-card">
        <div className="auth-brand-mark"><ShieldCheck size={28} aria-hidden="true" /></div>
        {content}
      </section>
    </main>
  );
}
