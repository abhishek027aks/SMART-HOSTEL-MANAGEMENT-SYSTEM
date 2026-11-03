import { useEffect, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import {
  ArrowRight,
  Camera,
  ImagePlus,
  Trash2,
  Bed,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  DoorOpen,
  Eye,
  EyeOff,
  Home,
  Info,
  LayoutGrid,
  LockKeyhole,
  Mail,
  MessageSquareWarning,
  QrCode,
  ShieldCheck,
  Soup,
  Sparkles,
  UserRound,
  Users
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import PublicHostelDirectory from "../components/PublicHostelDirectory.jsx";
import InternationalPhoneInput, { isValidInternationalPhone } from "../components/InternationalPhoneInput.jsx";

const INDIAN_STATES_AND_TERRITORIES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
];

const CITY_SUGGESTIONS = {
  "Andhra Pradesh": ["Amaravati", "Visakhapatnam", "Vijayawada"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat"],
  Assam: ["Dispur", "Guwahati", "Silchar"],
  Bihar: ["Patna", "Gaya", "Muzaffarpur"],
  Chhattisgarh: ["Raipur", "Bilaspur", "Bhilai"],
  Goa: ["Panaji", "Margao", "Vasco da Gama"],
  Gujarat: ["Gandhinagar", "Ahmedabad", "Surat"],
  Haryana: ["Chandigarh", "Gurugram", "Faridabad"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Mandi"],
  Jharkhand: ["Ranchi", "Jamshedpur", "Dhanbad"],
  Karnataka: ["Bengaluru", "Mysuru", "Mangaluru"],
  Kerala: ["Thiruvananthapuram", "Kochi", "Kozhikode"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur"],
  Manipur: ["Imphal", "Churachandpur", "Thoubal"],
  Meghalaya: ["Shillong", "Tura", "Jowai"],
  Mizoram: ["Aizawl", "Lunglei", "Champhai"],
  Nagaland: ["Kohima", "Dimapur", "Mokokchung"],
  Odisha: ["Bhubaneswar", "Cuttack", "Rourkela"],
  Punjab: ["Chandigarh", "Ludhiana", "Amritsar"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur"],
  Sikkim: ["Gangtok", "Namchi", "Gyalshing"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai"],
  Telangana: ["Hyderabad", "Warangal", "Karimnagar"],
  Tripura: ["Agartala", "Udaipur", "Dharmanagar"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi"],
  Uttarakhand: ["Dehradun", "Haridwar", "Nainital"],
  "West Bengal": ["Kolkata", "Howrah", "Siliguri"],
  "Andaman and Nicobar Islands": ["Sri Vijaya Puram", "Diglipur", "Car Nicobar"],
  Chandigarh: ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Silvassa", "Diu"],
  Delhi: ["New Delhi", "Delhi"],
  "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag"],
  Ladakh: ["Leh", "Kargil"],
  Lakshadweep: ["Kavaratti", "Agatti", "Andrott"],
  Puducherry: ["Puducherry", "Karaikal", "Mahe"]
};

const ROLES = [
  { label: "Admin", detail: "Hostel owner", value: "OWNER", icon: Building2 },
  { label: "Warden", detail: "Hostel operations", value: "WARDEN", icon: ShieldCheck },
  { label: "Guard", detail: "Gate access", value: "GUARD", icon: LockKeyhole },
  { label: "Student", detail: "Resident access", value: "STUDENT", icon: UserRound },
  { label: "Parent", detail: "Family access", value: "PARENT", icon: Users }
];

const FEATURES = [
  { title: "Room Management", icon: Bed, tone: "green" },
  { title: "Student Records", icon: Users, tone: "blue" },
  { title: "QR Based Gate Entry", icon: QrCode, tone: "purple" },
  { title: "Outpass Management", icon: DoorOpen, tone: "orange" },
  { title: "Complaints & Support", icon: MessageSquareWarning, tone: "pink" },
  { title: "Mess Management", icon: Soup, tone: "cyan" }
];

const BENEFITS = [
  { title: "Secure & Reliable", text: "Role-based access and hostel-scoped records.", icon: ShieldCheck },
  { title: "Anywhere Access", text: "Use the system from your supported browser.", icon: Building2 },
  { title: "One-Time QR", text: "Designed for verified gate entry workflows.", icon: ClipboardCheck },
  { title: "Real-Time Records", text: "See current records loaded from your hostel.", icon: CheckCircle2 },
  { title: "Mess Management", text: "A place for hostel meal operations as they are enabled.", icon: Soup },
  { title: "Detailed Reports", text: "Review hostel records in one operations view.", icon: LayoutGrid }
];

const EMPTY_REGISTRATION = {
  name: "",
  email: "",
  mobile: "",
  password: "",
  hostelName: "",
  hostelCode: "",
  accessCode: "",
  contact: "",
  city: "",
  state: "",
  address: "",
  pincode: "",
  hostelEmail: "",
  photoUrl: "",
  galleryImages: ""
};
const REMEMBERED_IDENTIFIER_KEY = "shms.rememberedIdentifier";

const fieldErrors = {
  identifier: "Enter the email, mobile number, or student ID for your account.",
  password: "Enter your password.",
  role: "Select the role assigned to your account.",
  accessCode: "Enter the access code provided by your hostel."
};

function Login({ initialMode = "login", onRegistrationStart }) {
  const { login, googleLogin, registerOwner } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [selectedRole, setSelectedRole] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [isMobileLogin, setIsMobileLogin] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPasswordHelp, setShowPasswordHelp] = useState(false);
  const [registerForm, setRegisterForm] = useState(EMPTY_REGISTRATION);
  const [registrationGoogleCredential, setRegistrationGoogleCredential] = useState("");
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const galleryPickerRef = useRef(null);
  const cameraPickerRef = useRef(null);
  const galleryPhotosRef = useRef([]);
  galleryPhotosRef.current = galleryPhotos;
  const [error, setError] = useState("");

  useEffect(() => () => {
    galleryPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
  }, []);

  const handleGallerySelection = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;

    const accepted = [];
    let validationMessage = "";
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

    for (const file of selected) {
      if (!allowedTypes.has(file.type)) {
        validationMessage = "Choose JPEG, PNG, or WEBP images only.";
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        validationMessage = "Each image must be 5 MB or smaller.";
        continue;
      }
      if (galleryPhotos.length + accepted.length >= 8) {
        validationMessage = "You can select a maximum of 8 hostel gallery photos.";
        break;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }

    if (accepted.length) setGalleryPhotos((current) => [...current, ...accepted]);
    setError(validationMessage);
  };

  const removeGalleryPhoto = (previewUrl) => {
    URL.revokeObjectURL(previewUrl);
    setGalleryPhotos((current) => current.filter((photo) => photo.previewUrl !== previewUrl));
    setError("");
  };
  const [fieldError, setFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isStudentLogin = selectedRole === "STUDENT";

  useEffect(() => {
    try {
      const rememberedIdentifier = window.sessionStorage.getItem(REMEMBERED_IDENTIFIER_KEY);
      if (rememberedIdentifier) {
        setIdentifier(rememberedIdentifier);
        setRememberMe(true);
      }
    } catch {
      setError("This browser does not allow remembering your account name. You can still sign in.");
    }
  }, []);

  const focusAuthCard = (nextMode) => {
    setMode(nextMode);
    document.getElementById("auth-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setFieldError("");

    if (!selectedRole) {
      setFieldError(fieldErrors.role);
      return;
    }
    if (!identifier.trim()) {
      setFieldError(fieldErrors.identifier);
      return;
    }
    if (!password) {
      setFieldError(fieldErrors.password);
      return;
    }    if (isMobileLogin && !isValidInternationalPhone(identifier)) {
      setFieldError("Enter a valid mobile number with country code.");
      return;
    }
    if (isStudentLogin && !accessCode.trim()) {
      setFieldError(fieldErrors.accessCode);
      return;
    }

    setSubmitting(true);
    try {
      const credentials = {
        identifier: identifier.trim(),
        password,
        role: selectedRole
      };
      if (isStudentLogin) {
        credentials.accessCode = accessCode.trim();
      }
      await login(credentials);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    setFieldError("");

    if (!selectedRole) {
      setFieldError(fieldErrors.role);
      return;
    }

    if (!credentialResponse?.credential) {
      setError("Google did not return a sign-in credential. Please try again.");
      return;
    }

    const credentials = {
      credential: credentialResponse.credential,
      role: selectedRole
    };

    if (isStudentLogin) {
      if (!identifier.trim()) {
        setFieldError(fieldErrors.identifier);
        return;
      }
      if (!accessCode.trim()) {
        setFieldError(fieldErrors.accessCode);
        return;
      }
      credentials.identifier = identifier.trim();
      credentials.accessCode = accessCode.trim();
    }

    setSubmitting(true);
    try {
      await googleLogin(credentials);
    } catch (requestError) {
      setError(requestError.message || "Google Sign-In failed.");
    } finally {
      setSubmitting(false);
    }
  };
  const handleGoogleRegistrationSuccess = (credentialResponse) => {
    setError("");
    if (!credentialResponse?.credential) {
      setRegistrationGoogleCredential("");
      setError("Google did not return a verification credential. Please try again.");
      return;
    }
    setRegistrationGoogleCredential(credentialResponse.credential);
  };

  const handleRegistrationSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!registrationGoogleCredential) {
      setError("Verify the owner Google account before creating the hostel account.");
      return;
    }


    if (!registerForm.name.trim() || !registerForm.hostelName.trim()) {
      setError("Enter both the owner name and hostel name.");
      return;
    }
    if (!isValidInternationalPhone(registerForm.mobile)) {
      setError("Enter a valid mobile number with its country calling code.");
      return;
    }
    if (registerForm.password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }


    setSubmitting(true);
    try {
      await registerOwner({
        ...registerForm,
        galleryFiles: galleryPhotos.map((photo) => photo.file),
        googleCredential: registrationGoogleCredential
      });
      onRegistrationStart?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateRegisterField = (field, value) => {
    if (field === "email") setRegistrationGoogleCredential("");
    setRegisterForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "state" ? { city: "" } : {})
    }));
  };

  const selectRole = (role) => {
    setSelectedRole(role);
    setFieldError("");
    setError("");
    if (role === "STUDENT") {
      setIsMobileLogin(false);
    } else {
      setAccessCode("");
    }
  };

  const updateIdentifier = (value) => {
    setIdentifier(value);
    if (rememberMe) {
      try {
        window.sessionStorage.setItem(REMEMBERED_IDENTIFIER_KEY, value);
      } catch {
        setError("Your account name could not be saved in this browser. You can still sign in.");
      }
    }
  };

  const updateRememberMe = (checked) => {
    setRememberMe(checked);
    setError("");
    try {
      if (checked && identifier.trim()) {
        window.sessionStorage.setItem(REMEMBERED_IDENTIFIER_KEY, identifier.trim());
      } else if (!checked) {
        window.sessionStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
      }
    } catch {
      setError("Your account name could not be saved in this browser. You can still sign in.");
    }
  };

  const toggleLoginIdentifier = () => {
    setIsMobileLogin((current) => !current);
    updateIdentifier("");
    setFieldError("");
    setError("");
  };
  return (
    <main className="landing-page" id="home">
      <header className="landing-header">
        <div className="landing-header-inner">
          <a className="brand-block" href="#home" aria-label="Smart Hostel Management System home">
            <span className="brand-mark-home"><Home size={25} aria-hidden="true" /></span>
            <span className="brand-copy">
              <strong>Smart Hostel</strong>
              <span>Management System</span>
            </span>
          </a>

          <nav className="main-nav" aria-label="Main navigation">
            <a className="nav-pill" onClick={(event) => { document.querySelectorAll(".nav-pill").forEach((link) => link.classList.remove("active", "is-active", "nav-pill-active", "selected")); event.currentTarget.classList.add("active"); }} href="#home"><Home size={15} aria-hidden="true" />Home</a>
            <a className="nav-pill" onClick={(event) => { document.querySelectorAll(".nav-pill").forEach((link) => link.classList.remove("active", "is-active", "nav-pill-active", "selected")); event.currentTarget.classList.add("active"); }} href="#about"><Info size={15} aria-hidden="true" />About</a>
            <a className="nav-pill" onClick={(event) => { document.querySelectorAll(".nav-pill").forEach((link) => link.classList.remove("active", "is-active", "nav-pill-active", "selected")); event.currentTarget.classList.add("active"); }} href="#features"><Sparkles size={15} aria-hidden="true" />Features</a>
            <a className="nav-pill" onClick={(event) => { document.querySelectorAll(".nav-pill").forEach((link) => link.classList.remove("active", "is-active", "nav-pill-active", "selected")); event.currentTarget.classList.add("active"); }} href="#modules"><LayoutGrid size={15} aria-hidden="true" />Modules</a>
            <a className="nav-pill" onClick={(event) => { document.querySelectorAll(".nav-pill").forEach((link) => link.classList.remove("active", "is-active", "nav-pill-active", "selected")); event.currentTarget.classList.add("active"); }} href="#registered-hostels"><Building2 size={15} aria-hidden="true" />Hostels</a>
            <a className="nav-pill" onClick={(event) => { document.querySelectorAll(".nav-pill").forEach((link) => link.classList.remove("active", "is-active", "nav-pill-active", "selected")); event.currentTarget.classList.add("active"); }} href="#contact"><Mail size={15} aria-hidden="true" />Contact</a>
          </nav>

          <button type="button" className="nav-login-btn" onClick={() => focusAuthCard("login")}>
            <LockKeyhole size={15} aria-hidden="true" />
            Login
          </button>
        </div>
      </header>

      <section className="hero-wrap" aria-labelledby="hero-title">
        <div className="hero-copy-panel">
          <div className="hero-content">
            <div className="hero-badges" aria-label="Product qualities">
              <span>Modern</span>
              <span>Secure</span>
              <span>Smart</span>
              <span>Campus Ready</span>
            </div>
            <h1 id="hero-title">Smart Hostel <span>Management System</span></h1>
            <p className="hero-intro">A complete digital solution for hostel administration</p>
            <p className="hero-subtext">
              Manage students, rooms, entry and exit, outpasses, complaints and more in one secure workspace.
            </p>
            <div className="hero-actions">
              <button type="button" className="primary-action" onClick={() => focusAuthCard("register")}>
                Get Started <ArrowRight size={18} aria-hidden="true" />
              </button>
              <a className="secondary-action" href="#features">Explore Features</a>
            </div>
            <div className="feature-grid" id="features">
              {FEATURES.map(({ title, icon: Icon, tone }) => (
                <article className={`feature-card ${tone}`} key={title}>
                  <span className="feature-icon"><Icon size={21} aria-hidden="true" /></span>
                  <span className="feature-label">{title}</span>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="login-panel">
          <section className="login-box" id="auth-card" aria-labelledby="auth-title">
            <div className="login-card-heading">
              <span className="login-brand-icon"><Home size={25} aria-hidden="true" /></span>
              <p className="login-brand-text">SMART HOSTEL <span>MANAGEMENT SYSTEM</span></p>
              <p className="login-caption">
                {mode === "login" ? "Sign in to your account" : "Create an owner account and hostel"}
              </p>
            </div>

            <div className="login-mode-toggle" role="tablist" aria-label="Account access">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={mode === "login" ? "active" : ""}
                onClick={() => { setMode("login"); setError(""); }}
              >
                Login
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={mode === "register" ? "active" : ""}
                onClick={() => { setMode("register"); setError(""); }}
              >
                Register
              </button>
            </div>

            {mode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="auth-form landing-form" noValidate>
                <div className="login-form-content">
                  <div className="login-fields">
                  <label className="form-field">
                    <span>{isStudentLogin ? "Student ID" : isMobileLogin ? "Mobile number" : "Email / Username"}</span>
                    {!isStudentLogin && isMobileLogin ? (
                      <InternationalPhoneInput
                        name="login-mobile"
                        label="Login mobile number"
                        required
                        value={identifier}
                        onChange={updateIdentifier}
                      />
                    ) : (
                      <input
                        name="identifier"
                        autoComplete="username"
                        placeholder={isStudentLogin ? "Enter student ID" : "Email address or username"}
                        value={identifier}
                        onChange={(event) => updateIdentifier(event.target.value)}
                        aria-invalid={fieldError === fieldErrors.identifier}
                        required
                      />
                    )}
                  </label>
                  {selectedRole && !isStudentLogin ? (
                    <button
                      type="button"
                      className="link-button"
                      onClick={toggleLoginIdentifier}
                    >
                      {isMobileLogin ? "Use email / username instead" : "Use mobile number with country flag"}
                    </button>
                  ) : null}

                  <label className="form-field">
                    <span>Password</span>
                    <span className="password-input-wrap">
                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        aria-invalid={fieldError === fieldErrors.password}
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                      </button>
                    </span>
                  </label>

                  {isStudentLogin ? (<label className="form-field">
                      <span>Hostel Access Code</span>
                      <input
                        name="accessCode"
                        autoComplete="organization"
                        value={accessCode}
                        onChange={(event) => setAccessCode(event.target.value)}
                        aria-invalid={fieldError === fieldErrors.accessCode}
                        required
                      />
                    </label>) : null}
                  </div>

                  <div className="login-row-inline">
                    <label className="checkbox-row">
                      <input
                        name="rememberEmail"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) => updateRememberMe(event.target.checked)}
                      />
                      <span>Remember me</span>
                    </label>
                    <button
                      type="button"
                      className="link-button"
                      aria-expanded={showPasswordHelp}
                      onClick={() => setShowPasswordHelp((visible) => !visible)}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  {rememberMe ? (
                    <p className="form-hint">Only your account name is remembered in this tab. Your password and sign-in session are never saved.</p>
                  ) : null}
                  {showPasswordHelp ? (
                    <p className="form-hint" role="status">
                      Password reset is not available yet. Contact your hostel administrator for help.
                    </p>
                  ) : null}

                  <fieldset className="role-select-wrap">
                    <legend>Choose the role assigned to your account</legend>
                    <div className="role-grid">
                      {ROLES.map(({ label, detail, value, icon: Icon }) => (
                        <label className={`role-option ${selectedRole === value ? "selected" : ""}`} key={value}>
                          <input
                            type="radio"
                            name="role"
                            value={value}
                            checked={selectedRole === value}
                            onChange={() => selectRole(value)}
                          />
                          <Icon size={17} aria-hidden="true" />
                          <span><strong>{label}</strong><small>{detail}</small></span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {/* SHMS GOOGLE LOGIN BUTTON V1 */}
                  {selectedRole ? (
                    <div className="shms-google-login">
                      <p className="shms-google-login-label">Or continue with Google</p>
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError("Google Sign-In could not be completed. Please try again.")}
                        text="continue_with"
                        shape="rectangular"
                        width="320"
                        useOneTap={false}
                      />
                    </div>
                  ) : null}
                  {fieldError ? <p className="auth-error" role="alert">{fieldError}</p> : null}
                  {error ? <p className="auth-error" role="alert">{error}</p> : null}
                </div>
                <button type="submit" className="auth-submit landing-submit" disabled={submitting}>
                  {submitting ? "Signing in…" : "Login"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegistrationSubmit} className="auth-form landing-form register-form">
                <div className="registration-fields">
                  <section className="registration-section" aria-labelledby="owner-details-heading">
                    <h2 id="owner-details-heading">Owner details</h2>
                    <label className="form-field">
                      <span>Full name</span>
                      <input name="name" autoComplete="name" value={registerForm.name} onChange={(event) => updateRegisterField("name", event.target.value)} required />
                    </label>
                    <label className="form-field">
                      <span>Email address</span>
                      <input name="email" type="email" autoComplete="email" value={registerForm.email} onChange={(event) => updateRegisterField("email", event.target.value)} required />
                    </label>
                    <label className="form-field">
                      <span>Mobile number</span>
                      <InternationalPhoneInput name="owner-mobile" label="Owner mobile number" required value={registerForm.mobile} onChange={(mobile) => updateRegisterField("mobile", mobile)} />
                    </label>
                    <label className="form-field">
                      <span>Password <small>(at least 8 characters)</small></span>
                      <span className="password-input-wrap">
                        <input name="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={registerForm.password} onChange={(event) => updateRegisterField("password", event.target.value)} required />
                        <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>
                          {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                        </button>
                      </span>
                    </label>
                  </section>

                  <div className="shms-google-login">
                    <p className="shms-google-login-label">
                      {registrationGoogleCredential
                        ? "Google sign-in received. The server will verify the email during registration."
                        : "Verify the owner email with Google"}
                    </p>
                    <GoogleLogin
                      onSuccess={handleGoogleRegistrationSuccess}
                      onError={() => {
                        setRegistrationGoogleCredential("");
                        setError("Google verification could not be completed. Please try again.");
                      }}
                      text="continue_with"
                      shape="rectangular"
                      width="320"
                      useOneTap={false}
                    />
                  </div>

                  <section className="registration-section" aria-labelledby="hostel-details-heading">
                    <h2 id="hostel-details-heading">Hostel details</h2>
                    <label className="form-field">
                      <span>Hostel name</span>
                      <input name="hostelName" autoComplete="organization" value={registerForm.hostelName} onChange={(event) => updateRegisterField("hostelName", event.target.value)} required />
                    </label>
                    <label className="form-field">
                      <span>Hostel code <small>(3–64 letters, numbers, _ or -)</small></span>
                      <input name="hostelCode" autoComplete="off" minLength={3} maxLength={64} pattern="^[A-Za-z0-9_-]{3,64}$" value={registerForm.hostelCode} onChange={(event) => updateRegisterField("hostelCode", event.target.value)} required />
                    </label>
                    <label className="form-field">
                      <span>Student access code <small>(4–64 letters, numbers, _ or -)</small></span>
                        <input name="accessCode" autoComplete="off" minLength={4} maxLength={64} pattern="^[A-Za-z0-9_-]{4,64}$" value={registerForm.accessCode} onChange={(event) => updateRegisterField("accessCode", event.target.value)} required />
                    </label>
                    <label className="form-field">
                      <span>Hostel email <small>(optional)</small></span>
                      <input name="hostelEmail" type="email" autoComplete="off" value={registerForm.hostelEmail} onChange={(event) => updateRegisterField("hostelEmail", event.target.value)} />
                    </label>
                    <label className="form-field">
                      <span>Contact number <small>(optional)</small></span>
                      <input name="contact" type="tel" autoComplete="tel" value={registerForm.contact} onChange={(event) => updateRegisterField("contact", event.target.value)} />
                    </label>
                  </section>

                  <section className="registration-section" aria-labelledby="location-heading">
                    <h2 id="location-heading">Location & photos <small>(optional)</small></h2>
                    <label className="form-field">
                      <span>State / Union Territory</span>
                      <select name="state" autoComplete="address-level1" value={registerForm.state} onChange={(event) => updateRegisterField("state", event.target.value)}>
                        <option value="">Select a state or territory</option>
                        {INDIAN_STATES_AND_TERRITORIES.map((state) => <option key={state} value={state}>{state}</option>)}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>City <small>(choose a suggestion or type another)</small></span>
                      <input name="city" autoComplete="address-level2" list="city-suggestions" value={registerForm.city} onChange={(event) => updateRegisterField("city", event.target.value)} />
                      <datalist id="city-suggestions">
                        {(CITY_SUGGESTIONS[registerForm.state] || []).map((city) => <option key={city} value={city} />)}
                      </datalist>
                    </label>
                    <label className="form-field">
                      <span>Address</span>
                      <input name="address" autoComplete="street-address" value={registerForm.address} onChange={(event) => updateRegisterField("address", event.target.value)} />
                    </label>
                    <label className="form-field">
                      <span>Pincode</span>
                      <input name="pincode" autoComplete="postal-code" inputMode="numeric" maxLength={24} value={registerForm.pincode} onChange={(event) => updateRegisterField("pincode", event.target.value)} />
                    </label>
                    <label className="form-field">
                      <span>Hostel photo</span>
                      <p className="form-hint">Upload a hostel photo after creating your owner account in Hostel Profile settings.</p>
                    </label>
                    <div className="form-field registration-gallery-upload">
                      <span>Hostel gallery photos <small>(up to 8 images, 5 MB each)</small></span>
                      <p className="form-hint">
                        Choose photos from your device or use the camera. Images will upload securely when you create your Owner account.
                      </p>

                      <div className="registration-gallery-toolbar">
                        <button type="button" className="registration-gallery-button" onClick={() => galleryPickerRef.current?.click()}>
                          <ImagePlus size={16} aria-hidden="true" /> Choose from Gallery
                        </button>
                        <button type="button" className="registration-gallery-button" onClick={() => cameraPickerRef.current?.click()}>
                          <Camera size={16} aria-hidden="true" /> Take Photo
                        </button>
                      </div>

                      <input
                        ref={galleryPickerRef}
                        className="registration-gallery-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handleGallerySelection}
                        aria-label="Choose hostel gallery photos"
                      />
                      <input
                        ref={cameraPickerRef}
                        className="registration-gallery-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleGallerySelection}
                        aria-label="Take a hostel gallery photo"
                      />

                      {galleryPhotos.length ? (
                        <div className="registration-gallery-grid">
                          {galleryPhotos.map((photo, index) => (
                            <article className="registration-gallery-card" key={photo.previewUrl}>
                              <img
                                className="registration-gallery-preview"
                                src={photo.previewUrl}
                                alt={`Hostel gallery preview ${index + 1}`}
                              />
                              <div className="registration-gallery-card-footer">
                                <span className="registration-gallery-name" title={photo.file.name}>
                                  Photo {index + 1}
                                </span>
                                <button
                                  type="button"
                                  className="registration-gallery-remove"
                                  onClick={() => removeGalleryPhoto(photo.previewUrl)}
                                  aria-label={`Remove photo ${index + 1}`}
                                >
                                  <Trash2 size={15} aria-hidden="true" />
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="form-hint">No gallery photos selected yet.</p>
                      )}
                    </div>
                    <p className="form-hint">
                      Room and bed records are managed separately after registration; this form does not create them.
                    </p>
                  </section>
                </div>
                {error ? <p className="auth-error" role="alert">{error}</p> : null}
                <button type="submit" className="auth-submit landing-submit" disabled={submitting}>
                  {submitting ? "Creating account…" : "Create Owner Account"}
                </button>
              </form>
            )}
          </section>
        </aside>
      </section>

      <PublicHostelDirectory />

      <section className="trust-section" id="about" aria-labelledby="why-heading">
        <div className="section-heading">
          <span className="section-kicker">A clearer way to run your hostel</span>
          <h2 id="why-heading">Why Choose Our System?</h2>
          <p>Purpose-built tools for day-to-day hostel operations.</p>
        </div>
        <div className="trust-grid" id="modules">
          {BENEFITS.map(({ title, text, icon: Icon }, index) => (
            <article className="trust-card" id={index === 0 ? "gallery" : undefined} key={title}>
              <span className="trust-icon"><Icon size={22} aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <p className="landing-contact" id="contact">
          For account access or password help, contact your hostel administrator.
        </p>
      </section>
    </main>
  );
}

export default Login;
