import { NextResponse } from 'next/server';

export async function GET() {
  const envKeys = Object.keys(process.env);
  const dbKeys = envKeys.filter(k => k.includes('DB') || k.includes('POSTGRES') || k.includes('URL'));
  
  return NextResponse.json({
    keys: dbKeys,
    hasDbUrl: !!process.env.DATABASE_URL,
    hasPostgresUrl: !!process.env.POSTGRES_URL
  });
}
