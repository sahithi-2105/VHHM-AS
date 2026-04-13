import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';
import { hashPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL();
    const body = await request.json();
    const { token, new_password } = body;

    if (!token || !new_password) {
      return NextResponse.json({ detail: 'Missing token or password' }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, reset_expiry FROM users WHERE reset_token = ${token}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ detail: 'Invalid or expired reset token' }, { status: 400 });
    }

    const user = rows[0];

    if (user.reset_expiry && new Date(user.reset_expiry) < new Date()) {
      return NextResponse.json({ detail: 'Reset token has expired. Please request a new one.' }, { status: 400 });
    }

    const hashedPw = hashPassword(new_password);

    await sql`
      UPDATE users SET password = ${hashedPw}, reset_token = NULL, reset_expiry = NULL WHERE id = ${user.id}
    `;

    return NextResponse.json({ status: 'success', message: 'Password reset successfully. You can now login.' });
  } catch (e: any) {
    console.error('Reset password error:', e);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}
