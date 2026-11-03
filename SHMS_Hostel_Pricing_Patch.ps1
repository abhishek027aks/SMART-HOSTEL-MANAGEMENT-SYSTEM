$ErrorActionPreference = "Stop"
$root = "F:\Project\SMART HOSTEL MANAGEMENT SYSTEM"

$files = @{
    model      = Join-Path $root "server\src\models\Hostel.js"
    controller = Join-Path $root "server\src\controllers\hostelController.js"
    profile    = Join-Path $root "client\src\pages\FacilityManager.jsx"
    directory  = Join-Path $root "client\src\components\PublicHostelDirectory.jsx"
    css        = Join-Path $root "client\src\styles\public-hostels.css"
    publicTest = Join-Path $root "server\test\hostel-public-directory.test.js"
}

foreach ($path in $files.Values) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required file not found: $path. No project files were changed."
    }
}

function Read-Text([string]$Path) {
    return ([System.IO.File]::ReadAllText($Path)).Replace("`r`n", "`n").Replace("`r", "`n")
}

function Replace-Once(
    [string]$Text,
    [string]$Old,
    [string]$New,
    [string]$Label
) {
    $count = [regex]::Matches($Text, [regex]::Escape($Old)).Count
    if ($count -ne 1) {
        throw "${Label}: expected exactly one match, found $count. No project files have been written."
    }
    return $Text.Replace($Old, $New)
}

$model = Read-Text $files.model
$controller = Read-Text $files.controller
$profile = Read-Text $files.profile
$directory = Read-Text $files.directory
$css = Read-Text $files.css
$publicTest = Read-Text $files.publicTest

# 1. Add optional pricing fields to the Hostel database model.
$modelOld = @'
        },
        ownerId: {
'@
$modelNew = @'
        },
        pricing: {
            singleSharing: { type: Number, min: 1, max: 10000000, default: null },
            doubleSharing: { type: Number, min: 1, max: 10000000, default: null },
            tripleSharing: { type: Number, min: 1, max: 10000000, default: null },
            fourSharing: { type: Number, min: 1, max: 10000000, default: null },
            securityDeposit: { type: Number, min: 0, max: 10000000, default: null },
            messCharges: { type: Number, min: 0, max: 10000000, default: null },
            messIncluded: { type: Boolean, default: null }
        },
        ownerId: {
'@
$model = Replace-Once $model $modelOld $modelNew "Hostel model pricing insertion"

# 2. Allow pricing to be loaded and saved by the authenticated profile API.
$controller = Replace-Once $controller `
    'const SAFE_FIELDS = "name hostelCode photoUrl galleryImages address city state pincode contact email roomSetup status createdAt updatedAt";' `
    'const SAFE_FIELDS = "name hostelCode photoUrl galleryImages address city state pincode contact email roomSetup pricing status createdAt updatedAt";' `
    "Safe hostel fields"

$controller = Replace-Once $controller `
    'const allowed = ["name", "photoUrl", "galleryImages", "address", "city", "state", "pincode", "contact", "email", "roomSetup"];' `
    'const allowed = ["name", "photoUrl", "galleryImages", "address", "city", "state", "pincode", "contact", "email", "roomSetup", "pricing"];' `
    "Allowed profile fields"

$controller = Replace-Once $controller `
    '"name photoUrl galleryImages address city state pincode contact email roomSetup createdAt";' `
    '"name photoUrl galleryImages address city state pincode contact email roomSetup pricing createdAt";' `
    "Public hostel projection"
$publicTest = Replace-Once $publicTest `
    '"name photoUrl galleryImages address city state pincode contact email roomSetup createdAt"' `
    '"name photoUrl galleryImages address city state pincode contact email roomSetup pricing createdAt"' `
    "Public directory projection test"

$pricingBranch = @'
            } else if (field === "pricing") {
                if (!value || typeof value !== "object" || Array.isArray(value)) {
                    return res.status(400).json({ status: "error", message: "pricing must be an object." });
                }

                const numericFields = [
                    "singleSharing", "doubleSharing", "tripleSharing", "fourSharing",
                    "securityDeposit", "messCharges"
                ];
                const allowedPricingFields = [...numericFields, "messIncluded"];
                const unsupportedPricingField = Object.keys(value).find(
                    (key) => !allowedPricingFields.includes(key)
                );

                if (unsupportedPricingField) {
                    return res.status(400).json({
                        status: "error",
                        message: `Unsupported pricing field: ${unsupportedPricingField}.`
                    });
                }

                const normalizedPricing = {};
                for (const key of numericFields) {
                    const amount = value[key];
                    if (amount === undefined || amount === null || amount === "") {
                        normalizedPricing[key] = null;
                        continue;
                    }
                    const minimum = ["securityDeposit", "messCharges"].includes(key) ? 0 : 1;
                    if (
                        typeof amount !== "number" || !Number.isFinite(amount) ||
                        amount < minimum || amount > 10000000
                    ) {
                        return res.status(400).json({
                            status: "error",
                            message: `${key} must be a valid amount in INR.`
                        });
                    }
                    normalizedPricing[key] = amount;
                }

                if (
                    value.messIncluded !== undefined && value.messIncluded !== null &&
                    typeof value.messIncluded !== "boolean"
                ) {
                    return res.status(400).json({
                        status: "error",
                        message: "messIncluded must be true, false, or null."
                    });
                }
                normalizedPricing.messIncluded = value.messIncluded ?? null;
                update[field] = normalizedPricing;
'@
$controller = Replace-Once $controller `
    '            } else if (field === "roomSetup") {' `
    ($pricingBranch + '            } else if (field === "roomSetup") {') `
    "Pricing validation branch"

# 3. Add price inputs to the owner-facing Hostel Profile form.
$labelsOld = 'const LABELS = { name: "Block name", blockId: "Block", number: "Floor number", floorId: "Floor", roomNumber: "Room number", roomType: "Room type", capacity: "Bed capacity", roomId: "Room", bedNumber: "Bed number", status: "Status" };'
$labelsNew = @'
const LABELS = { name: "Block name", blockId: "Block", number: "Floor number", floorId: "Floor", roomNumber: "Room number", roomType: "Room type", capacity: "Bed capacity", roomId: "Room", bedNumber: "Bed number", status: "Status" };

const PUBLIC_PRICING_FIELDS = [
  { key: "singleSharing", label: "Single sharing rent / month" },
  { key: "doubleSharing", label: "Double sharing rent / month" },
  { key: "tripleSharing", label: "Triple sharing rent / month" },
  { key: "fourSharing", label: "Four sharing rent / month" },
  { key: "securityDeposit", label: "Security deposit" },
  { key: "messCharges", label: "Mess charges / month" }
];
'@
$profile = Replace-Once $profile $labelsOld $labelsNew "Pricing field labels"

$profile = Replace-Once $profile `
    'const [form, setForm] = useState({ name: "", address: "", city: "", state: "", pincode: "", contact: "", email: "", photoUrl: "" });' `
    'const [form, setForm] = useState({ name: "", address: "", city: "", state: "", pincode: "", contact: "", email: "", photoUrl: "", pricing: { singleSharing: "", doubleSharing: "", tripleSharing: "", fourSharing: "", securityDeposit: "", messCharges: "", messIncluded: "unknown" } });' `
    "Hostel profile form state"

$loadFormOld = '      setForm((current) => ({ ...current, ...Object.fromEntries(Object.keys(current).map((key) => [key, response.data[key] || ""])) }));'
$loadFormNew = @'
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
'@
$profile = Replace-Once $profile $loadFormOld $loadFormNew "Load saved hostel profile"

$submitOld = '      const response = await apiRequest("/api/hostels/current", { token, method: "PATCH", body: JSON.stringify(form) });'
$submitNew = @'
      const numericPricingKeys = [
        "singleSharing", "doubleSharing", "tripleSharing", "fourSharing",
        "securityDeposit", "messCharges"
      ];
      const payload = {
        ...form,
        pricing: {
          ...Object.fromEntries(
            numericPricingKeys.map((key) => [
              key,
              form.pricing[key] === "" || form.pricing[key] == null
                ? null
                : Number(form.pricing[key])
            ])
          ),
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
'@
$profile = Replace-Once $profile $submitOld $submitNew "Submit hostel pricing"

$profileFieldsOld = '{Object.entries({ name: "Hostel name", address: "Address", city: "City", state: "State / Union Territory", pincode: "Pincode", contact: "Contact number", email: "Email address" }).map(([key, label]) => <label className="facility-field" key={key}><span>{label}</span><input required={key === "name"} type={key === "email" ? "email" : "text"} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</>'
$pricingMarkup = @'
<div className="hostel-pricing-editor">
  <h3>Public pricing (INR)</h3>
  <p>Enter actual charges. Leave monthly room rent blank to show “Contact for price”.</p>
  <div className="hostel-pricing-editor-grid">
    {PUBLIC_PRICING_FIELDS.map(({ key, label }) => (
      <label className="facility-field" key={key}>
        <span>{label}</span>
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
    </label>
  </div>
</div>
'@
if (-not $profileFieldsOld.EndsWith(')}</>')) {
    throw "Profile form marker ending is unexpected. No project files have been written."
}
$profileFieldsNew = $profileFieldsOld.Replace(')}</>', ')}' + $pricingMarkup + '</>')
$profile = Replace-Once $profile $profileFieldsOld $profileFieldsNew "Profile form pricing UI"

# 4. Public directory: show price, call, WhatsApp and Google Maps links.
$directory = Replace-Once $directory `
    'import { Building2, Bed, MapPin, Mail, Phone, Search, X, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";' `
    'import { Building2, Bed, MapPin, Mail, Phone, Search, X, RefreshCw, ChevronLeft, ChevronRight, MessageCircle, Navigation, IndianRupee } from "lucide-react";' `
    "Directory icons"

$directoryHelpers = @'
const PRICE_OPTIONS = [
  { key: "singleSharing", label: "Single sharing" },
  { key: "doubleSharing", label: "Double sharing" },
  { key: "tripleSharing", label: "Triple sharing" },
  { key: "fourSharing", label: "Four sharing" }
];

const listedPrices = (pricing) =>
  PRICE_OPTIONS
    .map(({ key, label }) => ({ key, label, amount: pricing?.[key] }))
    .filter(({ amount }) => amount !== "" && amount !== null && amount !== undefined && Number.isFinite(Number(amount)) && Number(amount) > 0)
    .map((item) => ({ ...item, amount: Number(item.amount) }));

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount));

const googleMapsUrl = (hostel) => {
  const location = locationText(hostel);
  const query = addressText(hostel) || [hostel.name, location !== "Location not provided" ? location : ""].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const whatsappUrl = (contact) => {
  let digits = String(contact || "").replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? `https://wa.me/${digits}` : "";
};

'@
$directory = Replace-Once $directory `
    'function HostelPhoto({ src, alt, className = "" }) {' `
    ($directoryHelpers + 'function HostelPhoto({ src, alt, className = "" }) {') `
    "Directory pricing helpers"

$modalPricingBlock = @'
          <section className="public-hostel-pricing" aria-label="Hostel rent and charges">
            <h3><IndianRupee size={19} aria-hidden="true" /> Rent and charges</h3>
            {listedPrices(hostel.pricing).length > 0 ? (
              <div className="public-hostel-pricing-list">
                {listedPrices(hostel.pricing).map(({ key, label, amount }) => (
                  <div className="public-hostel-pricing-item" key={key}>
                    <span>{label}</span>
                    <strong>{formatMoney(amount)} <small>/ month</small></strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="public-hostel-price-note">Monthly rent has not been listed. Contact the hostel for current prices.</p>
            )}
            <div className="public-hostel-extra-charges">
              <div><span>Security deposit</span><strong>{hostel.pricing?.securityDeposit != null ? formatMoney(hostel.pricing.securityDeposit) : "Confirm with hostel"}</strong></div>
              <div><span>Mess charges / month</span><strong>{hostel.pricing?.messCharges != null ? formatMoney(hostel.pricing.messCharges) : "Not specified"}</strong></div>
              <div><span>Mess included in rent</span><strong>{hostel.pricing?.messIncluded === true ? "Yes" : hostel.pricing?.messIncluded === false ? "No" : "Confirm with hostel"}</strong></div>
            </div>
          </section>
          <div className="public-hostel-action-row">
            {hostel.contact ? <a className="public-hostel-action" href={`tel:${String(hostel.contact).replace(/[^\d+]/g, "")}`}><Phone size={16} aria-hidden="true" /> Call hostel</a> : null}
            {whatsappUrl(hostel.contact) ? <a className="public-hostel-action public-hostel-action-whatsapp" href={whatsappUrl(hostel.contact)} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> WhatsApp</a> : null}
            {addressText(hostel) || locationText(hostel) !== "Location not provided" ? <a className="public-hostel-action public-hostel-action-maps" href={googleMapsUrl(hostel)} target="_blank" rel="noreferrer"><Navigation size={16} aria-hidden="true" /> Google Maps</a> : null}
          </div>

'@
$directory = Replace-Once $directory `
    '          <h3>Room setup</h3>' `
    ($modalPricingBlock + '          <h3>Room setup</h3>') `
    "Hostel details pricing and contact actions"

$cardSetupOld = @'
              const setup = hostel.roomSetup || {};

              return (
'@
$cardSetupNew = @'
              const setup = hostel.roomSetup || {};
              const prices = listedPrices(hostel.pricing);
              const startingPrice = prices.length ? Math.min(...prices.map((item) => item.amount)) : null;

              return (
'@
$directory = Replace-Once $directory $cardSetupOld $cardSetupNew "Card starting price"

$cardPrice = @'
                    <div className="public-hostel-price-summary">
                      <span>Monthly rent</span>
                      <strong>{startingPrice === null ? "Contact for price" : `From ${formatMoney(startingPrice)} / month`}</strong>
                    </div>

'@
$directory = Replace-Once $directory `
    '                    {(Number(setup.totalRooms) > 0 || Number(setup.totalBeds) > 0) ? (' `
    ($cardPrice + '                    {(Number(setup.totalRooms) > 0 || Number(setup.totalBeds) > 0) ? (') `
    "Hostel card price summary"

$cardActions = @'
                    <div className="public-hostel-action-row public-hostel-action-row-card">
                      {hostel.contact ? <a className="public-hostel-action" href={`tel:${String(hostel.contact).replace(/[^\d+]/g, "")}`} aria-label={`Call ${hostel.name}`}><Phone size={15} aria-hidden="true" /> Call</a> : null}
                      {whatsappUrl(hostel.contact) ? <a className="public-hostel-action public-hostel-action-whatsapp" href={whatsappUrl(hostel.contact)} target="_blank" rel="noreferrer"><MessageCircle size={15} aria-hidden="true" /> WhatsApp</a> : null}
                      {addressText(hostel) || locationText(hostel) !== "Location not provided" ? <a className="public-hostel-action public-hostel-action-maps" href={googleMapsUrl(hostel)} target="_blank" rel="noreferrer"><Navigation size={15} aria-hidden="true" /> Map</a> : null}
                    </div>

'@
$directory = Replace-Once $directory `
    ('                    <button' + "`n" + '                      className="public-hostel-details-button"') `
    ($cardActions + '                    <button' + "`n" + '                      className="public-hostel-details-button"') `
    "Card call WhatsApp Maps actions"

# 5. Append card, popup and owner-form styles.
if ($css -match '\.public-hostel-price-summary') {
    throw "Pricing CSS already exists. No project files have been written; inspect before retrying."
}
$cssAdditions = @'

/* Public hostel pricing and contact actions */
.public-hostel-price-summary { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; margin:14px 0 12px; padding:12px 13px; border:1px solid #cfe4ff; border-radius:12px; background:#f1f7ff; }
.public-hostel-price-summary span { color:#526a83; font-size:.82rem; font-weight:700; }
.public-hostel-price-summary strong { color:#075fc7; font-size:.93rem; text-align:right; }
.public-hostel-pricing { margin-top:22px; }
.public-hostel-pricing h3 { display:flex; align-items:center; gap:8px; }
.public-hostel-pricing h3 svg { color:#0d70de; }
.public-hostel-pricing-list,.public-hostel-extra-charges { display:grid; gap:9px; }
.public-hostel-pricing-item,.public-hostel-extra-charges>div { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 14px; border:1px solid #dfeaf5; border-radius:11px; background:#f8fbff; }
.public-hostel-pricing-item span,.public-hostel-extra-charges span { color:#536b84; font-size:.88rem; }
.public-hostel-pricing-item strong,.public-hostel-extra-charges strong { color:#193c60; font-size:.92rem; text-align:right; }
.public-hostel-pricing-item small { color:#6c8197; font-size:.75rem; font-weight:600; }
.public-hostel-price-note { color:#61778f; font-size:.91rem; line-height:1.6; }
.public-hostel-action-row { display:flex; flex-wrap:wrap; gap:9px; margin:18px 0; }
.public-hostel-action { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:40px; padding:9px 12px; border:1px solid #d8e4f1; border-radius:10px; background:#f5f9ff; color:#174d83; font-size:.83rem; font-weight:800; text-decoration:none; transition:background 150ms ease,transform 150ms ease; }
.public-hostel-action:hover { background:#e9f3ff; transform:translateY(-1px); }
.public-hostel-action-whatsapp { border-color:#c4ead1; background:#effbf3; color:#15703d; }
.public-hostel-action-whatsapp:hover { background:#e0f7e8; }
.public-hostel-action-maps { border-color:#d8e4f1; background:#fff; }
.public-hostel-action-row-card { margin:15px 0 2px; }
.public-hostel-action-row-card .public-hostel-action { flex:1 1 auto; padding:8px 9px; font-size:.79rem; }
.hostel-pricing-editor { margin-top:22px; padding-top:18px; border-top:1px solid #dce7f3; }
.hostel-pricing-editor h3 { margin:0 0 8px; color:#173755; }
.hostel-pricing-editor>p { color:#63788e; font-size:.88rem; line-height:1.55; }
.hostel-pricing-editor-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 16px; }
@media(max-width:620px) { .hostel-pricing-editor-grid { grid-template-columns:minmax(0,1fr); } .public-hostel-action-row-card .public-hostel-action { flex:1 1 40%; } }
'@
$css += $cssAdditions

# Verify expected feature markers in memory before writing anything.
$checks = @(
    [pscustomobject]@{ Text = $model; Marker = 'pricing: {'; Label = 'Model pricing schema' },
    [pscustomobject]@{ Text = $controller; Marker = 'field === "pricing"'; Label = 'Pricing validation' },
    [pscustomobject]@{ Text = $controller; Marker = 'roomSetup pricing createdAt'; Label = 'Public pricing projection' },
    [pscustomobject]@{ Text = $profile; Marker = 'PUBLIC_PRICING_FIELDS.map'; Label = 'Owner pricing inputs' },
    [pscustomobject]@{ Text = $directory; Marker = 'const googleMapsUrl'; Label = 'Google Maps helper' },
    [pscustomobject]@{ Text = $directory; Marker = 'WhatsApp'; Label = 'WhatsApp action' },
    [pscustomobject]@{ Text = $directory; Marker = 'Contact for price'; Label = 'Fallback price text' },
    [pscustomobject]@{ Text = $css; Marker = '.public-hostel-price-summary'; Label = 'Pricing card CSS' },
    [pscustomobject]@{ Text = $publicTest; Marker = 'roomSetup pricing createdAt'; Label = 'Public directory projection test' }
)
foreach ($check in $checks) {
    if (-not $check.Text.Contains($check.Marker)) {
        throw "Verification marker missing: $($check.Label). No project files have been written."
    }
}

# Save all files only once all checks succeed.
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($files.model, $model, $utf8NoBom)
[System.IO.File]::WriteAllText($files.controller, $controller, $utf8NoBom)
[System.IO.File]::WriteAllText($files.profile, $profile, $utf8NoBom)
[System.IO.File]::WriteAllText($files.directory, $directory, $utf8NoBom)
[System.IO.File]::WriteAllText($files.css, $css, $utf8NoBom)
[System.IO.File]::WriteAllText($files.publicTest, $publicTest, $utf8NoBom)

Write-Host "`nPricing, contact links and Maps UI patch applied." -ForegroundColor Green
Write-Host "Backups: .bak_pricing_$stamp" -ForegroundColor Green

Write-Host "`n===== BACKEND TESTS =====" -ForegroundColor Cyan
Set-Location (Join-Path $root "server")
npm test
$testExit = $LASTEXITCODE

Write-Host "`n===== FRONTEND BUILD =====" -ForegroundColor Cyan
Set-Location (Join-Path $root "client")
npm run build
$buildExit = $LASTEXITCODE

if ($testExit -ne 0 -or $buildExit -ne 0) {
    Write-Host "`nVerification failed. Do not make more changes before reviewing the errors above." -ForegroundColor Red
} else {
    Write-Host "`nBackend tests and frontend build both passed." -ForegroundColor Green
}
