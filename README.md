# SMART HOSTEL MANAGEMENT

A minimal-file Flask + SQLite implementation of the Smart Hostel UI shown in the reference image.

## Folder structure

```text
SMART_HOSTEL_MANAGEMENT/
├── app.py
├── requirements.txt
├── README.md
├── templates/
│   └── index.html
└── static/
    └── style.css
```

`database/hostel.db` is created automatically the first time `app.py` runs.

## Run on Windows Terminal / PowerShell

```powershell
E:
cd "E:\SMART HOSTEL MANAGEMENT"

py -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -r requirements.txt

python app.py
```

Then open:

```text
http://127.0.0.1:5000
```

For another phone/laptop on the same Wi-Fi, find the PC IPv4 address:

```powershell
ipconfig
```

Then open:

```text
http://YOUR-PC-IP:5000
```

If Windows Firewall asks, allow Python on Private networks.

## Demo logins

| Role | Email | Password |
|---|---|---|
| Student | student@smarthostel.local | student123 |
| Warden | warden@smarthostel.local | warden123 |
| Gate | gate@smarthostel.local | gate123 |
| Admin | admin@smarthostel.local | admin123 |
| Parent | parent@smarthostel.local | parent123 |

## What is already working

- Landing page
- Login/session authentication
- Role-specific navigation
- Student dashboard
- QR-style student screen
- Outpass submission -> SQLite
- Warden outpass approval/rejection -> SQLite
- Entry/exit gate logging -> SQLite
- Complaint submission -> SQLite
- Fee/payment history -> SQLite
- Student room screen
- Warden student list
- Warden room list
- Visitor registration
- Gate terminal
- Responsive mobile layout
- Dashboard metrics and occupancy chart
- Automatic database creation/seeding

## Important production upgrades

This project is intentionally small and runnable. Before a real hostel deploys it:

1. Put the app behind HTTPS.
2. Set a strong `FLASK_SECRET_KEY`.
3. Replace demo passwords with admin-created users and password reset.
4. Add CSRF protection and stronger authorization policies.
5. Replace the visual QR placeholder with signed, expiring QR tokens.
6. Add camera QR scanning on the gate terminal.
7. Add real payment gateway integration.
8. Add audit logs for admin/warden actions.
9. Move SQLite to PostgreSQL/MySQL for multi-instance production deployment.
10. Run with Waitress on Windows or Gunicorn on Linux instead of Flask debug server.

## Code map

- `app.py` = backend, database, login, APIs.
- `templates/index.html` = all screens + frontend JavaScript in one file.
- `static/style.css` = complete UI styling.
- `requirements.txt` = only required Python packages.

Every major backend/frontend section contains comments explaining what it does and how the pieces communicate.
