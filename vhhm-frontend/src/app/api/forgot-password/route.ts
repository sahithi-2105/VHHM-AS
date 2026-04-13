import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';
import { sendEmail, buildResetEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL();
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ detail: 'Missing email' }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, name FROM users WHERE email = ${email}
    `;

    // Always return success for security (don't reveal if email exists)
    if (rows.length === 0) {
      return NextResponse.json({ status: 'success', message: 'If that email exists, a reset link has been sent.' });
    }

    const user = rows[0];
    const resetToken = crypto.randomBytes(32).toString('base64url');
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await sql`
      UPDATE users SET reset_token = ${resetToken}, reset_expiry = ${expiry} WHERE id = ${user.id}
    `;

    const html = buildResetEmail(user.name, resetToken);
    sendEmail(email, '🔐 VHHM-AS Password Reset', html).catch(() => {});

    return NextResponse.json({ status: 'success', message: 'If that email exists, a reset link has been sent.' });
  } catch (e: any) {
    console.error('Forgot password error:', e);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}
