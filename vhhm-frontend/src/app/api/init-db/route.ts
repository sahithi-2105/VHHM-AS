import { NextResponse } from 'next/server';
import { initDB } from '@/lib/db';

export async function POST() {
  try {
    await initDB();
    return NextResponse.json({ status: 'success', message: 'Database tables initialized successfully.' });
  } catch (e: any) {
    console.error('Init DB error:', e);
    return NextResponse.json({ detail: e.message || 'Failed to initialize database' }, { status: 500 });
  }
}
