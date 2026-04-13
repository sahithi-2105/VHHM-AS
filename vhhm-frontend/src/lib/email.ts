import nodemailer from 'nodemailer';

const SMTP_EMAIL = process.env.SMTP_EMAIL || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000';

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    console.log(`[EMAIL SKIPPED] No SMTP configured. Would send to: ${to}`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: SMTP_EMAIL, pass: SMTP_PASSWORD },
    });

    await transporter.sendMail({
      from: `VHHM-AS Health Platform <${SMTP_EMAIL}>`,
      to,
      subject,
      html,
    });

    console.log(`[EMAIL SENT] ✅ To: ${to} | Subject: ${subject}`);
    return true;
  } catch (e) {
    console.error(`[EMAIL ERROR] ❌`, e);
    return false;
  }
}

export function getFrontendUrl(): string {
  if (process.env.NEXT_PUBLIC_FRONTEND_URL) return process.env.NEXT_PUBLIC_FRONTEND_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function buildVerificationEmail(name: string, token: string): string {
  const verifyUrl = `${getFrontendUrl()}?verify=${token}`;
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#F0F7FF;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F7FF;padding:40px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,98,255,0.1);">
            <tr><td style="background:linear-gradient(135deg,#0062FF,#00D1FF);padding:40px;text-align:center;">
              <h1 style="color:white;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">VHHM-AS</h1>
              <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Virtual Human Health Monitoring System</p>
            </td></tr>
            <tr><td style="padding:48px 48px 40px;">
              <div style="width:64px;height:64px;background:#F0F7FF;border-radius:20px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;font-size:32px;text-align:center;line-height:64px;">✉️</div>
              <h2 style="color:#1A1C1E;font-size:22px;font-weight:700;margin:0 0 12px;">Verify Your Email Address</h2>
              <p style="color:#5F6368;font-size:15px;line-height:1.7;margin:0 0 32px;">
                Hi <strong style="color:#1A1C1E;">${name}</strong>, welcome to VHHM-AS! 🎉<br><br>
                Your virtual health twin is almost ready. Click the button below to verify your email and activate your account.
              </p>
              <a href="${verifyUrl}" style="display:block;background:linear-gradient(135deg,#0062FF,#00D1FF);color:white;text-decoration:none;padding:16px 32px;border-radius:14px;font-size:16px;font-weight:700;text-align:center;margin-bottom:24px;">
                ✅ Verify My Email
              </a>
              <p style="color:#9AA0A6;font-size:13px;margin:0 0 8px;">This link expires in <strong>24 hours</strong>.</p>
              <p style="color:#9AA0A6;font-size:12px;margin:0;word-break:break-all;">Or copy this link:<br><span style="color:#0062FF;">${verifyUrl}</span></p>
            </td></tr>
            <tr><td style="background:#F8FAFC;padding:24px 48px;border-top:1px solid #E2E8F0;">
              <p style="color:#9AA0A6;font-size:12px;margin:0;text-align:center;">
                If you didn't create an account, you can safely ignore this email.<br>
                © 2025 VHHM-AS Platform. All rights reserved.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

export function buildResetEmail(name: string, token: string): string {
  const resetUrl = `${getFrontendUrl()}?reset=${token}`;
  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#F0F7FF;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F7FF;padding:40px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,98,255,0.1);">
            <tr><td style="background:linear-gradient(135deg,#0062FF,#00D1FF);padding:40px;text-align:center;">
              <h1 style="color:white;margin:0;font-size:28px;font-weight:800;">VHHM-AS</h1>
              <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Password Reset Request</p>
            </td></tr>
            <tr><td style="padding:48px;">
              <div style="font-size:48px;text-align:center;margin-bottom:24px;">🔐</div>
              <h2 style="color:#1A1C1E;font-size:22px;font-weight:700;margin:0 0 12px;text-align:center;">Reset Your Password</h2>
              <p style="color:#5F6368;font-size:15px;line-height:1.7;margin:0 0 32px;text-align:center;">
                Hi <strong>${name}</strong>, we received a request to reset your password. Click below to create a new one.
              </p>
              <a href="${resetUrl}" style="display:block;background:linear-gradient(135deg,#FF3B3B,#FF8C3B);color:white;text-decoration:none;padding:16px 32px;border-radius:14px;font-size:16px;font-weight:700;text-align:center;margin-bottom:24px;">
                🔑 Reset My Password
              </a>
              <p style="color:#9AA0A6;font-size:13px;text-align:center;">This link expires in <strong>1 hour</strong>. If you did not request this, please ignore.</p>
            </td></tr>
            <tr><td style="background:#F8FAFC;padding:24px 48px;border-top:1px solid #E2E8F0;">
              <p style="color:#9AA0A6;font-size:12px;margin:0;text-align:center;">© 2025 VHHM-AS Platform. All rights reserved.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

export function buildWelcomeEmail(name: string): string {
  const frontendUrl = getFrontendUrl();
  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#F0F7FF;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F7FF;padding:40px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,98,255,0.1);">
            <tr><td style="background:linear-gradient(135deg,#00E676,#0062FF);padding:40px;text-align:center;">
              <div style="font-size:48px;margin-bottom:16px;">🎉</div>
              <h1 style="color:white;margin:0;font-size:28px;font-weight:800;">Welcome to VHHM-AS!</h1>
            </td></tr>
            <tr><td style="padding:48px;text-align:center;">
              <h2 style="color:#1A1C1E;font-size:22px;font-weight:700;margin:0 0 16px;">Your Health Twin is Activated 🚀</h2>
              <p style="color:#5F6368;font-size:15px;line-height:1.7;margin:0 0 32px;">
                Congratulations <strong>${name}</strong>! Your virtual health monitoring profile is now active.<br><br>
                You can now track your vitals, consult Dr. AI, and monitor your health trends in real-time.
              </p>
              <a href="${frontendUrl}" style="display:inline-block;background:linear-gradient(135deg,#0062FF,#00D1FF);color:white;text-decoration:none;padding:16px 40px;border-radius:14px;font-size:16px;font-weight:700;">
                🩺 Launch My Health Portal
              </a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}
