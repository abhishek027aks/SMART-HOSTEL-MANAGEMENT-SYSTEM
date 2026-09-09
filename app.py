"""
SMART HOSTEL - Minimal Flask Application
-----------------------------------------
How it works:
1. Flask serves the web UI from templates/index.html.
2. SQLite stores users and hostel records locally in database/hostel.db.
3. Login creates a server-side session, so the selected role controls the dashboard.
4. JSON API endpoints below are used by the JavaScript in index.html for actions
   such as applying for outpass, raising complaints, recording gate entry/exit,
   adding visitors, and marking requests approved/rejected.
5. The database is auto-created on first run, so no separate SQL setup is required.
"""

from pathlib import Path
import sqlite3
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, render_template, request, redirect, url_for, session, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash

# Flask's built-in web server is enough for development.
# For real hosting, run this application behind Gunicorn/Waitress + HTTPS.
BASE_DIR = Path(__file__).resolve().parent
DB_DIR = BASE_DIR / "database"
DB_PATH = DB_DIR / "hostel.db"

app = Flask(__name__)
# Change this in production: set FLASK_SECRET_KEY as an environment variable.
app.secret_key = __import__("os").environ.get("FLASK_SECRET_KEY", "change-this-secret-in-production")


def get_db():
    """Open one SQLite connection per request and reuse it through flask.g."""
    if "db" not in g:
        DB_DIR.mkdir(exist_ok=True)
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    """Close the request's SQLite connection after Flask finishes the request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """
    Create all minimum tables and seed demo data.
    Running the app again does NOT duplicate seed rows.
    """
    db = get_db()

    db.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        roll_no TEXT,
        room TEXT,
        phone TEXT
    );

    CREATE TABLE IF NOT EXISTS outpasses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        from_time TEXT NOT NULL,
        to_time TEXT NOT NULL,
        destination TEXT NOT NULL,
        reason TEXT NOT NULL,
        emergency_contact TEXT,
        status TEXT DEFAULT 'Pending',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'Open',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'Success',
        paid_on TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entry_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        gate TEXT NOT NULL,
        logged_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL,
        purpose TEXT NOT NULL,
        student_id INTEGER NOT NULL,
        status TEXT DEFAULT 'Inside',
        entry_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_no TEXT UNIQUE NOT NULL,
        block TEXT NOT NULL,
        room_type TEXT NOT NULL,
        occupancy TEXT NOT NULL,
        status TEXT NOT NULL
    );
    """)

    # Seed users only when the database is empty.
    if db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        users = [
            ("Aryan Sharma", "student@smarthostel.local", "student123", "student", "23CS101", "B-205", "9876543210"),
            ("Riya Singh", "warden@smarthostel.local", "warden123", "warden", "WARDEN01", "OFFICE", "9876500001"),
            ("Admin User", "admin@smarthostel.local", "admin123", "admin", "ADMIN01", "-", "9876500002"),
            ("Gate Officer", "gate@smarthostel.local", "gate123", "gate", "GATE01", "GATE", "9876500003"),
            ("Parent User", "parent@smarthostel.local", "parent123", "parent", "PARENT01", "-", "9876500004"),
        ]
        for name, email, password, role, roll_no, room, phone in users:
            db.execute(
                """INSERT INTO users(name,email,password_hash,role,roll_no,room,phone)
                   VALUES(?,?,?,?,?,?,?)""",
                (name, email, generate_password_hash(password), role, roll_no, room, phone)
            )

        student_id = db.execute(
            "SELECT id FROM users WHERE role='student' LIMIT 1"
        ).fetchone()["id"]

        now = datetime.now()
        db.executemany(
            """INSERT INTO payments(student_id,description,amount,status,paid_on)
               VALUES(?,?,?,?,?)""",
            [
                (student_id, "Hostel Fee", 10000, "Success", "01 Sep 2026"),
                (student_id, "Mess Fee", 10000, "Success", "01 Aug 2026"),
                (student_id, "Hostel Fee", 10000, "Success", "01 Jul 2026"),
            ],
        )
        db.executemany(
            """INSERT INTO complaints(student_id,category,description,status,created_at)
               VALUES(?,?,?,?,?)""",
            [
                (student_id, "Electrical", "Fan not working", "Open", "06 Sep 2026"),
                (student_id, "Plumbing", "Water leakage", "In Progress", "02 Sep 2026"),
                (student_id, "Wi-Fi", "No internet", "Resolved", "28 Aug 2026"),
            ],
        )
        db.executemany(
            """INSERT INTO entry_logs(student_id,action,gate,logged_at)
               VALUES(?,?,?,?)""",
            [
                (student_id, "Entry", "Main Gate", "06 Sep 2026, 10:24 AM"),
                (student_id, "Exit", "Main Gate", "05 Sep 2026, 09:05 PM"),
                (student_id, "Entry", "Main Gate", "04 Sep 2026, 10:32 AM"),
            ],
        )
        db.executemany(
            """INSERT INTO rooms(room_no,block,room_type,occupancy,status)
               VALUES(?,?,?,?,?)""",
            [
                ("A-101", "A", "Triple", "3/3", "Full"),
                ("A-102", "A", "Double", "2/2", "Full"),
                ("B-205", "B", "Triple", "2/3", "Partial"),
                ("B-206", "B", "Triple", "3/3", "Full"),
                ("C-310", "C", "Double", "1/2", "Available"),
                ("C-311", "C", "Single", "1/1", "Full"),
            ],
        )
        db.commit()


def login_required(fn):
    """Small decorator that sends unauthenticated users back to the login screen."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"ok": False, "message": "Login required"}), 401
        return fn(*args, **kwargs)
    return wrapper


@app.route("/")
def home():
    """Landing page; if already logged in, the same route can show the dashboard."""
    return render_template("index.html", user=session.get("user"))


@app.route("/login", methods=["GET", "POST"])
def login():
    """
    Real login endpoint.
    The demo credentials are:
      student@smarthostel.local / student123
      warden@smarthostel.local  / warden123
      admin@smarthostel.local   / admin123
      gate@smarthostel.local    / gate123
      parent@smarthostel.local  / parent123
    """
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        user = get_db().execute(
            "SELECT * FROM users WHERE lower(email)=lower(?)", (email,)
        ).fetchone()

        if user and check_password_hash(user["password_hash"], password):
            session["user_id"] = user["id"]
            session["user"] = {
                "id": user["id"],
                "name": user["name"],
                "role": user["role"],
                "email": user["email"],
                "roll_no": user["roll_no"],
                "room": user["room"],
                "phone": user["phone"],
            }
            return redirect(url_for("dashboard"))

        return render_template("index.html", login_error="Invalid email or password.")

    return render_template("index.html", login_page=True)


@app.route("/dashboard")
@login_required
def dashboard():
    """Dashboard shell; all role-specific widgets are populated by the browser."""
    return render_template("index.html", dashboard=True, user=session.get("user"))


@app.post("/logout")
def logout():
    """Clear the session so another hostel user can log in."""
    session.clear()
    return redirect(url_for("home"))


@app.get("/api/overview")
@login_required
def overview():
    """Return live summary cards for the dashboard."""
    db = get_db()
    students = db.execute("SELECT COUNT(*) AS c FROM users WHERE role='student'").fetchone()["c"]
    inside = db.execute("""
        SELECT COUNT(*) AS c FROM entry_logs
        WHERE id IN (SELECT MAX(id) FROM entry_logs GROUP BY student_id)
        AND action='Entry'
    """).fetchone()["c"]
    pending = db.execute("SELECT COUNT(*) AS c FROM outpasses WHERE status='Pending'").fetchone()["c"]
    open_complaints = db.execute(
        "SELECT COUNT(*) AS c FROM complaints WHERE status!='Resolved'"
    ).fetchone()["c"]

    return jsonify({
        "students": students,
        "inside": inside,
        "outside": max(students - inside, 0),
        "pending_outpasses": pending,
        "open_complaints": open_complaints,
        "attendance": 92,
        "security": "24/7",
    })


@app.get("/api/student-data")
@login_required
def student_data():
    """Return the current student's data used by Student Portal screens."""
    db = get_db()
    sid = session["user_id"]

    outpasses = db.execute(
        """SELECT id,type,from_time,to_time,destination,reason,status,created_at
           FROM outpasses WHERE student_id=? ORDER BY id DESC""", (sid,)
    ).fetchall()

    complaints = db.execute(
        """SELECT id,category,description,status,created_at
           FROM complaints WHERE student_id=? ORDER BY id DESC""", (sid,)
    ).fetchall()

    payments = db.execute(
        """SELECT id,description,amount,status,paid_on
           FROM payments WHERE student_id=? ORDER BY id DESC""", (sid,)
    ).fetchall()

    logs = db.execute(
        """SELECT action,gate,logged_at FROM entry_logs
           WHERE student_id=? ORDER BY id DESC LIMIT 12""", (sid,)
    ).fetchall()

    return jsonify({
        "outpasses": [dict(x) for x in outpasses],
        "complaints": [dict(x) for x in complaints],
        "payments": [dict(x) for x in payments],
        "logs": [dict(x) for x in logs],
    })


@app.post("/api/outpass")
@login_required
def create_outpass():
    """Create an outpass request; wardens see it immediately on their dashboard."""
    data = request.get_json(force=True)
    required = ["type", "from_time", "to_time", "destination", "reason"]
    if any(not str(data.get(k, "")).strip() for k in required):
        return jsonify({"ok": False, "message": "Please fill all required fields."}), 400

    db = get_db()
    db.execute(
        """INSERT INTO outpasses
           (student_id,type,from_time,to_time,destination,reason,emergency_contact,status,created_at)
           VALUES(?,?,?,?,?,?,?,?,?)""",
        (
            session["user_id"], data["type"], data["from_time"], data["to_time"],
            data["destination"], data["reason"], data.get("emergency_contact", ""),
            "Pending", datetime.now().strftime("%d %b %Y, %I:%M %p")
        ),
    )
    db.commit()
    return jsonify({"ok": True, "message": "Outpass request submitted."})


@app.post("/api/complaint")
@login_required
def create_complaint():
    """Store a student complaint so the warden/admin can process it."""
    data = request.get_json(force=True)
    if not data.get("category") or not data.get("description"):
        return jsonify({"ok": False, "message": "Category and description are required."}), 400

    db = get_db()
    db.execute(
        """INSERT INTO complaints(student_id,category,description,status,created_at)
           VALUES(?,?,?,?,?)""",
        (
            session["user_id"], data["category"], data["description"],
            "Open", datetime.now().strftime("%d %b %Y")
        ),
    )
    db.commit()
    return jsonify({"ok": True, "message": "Complaint raised successfully."})


@app.get("/api/warden-data")
@login_required
def warden_data():
    """Return operational tables used by Warden and Gate Terminal screens."""
    db = get_db()
    students = db.execute(
        """SELECT id,name,roll_no,room,phone FROM users
           WHERE role='student' ORDER BY id"""
    ).fetchall()
    outpasses = db.execute(
        """SELECT o.id,u.name,u.roll_no,u.room,o.type,o.destination,o.reason,o.status,o.created_at
           FROM outpasses o JOIN users u ON u.id=o.student_id
           ORDER BY o.id DESC"""
    ).fetchall()
    visitors = db.execute(
        """SELECT v.id,v.name,v.mobile,v.purpose,u.name AS student,v.status,v.entry_time
           FROM visitors v JOIN users u ON u.id=v.student_id
           ORDER BY v.id DESC"""
    ).fetchall()
    rooms = db.execute("SELECT * FROM rooms ORDER BY room_no").fetchall()
    return jsonify({
        "students": [dict(x) for x in students],
        "outpasses": [dict(x) for x in outpasses],
        "visitors": [dict(x) for x in visitors],
        "rooms": [dict(x) for x in rooms],
    })


@app.post("/api/outpass/<int:outpass_id>")
@login_required
def update_outpass(outpass_id):
    """Approve/reject an outpass; this is intentionally role-checked."""
    if session["user"]["role"] not in ("warden", "admin"):
        return jsonify({"ok": False, "message": "Only wardens/admins can update requests."}), 403

    status = request.get_json(force=True).get("status")
    if status not in ("Approved", "Rejected"):
        return jsonify({"ok": False, "message": "Invalid status."}), 400

    db = get_db()
    db.execute("UPDATE outpasses SET status=? WHERE id=?", (status, outpass_id))
    db.commit()
    return jsonify({"ok": True, "message": f"Outpass {status.lower()}."})


@app.post("/api/gate")
@login_required
def gate_action():
    """Record entry/exit after a QR/manual gate verification."""
    if session["user"]["role"] not in ("gate", "warden", "admin"):
        return jsonify({"ok": False, "message": "Gate access required."}), 403

    data = request.get_json(force=True)
    roll_no = data.get("roll_no", "").strip()
    action = data.get("action", "Entry")
    student = get_db().execute(
        "SELECT id,name,roll_no,room FROM users WHERE roll_no=?", (roll_no,)
    ).fetchone()

    if not student:
        return jsonify({"ok": False, "message": "Student not found."}), 404

    get_db().execute(
        "INSERT INTO entry_logs(student_id,action,gate,logged_at) VALUES(?,?,?,?)",
        (student["id"], action, data.get("gate", "Main Gate"),
         datetime.now().strftime("%d %b %Y, %I:%M %p"))
    )
    get_db().commit()

    return jsonify({
        "ok": True,
        "message": f"{action} recorded for {student['name']}.",
        "student": dict(student)
    })


@app.post("/api/visitor")
@login_required
def add_visitor():
    """Register a visitor from the Warden panel."""
    if session["user"]["role"] not in ("warden", "admin"):
        return jsonify({"ok": False, "message": "Warden/Admin access required."}), 403

    data = request.get_json(force=True)
    student = get_db().execute(
        "SELECT id FROM users WHERE roll_no=?", (data.get("roll_no", "").strip(),)
    ).fetchone()
    if not student:
        return jsonify({"ok": False, "message": "Student roll number not found."}), 404

    get_db().execute(
        """INSERT INTO visitors(name,mobile,purpose,student_id,status,entry_time)
           VALUES(?,?,?,?,?,?)""",
        (
            data.get("name", "Visitor"), data.get("mobile", ""),
            data.get("purpose", "Visit"), student["id"], "Inside",
            datetime.now().strftime("%I:%M %p")
        ),
    )
    get_db().commit()
    return jsonify({"ok": True, "message": "Visitor added."})


with app.app_context():
    init_db()


if __name__ == "__main__":
    # 0.0.0.0 makes the app reachable from another device on the same LAN.
    # For internet hosting, use a proper WSGI server and HTTPS.
    app.run(host="0.0.0.0", port=5000, debug=True)
