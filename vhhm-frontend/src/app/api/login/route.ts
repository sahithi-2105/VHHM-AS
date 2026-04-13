import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';
import { verifyPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL();
    const body = await request.json();
    const { email, password, role } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ detail: 'Missing required fields' }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, username, role, name, gender, email, password, is_verified
      FROM users WHERE email = ${email} AND role = ${role}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ detail: 'No account found with this email and role' }, { status: 401 });
    }

    const user = rows[0];

    if (!verifyPassword(password, user.password)) {
      return NextResponse.json({ detail: 'Incorrect password' }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      gender: user.gender,
      email: user.email,
      is_verified: Boolean(user.is_verified),
    });
  } catch (e: any) {
    console.error('Login error:', e);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}
