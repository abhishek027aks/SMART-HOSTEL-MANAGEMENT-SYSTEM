$ErrorActionPreference = "Stop"

$root = "F:\Project\SMART HOSTEL MANAGEMENT SYSTEM"
$clientDir = Join-Path $root "client"
$serverDir = Join-Path $root "server"
$appPath = Join-Path $clientDir "src\App.jsx"
$managerPath = Join-Path $clientDir "src\pages\FacilityManager.jsx"
$overviewPath = Join-Path $clientDir "src\components\FacilityOverview.jsx"
$cssPath = Join-Path $clientDir "src\styles\global.css"
$routesPath = Join-Path $serverDir "src\routes\facilityRoutes.js"
$testPath = Join-Path $serverDir "test\facility-route-permissions.test.js"

foreach ($path in @($appPath, $managerPath, $overviewPath, $cssPath, $routesPath, (Join-Path $serverDir "test"))) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required path not found: $path. No changes made."
    }
}

if (Test-Path -LiteralPath $testPath) {
    throw "The facility route permissions test already exists. Inspect current files before rerunning this patch."
}

$appOriginal = [System.IO.File]::ReadAllText($appPath)
$managerOriginal = [System.IO.File]::ReadAllText($managerPath)
$cssOriginal = [System.IO.File]::ReadAllText($cssPath)
$routesOriginal = [System.IO.File]::ReadAllText($routesPath)

if (-not $appOriginal.Contains('import FacilityOverview from "./components/FacilityOverview.jsx";') -or
    -not $managerOriginal.Contains('Manage real blocks, floors, rooms, and beds in the selected hostel.')) {
    throw "The Facility Overview / audited FacilityManager version was not found. Apply against the current project version; no changes made."
}

if ($routesOriginal.Contains('collection.post("/", requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER)') -or
    $managerOriginal.Contains('const canManage = role === "OWNER"') -or
    (Test-Path -LiteralPath $testPath)) {
    throw "Facility mutation permissions appear to be patched already. No changes made."
}

# Require unique source anchors so we never guess where to edit.
$replacements = @(
    @{
        Name = "route POST permission"
        Old = 'collection.post("/", (req, res, next) => { req.params.resource = resource; return controller.create(req, res, next); });'
        New = 'collection.post("/", requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER), (req, res, next) => { req.params.resource = resource; return controller.create(req, res, next); });'
    },
    @{
        Name = "route PATCH permission"
        Old = 'collection.patch("/:id", (req, res, next) => { req.params.resource = resource; return controller.update(req, res, next); });'
        New = 'collection.patch("/:id", requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER), (req, res, next) => { req.params.resource = resource; return controller.update(req, res, next); });'
    },
    @{
        Name = "route DELETE permission"
        Old = 'collection.delete("/:id", (req, res, next) => { req.params.resource = resource; return controller.archive(req, res, next); });'
        New = 'collection.delete("/:id", requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER), (req, res, next) => { req.params.resource = resource; return controller.archive(req, res, next); });'
    }
)

$routePatched = $routesOriginal
foreach ($item in $replacements) {
    $count = [regex]::Matches($routePatched, [regex]::Escape($item.Old)).Count
    if ($count -ne 1) {
        throw "Could not uniquely locate $($item.Name) (found $count). No changes made."
    }
    $routePatched = $routePatched.Replace($item.Old, $item.New)
}

$stateAnchor = '  const [selectedRecord, setSelectedRecord] = useState(null);'
if ([regex]::Matches($managerOriginal, [regex]::Escape($stateAnchor)).Count -ne 1) {
    throw "Could not uniquely locate FacilityManager state anchor. No changes made."
}
$managerPatched = $managerOriginal.Replace(
    $stateAnchor,
    $stateAnchor + "`r`n  const canManage = role === `"OWNER`" || (role === `"SYSTEM_ADMIN`" && hasTenant);"
)

$oldActions = '<div className="facility-row-actions"><button type="button" onClick={() => view(record)}>View</button><button type="button" onClick={() => startEdit(record)}>Edit</button><button type="button" className="archive" onClick={() => deleteFacility(record)}>Delete</button></div>'
$newActions = @'
<div className="facility-row-actions">
  <button type="button" onClick={() => view(record)}>View</button>
  {canManage ? <>
    <button type="button" onClick={() => startEdit(record)}>Edit</button>
    <button type="button" className="archive" onClick={() => deleteFacility(record)}>Delete</button>
  </> : null}
</div>
'@
$newActions = $newActions.Trim()
if ([regex]::Matches($managerPatched, [regex]::Escape($oldActions)).Count -ne 1) {
    throw "Could not uniquely locate facility row actions. No changes made."
}
$managerPatched = $managerPatched.Replace($oldActions, $newActions)

$formOpen = '        <form className="facility-panel facility-form" onSubmit={submit}>'
$formOpenNew = "        {canManage ? (`r`n        <form className=`"facility-panel facility-form`" onSubmit={submit}>"
if ([regex]::Matches($managerPatched, [regex]::Escape($formOpen)).Count -ne 1) {
    throw "Could not uniquely locate facility editor form. No changes made."
}
$managerPatched = $managerPatched.Replace($formOpen, $formOpenNew)

$formTailOld = @'
          <button type="submit" className="facility-submit" disabled={saving}><Save size={16} aria-hidden="true" />{saving ? "Saving…" : editingId ? "Save changes" : <><Plus size={16} aria-hidden="true" /> Add facility</>}</button>
        </form>
'@
$formTailOld = $formTailOld.TrimEnd()
$formTailNew = @'
          <button type="submit" className="facility-submit" disabled={saving}><Save size={16} aria-hidden="true" />{saving ? "Saving…" : editingId ? "Save changes" : <><Plus size={16} aria-hidden="true" /> Add facility</>}</button>
        </form>
        ) : (
          <aside className="facility-panel facility-readonly" role="note">
            <strong>Read-only facility view</strong>
            <p>Only the Hostel Owner or System Admin can create, edit, or delete Blocks, Floors, Rooms and Beds. Warden accounts can review the records here.</p>
          </aside>
        )}
'@
$formTailNew = $formTailNew.TrimEnd()
if ([regex]::Matches($managerPatched, [regex]::Escape($formTailOld)).Count -ne 1) {
    throw "Could not uniquely locate editor form closing block. No changes made."
}
$managerPatched = $managerPatched.Replace($formTailOld, $formTailNew)

$appOldProp = 'hasTenant={Boolean(user.hostelId)}'
$appNewProp = 'hasTenant={Boolean(persistedHostelId)}'
if ([regex]::Matches($appOriginal, [regex]::Escape($appOldProp)).Count -ne 1) {
    throw "Could not uniquely locate FacilityManager tenant-context prop. No changes made."
}
$appPatched = $appOriginal.Replace($appOldProp, $appNewProp)

# Wrap the existing final fallback in a section condition, to prevent System Admin writes while viewing All Hostels.
$appOldTailFull = ': <FacilityManager token={token} role={user.role} hasTenant={Boolean(persistedHostelId)} onHostelChanged={() => setReloadKey((key) => key + 1)} />}'
$appNewTailFull = ': section === "facilities" && user.role === "SYSTEM_ADMIN" && (!activeHostelId || activeHostelId === ALL_HOSTELS_VALUE || !persistedHostelId) ? (\n  <section className="facility-overview-select" role="status">\n    <strong>Select one hostel first</strong>\n    Choose a specific hostel in the Active Hostel switcher before managing its facilities. Facility records cannot be changed in the All Hostels view.\n  </section>\n) : <FacilityManager token={token} role={user.role} hasTenant={Boolean(persistedHostelId)} onHostelChanged={() => setReloadKey((key) => key + 1)} />}'
if ([regex]::Matches($appPatched, [regex]::Escape($appOldTailFull)).Count -ne 1) {
    throw "Could not uniquely locate final Facilities route fallback. No changes made."
}
$appPatched = $appPatched.Replace($appOldTailFull, $appNewTailFull.Replace('\n', "`r`n"))

$cssAppend = @'

/* Read-only facility access for non-admin staff */
.facility-readonly { align-self: start; border-style: dashed; background: #f8fbff; }
.facility-readonly strong { display: block; margin-bottom: 7px; color: #173653; }
.facility-readonly p { margin: 0; color: #607b95; font-size: .86rem; line-height: 1.6; }
'@
if ($cssOriginal.Contains('.facility-readonly')) {
    throw "Read-only facility styles already exist. No changes made."
}
$cssPatched = $cssOriginal + $cssAppend

$testSource = @'
const assert = require("node:assert/strict");
const test = require("node:test");

const router = require("../src/routes/facilityRoutes");
const ROLES = require("../src/constants/roles");

function getResourceRouter(resource) {
    const layer = router.stack.find((candidate) =>
        candidate.name === "router" &&
        Array.isArray(candidate.handle?.stack) &&
        candidate.match(`/${resource}`)
    );
    assert.ok(layer, `Missing /${resource} router`);
    return layer.handle;
}

function getRoute(resource, method, routePath) {
    const childRouter = getResourceRouter(resource);
    const layer = childRouter.stack.find((candidate) =>
        candidate.route?.path === routePath && candidate.route.methods[method]
    );
    assert.ok(layer, `Missing ${method.toUpperCase()} /${resource}${routePath}`);
    return layer.route;
}

function invokeGuard(route, role) {
    assert.equal(route.stack.length, 2, "Mutation route must contain role guard and controller handler");
    const guard = route.stack[0].handle;
    const response = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
    let nextCalled = false;
    guard({ auth: { role } }, response, () => { nextCalled = true; });
    return { response, nextCalled };
}

const resources = ["blocks", "floors", "rooms", "beds"];

for (const resource of resources) {
    test(`${resource}: only OWNER and SYSTEM_ADMIN can create, edit, or delete`, () => {
        const mutationRoutes = [
            ["post", "/"],
            ["patch", "/:id"],
            ["delete", "/:id"]
        ];

        for (const [method, routePath] of mutationRoutes) {
            const route = getRoute(resource, method, routePath);

            for (const role of [ROLES.OWNER, ROLES.SYSTEM_ADMIN]) {
                const result = invokeGuard(route, role);
                assert.equal(result.nextCalled, true, `${role} should be allowed to ${method} ${resource}`);
                assert.equal(result.response.statusCode, null);
            }

            for (const role of [ROLES.WARDEN, ROLES.GUARD, ROLES.STUDENT, ROLES.PARENT]) {
                const result = invokeGuard(route, role);
                assert.equal(result.nextCalled, false, `${role} must be blocked from ${method} ${resource}`);
                assert.equal(result.response.statusCode, 403);
                assert.equal(result.response.body?.message, "You do not have permission to access this resource");
            }
        }
    });

    test(`${resource}: read routes remain available to the route's standard staff roles`, () => {
        const listRoute = getRoute(resource, "get", "/");
        const detailRoute = getRoute(resource, "get", "/:id");
        assert.equal(listRoute.stack.length, 1, "List GET should not have an owner-only mutation guard");
        assert.equal(detailRoute.stack.length, 1, "Detail GET should not have an owner-only mutation guard");
    });
}
'@

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $root "backups\facility_admin_permissions_$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item -LiteralPath $appPath -Destination (Join-Path $backupDir "App.jsx")
Copy-Item -LiteralPath $managerPath -Destination (Join-Path $backupDir "FacilityManager.jsx")
Copy-Item -LiteralPath $cssPath -Destination (Join-Path $backupDir "global.css")
Copy-Item -LiteralPath $routesPath -Destination (Join-Path $backupDir "facilityRoutes.js")

$appChanged = $false
$managerChanged = $false
$cssChanged = $false
$routesChanged = $false
$testCreated = $false

try {
    [System.IO.File]::WriteAllText($routesPath, $routePatched, [System.Text.UTF8Encoding]::new($false))
    $routesChanged = $true

    [System.IO.File]::WriteAllText($managerPath, $managerPatched, [System.Text.UTF8Encoding]::new($false))
    $managerChanged = $true

    [System.IO.File]::WriteAllText($appPath, $appPatched, [System.Text.UTF8Encoding]::new($false))
    $appChanged = $true

    [System.IO.File]::WriteAllText($cssPath, $cssPatched, [System.Text.UTF8Encoding]::new($false))
    $cssChanged = $true

    [System.IO.File]::WriteAllText($testPath, $testSource, [System.Text.UTF8Encoding]::new($false))
    $testCreated = $true

    Write-Host "Source changes applied. Running backend tests..." -ForegroundColor Cyan
    Push-Location $serverDir
    $savedEap = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        npm test
        $serverExit = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $savedEap
        Pop-Location
    }
    if ($serverExit -ne 0) {
        throw "Backend tests failed with exit code $serverExit. Rolling back source changes."
    }

    Write-Host "Backend tests passed. Running frontend production build..." -ForegroundColor Cyan
    Push-Location $clientDir
    try {
        $ErrorActionPreference = "Continue"
        npm run build
        $clientExit = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $savedEap
        Pop-Location
    }
    if ($clientExit -ne 0) {
        throw "Frontend production build failed with exit code $clientExit. Rolling back source changes."
    }

    Write-Host "`nFACILITY ADMIN PERMISSIONS PATCH PASSED" -ForegroundColor Green
    Write-Host "Backup: $backupDir" -ForegroundColor Cyan
    Write-Host "Warden: facilities view-only" -ForegroundColor Green
    Write-Host "Hostel Owner / System Admin with a selected hostel: create, edit, and delete enabled" -ForegroundColor Green
    Write-Host "Server authorization added to POST, PATCH, DELETE endpoints" -ForegroundColor Green
    Write-Host "No database records or credentials were changed." -ForegroundColor Green
}
catch {
    if ($routesChanged) { [System.IO.File]::WriteAllText($routesPath, $routesOriginal, [System.Text.UTF8Encoding]::new($false)) }
    if ($managerChanged) { [System.IO.File]::WriteAllText($managerPath, $managerOriginal, [System.Text.UTF8Encoding]::new($false)) }
    if ($appChanged) { [System.IO.File]::WriteAllText($appPath, $appOriginal, [System.Text.UTF8Encoding]::new($false)) }
    if ($cssChanged) { [System.IO.File]::WriteAllText($cssPath, $cssOriginal, [System.Text.UTF8Encoding]::new($false)) }
    if ($testCreated -and (Test-Path -LiteralPath $testPath)) { Remove-Item -LiteralPath $testPath -Force }
    Write-Host "Patch did not complete. Source files were restored from the in-memory originals." -ForegroundColor Red
    Write-Host "Backup remains at: $backupDir" -ForegroundColor Yellow
    throw
}
