from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import uvicorn
import sqlite3
import json
import os
import secrets
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="VHHM-AS AI Health Engine")

# Configure CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # More permissive for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "online", "timestamp": datetime.now().isoformat()}

# ─── Email Config (from .env) ──────────────────────────────────────────────────
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")           # your Gmail address
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")     # Gmail App Password
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# ─── Password Hashing (simple but secure using secrets + hashlib) ──────────────
import hashlib

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{hashed}"

def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hashed = stored.split(":")
        return hashlib.sha256((salt + password).encode()).hexdigest() == hashed
    except Exception:
        # Legacy plain-text fallback (for existing accounts)
        return password == stored

# ─── Database Setup ────────────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect('vhhm.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  username TEXT UNIQUE, 
                  email TEXT UNIQUE, 
                  password TEXT, 
                  role TEXT, 
                  name TEXT, 
                  age INTEGER, 
                  gender TEXT,
                  is_verified INTEGER DEFAULT 0,
                  verify_token TEXT,
                  token_expiry TEXT,
                  reset_token TEXT,
                  reset_expiry TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS health_logs 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, timestamp TEXT, 
                  hr INTEGER, bp TEXT, oxygen REAL, water INTEGER, sleep REAL, 
                  reason TEXT, diagnosis TEXT, prescription TEXT, remedies TEXT, exercises TEXT)''')
    conn.commit()
    conn.close()

init_db()

# ─── Pydantic Models ───────────────────────────────────────────────────────────
class User(BaseModel):
    username: str
    email: str
    password: str
    role: str
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str
    role: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class Medication(BaseModel):
    name: str
    dosage: str
    duration: str
    instructions: str

class HealthAnalysisRequest(BaseModel):
    user_id: int
    name: str
    age: int
    gender: str
    heart_rate: int
    body_temp: float
    oxygen_level: float
    bp: str
    water_intake: int
    sleep_hours: float
    reason_for_visit: str

# ─── Email Sender ──────────────────────────────────────────────────────────────
def send_email(to_email: str, subject: str, html_body: str):
    """Send an email via Gmail SMTP. Silently fails if SMTP not configured."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"[EMAIL SKIPPED] No SMTP configured. Would send to: {to_email}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"VHHM-AS Health Platform <{SMTP_EMAIL}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        print(f"[EMAIL SENT] ✅ To: {to_email} | Subject: {subject}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] ❌ {e}")
        return False

def build_verification_email(name: str, token: str) -> str:
    verify_url = f"{FRONTEND_URL}?verify={token}"
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#F0F7FF;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F7FF;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,98,255,0.1);">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#0062FF,#00D1FF);padding:40px;text-align:center;">
                  <h1 style="color:white;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">VHHM-AS</h1>
                  <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Virtual Human Health Monitoring System</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:48px 48px 40px;">
                  <div style="width:64px;height:64px;background:#F0F7FF;border-radius:20px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;font-size:32px;text-align:center;line-height:64px;">✉️</div>
                  <h2 style="color:#1A1C1E;font-size:22px;font-weight:700;margin:0 0 12px;">Verify Your Email Address</h2>
                  <p style="color:#5F6368;font-size:15px;line-height:1.7;margin:0 0 32px;">
                    Hi <strong style="color:#1A1C1E;">{name}</strong>, welcome to VHHM-AS! 🎉<br><br>
                    Your virtual health twin is almost ready. Click the button below to verify your email and activate your account.
                  </p>
                  <a href="{verify_url}" style="display:block;background:linear-gradient(135deg,#0062FF,#00D1FF);color:white;text-decoration:none;padding:16px 32px;border-radius:14px;font-size:16px;font-weight:700;text-align:center;margin-bottom:24px;">
                    ✅ Verify My Email
                  </a>
                  <p style="color:#9AA0A6;font-size:13px;margin:0 0 8px;">This link expires in <strong>24 hours</strong>.</p>
                  <p style="color:#9AA0A6;font-size:12px;margin:0;word-break:break-all;">Or copy this link:<br><span style="color:#0062FF;">{verify_url}</span></p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#F8FAFC;padding:24px 48px;border-top:1px solid #E2E8F0;">
                  <p style="color:#9AA0A6;font-size:12px;margin:0;text-align:center;">
                    If you didn't create an account, you can safely ignore this email.<br>
                    © 2025 VHHM-AS Platform. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

def build_reset_email(name: str, token: str) -> str:
    reset_url = f"{FRONTEND_URL}?reset={token}"
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#F0F7FF;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F7FF;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,98,255,0.1);">
              <tr>
                <td style="background:linear-gradient(135deg,#0062FF,#00D1FF);padding:40px;text-align:center;">
                  <h1 style="color:white;margin:0;font-size:28px;font-weight:800;">VHHM-AS</h1>
                  <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Password Reset Request</p>
                </td>
              </tr>
              <tr>
                <td style="padding:48px;">
                  <div style="font-size:48px;text-align:center;margin-bottom:24px;">🔐</div>
                  <h2 style="color:#1A1C1E;font-size:22px;font-weight:700;margin:0 0 12px;text-align:center;">Reset Your Password</h2>
                  <p style="color:#5F6368;font-size:15px;line-height:1.7;margin:0 0 32px;text-align:center;">
                    Hi <strong>{name}</strong>, we received a request to reset your password. Click below to create a new one.
                  </p>
                  <a href="{reset_url}" style="display:block;background:linear-gradient(135deg,#FF3B3B,#FF8C3B);color:white;text-decoration:none;padding:16px 32px;border-radius:14px;font-size:16px;font-weight:700;text-align:center;margin-bottom:24px;">
                    🔑 Reset My Password
                  </a>
                  <p style="color:#9AA0A6;font-size:13px;text-align:center;">This link expires in <strong>1 hour</strong>. If you did not request this, please ignore.</p>
                </td>
              </tr>
              <tr>
                <td style="background:#F8FAFC;padding:24px 48px;border-top:1px solid #E2E8F0;">
                  <p style="color:#9AA0A6;font-size:12px;margin:0;text-align:center;">© 2025 VHHM-AS Platform. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

def build_welcome_email(name: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#F0F7FF;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F7FF;padding:40px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,98,255,0.1);">
            <tr>
              <td style="background:linear-gradient(135deg,#00E676,#0062FF);padding:40px;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">🎉</div>
                <h1 style="color:white;margin:0;font-size:28px;font-weight:800;">Welcome to VHHM-AS!</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:48px;text-align:center;">
                <h2 style="color:#1A1C1E;font-size:22px;font-weight:700;margin:0 0 16px;">Your Health Twin is Activated 🚀</h2>
                <p style="color:#5F6368;font-size:15px;line-height:1.7;margin:0 0 32px;">
                  Congratulations <strong>{name}</strong>! Your virtual health monitoring profile is now active.<br><br>
                  You can now track your vitals, consult Dr. AI, and monitor your health trends in real-time.
                </p>
                <a href="{FRONTEND_URL}" style="display:inline-block;background:linear-gradient(135deg,#0062FF,#00D1FF);color:white;text-decoration:none;padding:16px 40px;border-radius:14px;font-size:16px;font-weight:700;">
                  🩺 Launch My Health Portal
                </a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """

# ─── Auth Endpoints ─────────────────────────────────────────────────────────────
@app.post("/signup")
async def signup(user: User, background_tasks: BackgroundTasks):
    conn = sqlite3.connect('vhhm.db')
    c = conn.cursor()
    try:
        hashed_pw = hash_password(user.password)
        
        c.execute("""INSERT INTO users 
                     (username, email, password, role, name, age, gender, is_verified, verify_token, token_expiry) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, NULL)""",
                  (user.username, user.email, hashed_pw, user.role, 
                   user.name, user.age, user.gender))
        conn.commit()
        
        return {
            "status": "success", 
            "message": "Account created successfully!",
            "email_sent": False
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail="Username or Email already exists")
    finally:
        conn.close()


@app.get("/verify-email")
async def verify_email(token: str, background_tasks: BackgroundTasks):
    conn = sqlite3.connect('vhhm.db')
    c = conn.cursor()
    c.execute("SELECT id, name, email, token_expiry, is_verified FROM users WHERE verify_token=?", (token,))
    user = c.fetchone()
    
    if not user:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid verification token")
    
    user_id, name, email, expiry, is_verified = user
    
    if is_verified:
        conn.close()
        return {"status": "already_verified", "message": "Email already verified. You can login now."}
    
    if expiry and datetime.fromisoformat(expiry) < datetime.utcnow():
        conn.close()
        raise HTTPException(status_code=400, detail="Verification token expired. Please sign up again.")
    
    c.execute("UPDATE users SET is_verified=1, verify_token=NULL, token_expiry=NULL WHERE id=?", (user_id,))
    conn.commit()
    conn.close()
    
    # Send welcome email
    html = build_welcome_email(name)
    background_tasks.add_task(send_email, email, "🎉 Welcome to VHHM-AS - Account Activated!", html)
    
    return {"status": "success", "message": "Email verified successfully! You can now login."}


@app.post("/login")
async def login(req: LoginRequest):
    conn = sqlite3.connect('vhhm.db')
    c = conn.cursor()
    c.execute("""SELECT id, username, role, name, gender, email, password, is_verified 
                 FROM users WHERE email=? AND role=?""",
              (req.email, req.role))
    user = c.fetchone()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=401, detail="No account found with this email and role")
    
    user_id, username, role, name, gender, email, stored_pw, is_verified = user
    
    if not verify_password(req.password, stored_pw):
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    # We bypass email verification requirement to allow immediate login
    # is_verified is now ignored for login.
    
    return {
        "id": user_id, 
        "username": username, 
        "role": role, 
        "name": name, 
        "gender": gender, 
        "email": email,
        "is_verified": bool(is_verified)
    }


@app.post("/resend-verification")
async def resend_verification(data: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    conn = sqlite3.connect('vhhm.db')
    c = conn.cursor()
    c.execute("SELECT id, name, is_verified FROM users WHERE email=?", (data.email,))
    user = c.fetchone()
    
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="No account found with this email")
    
    user_id, name, is_verified = user
    if is_verified:
        conn.close()
        return {"status": "already_verified", "message": "Your account is already verified."}
    
    new_token = secrets.token_urlsafe(32)
    expiry = (datetime.utcnow() + timedelta(hours=24)).isoformat()
    c.execute("UPDATE users SET verify_token=?, token_expiry=? WHERE id=?", (new_token, expiry, user_id))
    conn.commit()
    conn.close()
    
    html = build_verification_email(name, new_token)
    background_tasks.add_task(send_email, data.email, "✅ Verify Your VHHM-AS Account", html)
    
    return {"status": "success", "message": "Verification email resent. Please check your inbox."}


@app.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    conn = sqlite3.connect('vhhm.db')
    c = conn.cursor()
    c.execute("SELECT id, name FROM users WHERE email=?", (data.email,))
    user = c.fetchone()
    conn.close()
    
    # Always return success for security (don't reveal if email exists)
    if not user:
        return {"status": "success", "message": "If that email exists, a reset link has been sent."}
    
    user_id, name = user
    reset_token = secrets.token_urlsafe(32)
    expiry = (datetime.utcnow() + timedelta(hours=1)).isoformat()
    
    conn = sqlite3.connect('vhhm.db')
    c = conn.cursor()
    c.execute("UPDATE users SET reset_token=?, reset_expiry=? WHERE id=?", (reset_token, expiry, user_id))
    conn.commit()
    conn.close()
    
    html = build_reset_email(name, reset_token)
    background_tasks.add_task(send_email, data.email, "🔐 VHHM-AS Password Reset", html)
    
    return {"status": "success", "message": "If that email exists, a reset link has been sent."}


@app.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    conn = sqlite3.connect('vhhm.db')
    c = conn.cursor()
    c.execute("SELECT id, reset_expiry FROM users WHERE reset_token=?", (data.token,))
    user = c.fetchone()
    
    if not user:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    user_id, expiry = user
    if expiry and datetime.fromisoformat(expiry) < datetime.utcnow():
        conn.close()
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")
    
    hashed_pw = hash_password(data.new_password)
    c.execute("UPDATE users SET password=?, reset_token=NULL, reset_expiry=NULL WHERE id=?", (hashed_pw, user_id))
    conn.commit()
    conn.close()
    
    return {"status": "success", "message": "Password reset successfully. You can now login."}


# ─── Admin & Health Endpoints ──────────────────────────────────────────────────
@app.get("/admin/patients")
async def get_all_patients():
    conn = sqlite3.connect('vhhm.db')
    c = conn.cursor()
    c.execute('''SELECT u.id, u.name, u.age, u.gender, MAX(h.timestamp), h.diagnosis 
                 FROM users u LEFT JOIN health_logs h ON u.id = h.user_id 
                 WHERE u.role = 'patient' GROUP BY u.id''')
    patients = c.fetchall()
    conn.close()
    return [{"id": p[0], "name": p[1], "age": p[2], "gender": p[3], "last_visit": p[4], "status": p[5]} for p in patients]


@app.get("/patient/history/{user_id}")
async def get_patient_history(user_id: int):
    conn = sqlite3.connect('vhhm.db')
    c = conn.cursor()
    c.execute('''SELECT timestamp, hr, bp, oxygen, water, sleep, reason, diagnosis, prescription, remedies, exercises 
                 FROM health_logs WHERE user_id=? ORDER BY timestamp DESC''', (user_id,))
    logs = c.fetchall()
    conn.close()
    
    return [
        {
            "timestamp": l[0],
            "hr": l[1],
            "bp": l[2],
            "oxygen": l[3],
            "water": l[4],
            "sleep": l[5],
            "reason": l[6],
            "diagnosis": l[7],
            "prescription": json.loads(l[8]) if l[8] else [],
            "remedies": json.loads(l[9]) if l[9] else [],
            "exercises": json.loads(l[10]) if l[10] else []
        } for l in logs
    ]


@app.post("/analyze-full")
async def analyze_full(req: HealthAnalysisRequest):
    score = 100
    meds = []
    remedies = []
    exercises = []
    
    reason = req.reason_for_visit.lower()
    
    # ─── FEVER & PAIN ───
    if any(x in reason for x in ["fever", "temp", "chills"]) or req.body_temp > 100:
        meds.append({"name": "Paracetamol (Acetaminophen)", "dosage": "500mg", "duration": "3 Days", "instructions": "One tablet every 6 hours after meals"})
        remedies.append("Lukewarm water compresses on forehead")
        score -= 20
        
    if any(x in reason for x in ["headache", "body ache", "pain"]):
        meds.append({"name": "Ibuprofen (Advil/Motrin)", "dosage": "400mg", "duration": "2 Days", "instructions": "One tablet every 8 hours as needed for pain"})
        remedies.append("Rest in a quiet, dimly lit environment")
        score -= 10

    # ─── COLD & COUGH ───
    if any(x in reason for x in ["cold", "sneezing", "nasal", "congestion"]):
        meds.append({"name": "Cetirizine (Zyrtec)", "dosage": "10mg", "duration": "5 Days", "instructions": "One tablet at bedtime"})
        meds.append({"name": "Oxymetazoline Nasal Spray", "dosage": "0.05%", "duration": "3 Days", "instructions": "1-2 sprays in each nostril twice daily"})
        remedies.append("Steam inhalation twice daily")
        score -= 15

    if "cough" in reason:
        if "dry" in reason:
            meds.append({"name": "Dextromethorphan (Benadryl Dry)", "dosage": "10ml", "duration": "3 Days", "instructions": "Twice daily after meals"})
        else:
            meds.append({"name": "Guaifenesin (Mucinex)", "dosage": "600mg", "duration": "5 Days", "instructions": "One tablet every 12 hours with a full glass of water"})
        remedies.append("Warm salt water gargles")
        score -= 10

    # ─── CANCER (Critical Handling) ───
    if any(x in reason for x in ["cancer", "tumor", "malignant", "biopsy"]):
        meds.append({"name": "URGENT ONCOLOGICAL CONSULTATION", "dosage": "Specialized Protocol", "duration": "Immediate", "instructions": "CRITICAL: Urgent referral to an Oncologist for staging and treatment plan (Chemo/Radiation/Surgery)"})
        meds.append({"name": "Ondansetron (Zofran)", "dosage": "4mg", "duration": "As Needed", "instructions": "For nausea management during consultation phase"})
        remedies.append("Schedule PET scan and Biopsy immediately")
        score = 30 # Force critical score
    
    # ─── DIABETES & HYPERTENSION ───
    if "diabetes" in reason or "sugar" in reason:
        meds.append({"name": "Metformin (Glucophage)", "dosage": "500mg", "duration": "Ongoing", "instructions": "Once daily with evening meal"})
        remedies.append("Strict low-glycemic index diet")
        exercises.append("Daily 30-min brisk walk")
        score -= 15

    if "hypertension" in reason or "blood pressure" in reason or "bp" in reason:
        meds.append({"name": "Amlodipine (Norvasc)", "dosage": "5mg", "duration": "Ongoing", "instructions": "Once daily in the morning"})
        remedies.append("Low-sodium diet (DASH diet)")
        score -= 15

    # ─── GENERAL VITALS CHECK ───
    if req.oxygen_level < 94:
        remedies.append("Increase air circulation and perform deep breathing")
        score -= 30

    if req.water_intake < 2000:
        remedies.append("Oral Rehydration Salts (ORS) - 1 sachet in 1L water")
        exercises.append("Light stretching to improve circulation")
        score -= 5

    diagnosis = "Stable" if score > 85 else "Monitoring Required" if score > 65 else "Medical Intervention Required"
    
    conn = sqlite3.connect('vhhm.db')
    c = conn.cursor()
    c.execute('''INSERT INTO health_logs (user_id, timestamp, hr, bp, oxygen, water, sleep, reason, diagnosis, prescription, remedies, exercises) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
              (req.user_id, datetime.now().strftime("%Y-%m-%d %H:%M"), req.heart_rate, req.bp, req.oxygen_level,
               req.water_intake, req.sleep_hours, req.reason_for_visit, diagnosis,
               json.dumps(meds), json.dumps(remedies), json.dumps(exercises)))
    conn.commit()
    conn.close()

    return {
        "diagnosis": diagnosis,
        "score": score,
        "prescription": meds,
        "remedies": remedies,
        "exercises": exercises,
        "summary": f"Based on your symptoms ({req.reason_for_visit}), we've generated a specific recovery plan."
    }

@app.post("/dev/init")
async def init_dev_data():
    """Helper to create a test patient with history for debugging."""
    conn = sqlite3.connect('vhhm.db')
    c = conn.cursor()
    try:
        # Create a test patient if not exists
        pw = hash_password("password123")
        c.execute("INSERT OR IGNORE INTO users (username, email, password, role, name, age, gender, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                  ("test_patient", "test@example.com", pw, "patient", "Test Patient", 30, "Male", 1))
        
        c.execute("SELECT id FROM users WHERE email='test@example.com'")
        user_id = c.fetchone()[0]
        
        # Add a sample log
        c.execute("INSERT INTO health_logs (user_id, timestamp, hr, bp, oxygen, water, sleep, reason, diagnosis, prescription, remedies, exercises) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                  (user_id, "2024-03-22 10:00", 72, "120/80", 98.0, 1500, 8.0, "Routine checkup", "Stable", "[]", "[]", "[]"))
        
        conn.commit()
        return {"status": "initialized", "user_id": user_id, "email": "test@example.com", "password": "password123"}
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
