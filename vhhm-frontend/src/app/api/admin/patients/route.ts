import { NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';

export async function GET() {
  try {
    const sql = getSQL();

    const rows = await sql`
      SELECT u.id, u.name, u.age, u.gender, MAX(h.timestamp) as last_visit, 
             (SELECT diagnosis FROM health_logs WHERE user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status
      FROM users u 
      LEFT JOIN health_logs h ON u.id = h.user_id
      WHERE u.role = 'patient' 
      GROUP BY u.id, u.name, u.age, u.gender
    `;

    const patients = rows.map((p: any) => ({
      id: p.id,
      name: p.name,
      age: p.age,
      gender: p.gender,
      last_visit: p.last_visit,
      status: p.status,
    }));

    return NextResponse.json(patients);
  } catch (e: any) {
    console.error('Get patients error:', e);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}
