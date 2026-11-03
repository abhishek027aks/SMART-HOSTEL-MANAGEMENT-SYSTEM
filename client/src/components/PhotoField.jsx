import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Trash2, Upload, X } from "lucide-react";
import AuthenticatedPhoto from "./AuthenticatedPhoto.jsx";
import { apiRequest } from "../services/api.js";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function PhotoField({ token, subject, value = "", onChange, label = "Photo" }) {
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [candidateUrl, setCandidateUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [cameraStatus, setCameraStatus] = useState("IDLE");

  useEffect(() => {
    if (!cameraOpen || candidate) return undefined;
    let active = true;
    const startCamera = async () => {
      try {
        setCameraStatus("INITIALIZING");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not available in this browser.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
            setCameraStatus("READY");
          }
        }
      } catch (cameraError) {
        if (active) {
          setCameraStatus("ERROR");
          setError(cameraError.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access or upload a photo instead."
            : cameraError.name === "NotFoundError"
              ? "No camera was found. Upload a photo instead."
              : cameraError.message || "Unable to open the camera.");
        }
      }
    };
    startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraStatus("IDLE");
    };
  }, [cameraOpen, candidate]);

  useEffect(() => () => {
    if (candidateUrl) URL.revokeObjectURL(candidateUrl);
  }, [candidateUrl]);

  useEffect(() => {
    if (value) return;
    setCandidate(null);
    setCandidateUrl("");
  }, [value]);

  const acceptFile = (file) => {
    if (!file) return false;
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Choose a JPEG, PNG, or WEBP image.");
      return false;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Photo must be 5 MB or smaller.");
      return false;
    }
    setError("");
    return true;
  };

  const upload = async (file) => {
    if (!acceptFile(file) || uploading) return;
    setUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      const result = await apiRequest(`/api/uploads/photos/${subject}`, { token, method: "POST", body });
      onChange(result.data.photoUrl);
      setCameraOpen(false);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  };

  const selectFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (acceptFile(file)) {
      if (candidateUrl) URL.revokeObjectURL(candidateUrl);
      setCandidate(file);
      setCandidateUrl(URL.createObjectURL(file));
      void upload(file);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (cameraStatus !== "READY" || !video || video.videoWidth === 0) {
      setError("The camera is not ready yet. Please wait and try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) {
      setError("The camera image could not be captured. Please retake it.");
      return;
    }
    const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
    if (!acceptFile(file)) return;
    if (candidateUrl) URL.revokeObjectURL(candidateUrl);
    setCandidate(file);
    setCandidateUrl(URL.createObjectURL(file));
    setCameraStatus("CAPTURED");
    setError("");
  };

  const clear = () => {
    if (candidateUrl) URL.revokeObjectURL(candidateUrl);
    setCandidate(null);
    setCandidateUrl("");
    onChange("");
    setError("");
    setCameraStatus(cameraOpen ? "INITIALIZING" : "IDLE");
  };

  const closeCamera = () => {
    setCameraOpen(false);
    setCameraStatus("IDLE");
    setError("");
  };

  return <div className="photo-field">
    <span className="photo-field-label">{label}</span>
    {(candidateUrl || value) ? candidateUrl ? <img className="photo-preview" src={candidateUrl} alt={`${label} preview`} /> : <AuthenticatedPhoto token={token} className="photo-preview" value={value} alt={`${label} preview`} /> : <div className="photo-preview photo-preview-empty">No photo selected</div>}
    <div className="photo-actions">
      <button type="button" className="facility-secondary" disabled={uploading} onClick={() => inputRef.current?.click()}><Upload size={15} /> Upload Photo</button>
      <button type="button" className="facility-secondary" disabled={uploading} onClick={() => { setError(""); setCandidate(null); setCandidateUrl(""); setCameraStatus("INITIALIZING"); setCameraOpen(true); }}><Camera size={15} /> Use Camera</button>
      {(value || candidate) ? <button type="button" className="facility-secondary photo-remove" disabled={uploading} onClick={clear}><Trash2 size={15} /> Remove</button> : null}
    </div>
    <input ref={inputRef} className="photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} aria-label={`Upload ${label}`} />
    {uploading ? <p className="facility-state" role="status">Uploading photo...</p> : null}
    {error ? <p className="facility-error" role="alert">{error}</p> : null}
    {cameraOpen ? <div className="camera-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCamera(); }}>
      <section className="camera-dialog" role="dialog" aria-modal="true" aria-label={`${label} camera`}>
        <div className="facility-form-heading"><h3>Capture {label.toLowerCase()}</h3><button type="button" className="facility-icon-button" aria-label="Close camera" onClick={closeCamera}><X size={17} /></button></div>
        {candidateUrl ? <img className="camera-preview" src={candidateUrl} alt="Captured photo preview" /> : <video ref={videoRef} className="camera-preview" autoPlay playsInline muted onLoadedMetadata={() => setCameraStatus("READY")} onCanPlay={() => setCameraStatus("READY")} />}
        {!candidateUrl && cameraStatus === "INITIALIZING" ? <p className="facility-state" role="status">Starting camera...</p> : null}
        {!candidateUrl && cameraStatus === "READY" ? <p className="facility-state" role="status">Camera ready.</p> : null}
        {error ? <p className="facility-error" role="alert">{error}</p> : null}
        <div className="photo-actions">
          {candidate ? <>
            <button type="button" className="facility-secondary" onClick={() => { setCandidate(null); setCandidateUrl(""); setError(""); setCameraStatus("INITIALIZING"); }}><RotateCcw size={15} /> Retake</button>
            <button type="button" className="facility-submit" disabled={uploading} onClick={() => void upload(candidate)}>{uploading ? "Uploading..." : "Use Photo"}</button>
          </> : <button type="button" className="facility-submit" disabled={cameraStatus !== "READY"} onClick={() => void capture()}><Camera size={15} /> Capture</button>}
        </div>
      </section>
    </div> : null}
  </div>;
}

export default PhotoField;
