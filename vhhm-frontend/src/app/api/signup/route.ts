import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';
import { hashPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL();
    const body = await request.json();
    const { username, email, password, role, name, age, gender } = body;

    if (!username || !email || !password || !role) {
      return NextResponse.json({ detail: 'Missing required fields' }, { status: 400 });
    }

    const hashedPw = hashPassword(password);

    try {
      await sql`
        INSERT INTO users (username, email, password, role, name, age, gender, is_verified, verify_token, token_expiry)
        VALUES (${username}, ${email}, ${hashedPw}, ${role}, ${name || null}, ${age || null}, ${gender || null}, 1, NULL, NULL)
      `;
    } catch (e: any) {
      if (e.message?.includes('unique') || e.message?.includes('duplicate')) {
        return NextResponse.json({ detail: 'Username or Email already exists' }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json({
      status: 'success',
      message: 'Account created successfully!',
      email_sent: false,
    });
  } catch (e: any) {
    console.error('Signup error:', e);
    return NextResponse.json({ detail: 'Username or Email already exists' }, { status: 400 });
  }
}
