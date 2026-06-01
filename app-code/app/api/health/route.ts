import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Health check endpoint cho Docker / load balancer / monitoring.
 * - 200 OK kèm DB ping → app + DB cùng OK
 * - 503 nếu DB không truy cập được
 * KHÔNG yêu cầu auth (cần để health probe gọi được từ ngoài).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', uptime: Math.round(process.uptime()), ts: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { status: 'error', error: e?.message ?? 'db_unreachable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
