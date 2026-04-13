import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const sql = getSQL();
    const { userId } = await params;
    const id = parseInt(userId, 10);

    if (isNaN(id)) {
      return NextResponse.json({ detail: 'Invalid user ID' }, { status: 400 });
    }

    const rows = await sql`
      SELECT timestamp, hr, bp, oxygen, water, sleep, reason, diagnosis, prescription, remedies, exercises
      FROM health_logs WHERE user_id = ${id} ORDER BY timestamp DESC
    `;

    const logs = rows.map((l: any) => ({
      timestamp: l.timestamp,
      hr: l.hr,
      bp: l.bp,
      oxygen: l.oxygen,
      water: l.water,
      sleep: l.sleep,
      reason: l.reason,
      diagnosis: l.diagnosis,
      prescription: l.prescription ? JSON.parse(l.prescription) : [],
      remedies: l.remedies ? JSON.parse(l.remedies) : [],
      exercises: l.exercises ? JSON.parse(l.exercises) : [],
    }));

    return NextResponse.json(logs);
  } catch (e: any) {
    console.error('Get patient history error:', e);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}
