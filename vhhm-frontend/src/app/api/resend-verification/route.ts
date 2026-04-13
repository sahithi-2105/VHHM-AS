import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';
import { sendEmail, buildVerificationEmail } from '@/lib/email';
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
      SELECT id, name, is_verified FROM users WHERE email = ${email}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ detail: 'No account found with this email' }, { status: 404 });
    }

    const user = rows[0];

    if (user.is_verified) {
      return NextResponse.json({ status: 'already_verified', message: 'Your account is already verified.' });
    }

    const newToken = crypto.randomBytes(32).toString('base64url');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await sql`
      UPDATE users SET verify_token = ${newToken}, token_expiry = ${expiry} WHERE id = ${user.id}
    `;

    const html = buildVerificationEmail(user.name, newToken);
    sendEmail(email, '✅ Verify Your VHHM-AS Account', html).catch(() => {});

    return NextResponse.json({ status: 'success', message: 'Verification email resent. Please check your inbox.' });
  } catch (e: any) {
    console.error('Resend verification error:', e);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}
