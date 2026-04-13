import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';
import { sendEmail, buildWelcomeEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    const sql = getSQL();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ detail: 'Missing token' }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, name, email, token_expiry, is_verified
      FROM users WHERE verify_token = ${token}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ detail: 'Invalid verification token' }, { status: 400 });
    }

    const user = rows[0];

    if (user.is_verified) {
      return NextResponse.json({ status: 'already_verified', message: 'Email already verified. You can login now.' });
    }

    if (user.token_expiry && new Date(user.token_expiry) < new Date()) {
      return NextResponse.json({ detail: 'Verification token expired. Please sign up again.' }, { status: 400 });
    }

    await sql`
      UPDATE users SET is_verified = 1, verify_token = NULL, token_expiry = NULL WHERE id = ${user.id}
    `;

    const html = buildWelcomeEmail(user.name);
    sendEmail(user.email, '🎉 Welcome to VHHM-AS - Account Activated!', html).catch(() => {});

    return NextResponse.json({ status: 'success', message: 'Email verified successfully! You can now login.' });
  } catch (e: any) {
    console.error('Verify email error:', e);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}
