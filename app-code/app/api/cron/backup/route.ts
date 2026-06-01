import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { pushBackupToSheet } from '@/lib/backup/sheets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Endpoint cho OS cron / external scheduler.
 *
 * Yêu cầu env `CRON_SECRET` được set. Cron gọi:
 *   curl -fsS "https://your-domain.com/api/cron/backup?token=$CRON_SECRET"
 *
 * Quy tắc: nếu schedule = "manual" → skip (return 200 noop).
 *          nếu lastRun < now - interval → chạy backup.
 *          nếu chạy quá sát lần trước → skip (idempotent).
 *
 * Hành vi:
 *   - 401 Unauthorized nếu token sai
 *   - 503 nếu chưa cấu hình backup
 *   - 200 + JSON {status, action} cho mọi trường hợp khác
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      { status: 'error', error: 'CRON_SECRET env chưa cấu hình (phải >=16 ký tự).' },
      { status: 503 }
    );
  }
  const token = req.nextUrl.searchParams.get('token');
  if (token !== expected) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  // Read backup config
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['backup_sa_json', 'backup_sheet_id', 'backup_schedule', 'backup_last_run'] } }
  });
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const saJson = m.get('backup_sa_json') ?? '';
  const sheetId = m.get('backup_sheet_id') ?? '';
  const schedule = m.get('backup_schedule') ?? 'manual';
  const lastRun = m.get('backup_last_run') ?? '';

  if (!saJson || !sheetId) {
    return NextResponse.json({ status: 'skipped', reason: 'not_configured' });
  }
  if (schedule === 'manual') {
    return NextResponse.json({ status: 'skipped', reason: 'schedule_manual' });
  }

  // Interval và buffer "đến hạn" theo từng schedule
  let intervalMs: number;
  let dueBufferMs: number;
  switch (schedule) {
    case 'hourly':
      intervalMs = 60 * 60_000;          // 1 giờ
      dueBufferMs = 5 * 60_000;          // buffer 5 phút (cron mỗi 15min → coi như đến hạn nếu ≥55 phút trước)
      break;
    case 'weekly':
      intervalMs = 7 * 24 * 60 * 60_000; // 7 ngày
      dueBufferMs = 6 * 60 * 60_000;     // buffer 6 giờ
      break;
    case 'daily':
    default:
      intervalMs = 24 * 60 * 60_000;     // 24 giờ
      dueBufferMs = 60 * 60_000;         // buffer 1 giờ
      break;
  }

  if (lastRun) {
    const last = new Date(lastRun).getTime();
    const elapsed = Date.now() - last;
    if (elapsed + dueBufferMs < intervalMs) {
      return NextResponse.json({
        status: 'skipped',
        reason: 'too_soon',
        schedule,
        last_run: lastRun,
        next_due_in_minutes: Math.round((intervalMs - elapsed) / 60_000)
      });
    }
  }

  // Run backup
  const result = await pushBackupToSheet(saJson, sheetId);
  const ok = 'ok' in result && result.ok;
  const status = ok ? 'OK' : `ERROR: ${(result as any).error}`;
  const details = ok
    ? `Took ${(result as any).tookMs}ms · ${Object.entries((result as any).rowCounts).map(([k, v]) => `${k}:${v}`).join(' ')}`
    : '';
  const now = new Date().toISOString();

  await prisma.$transaction([
    prisma.setting.upsert({ where: { key: 'backup_last_run' }, update: { value: now }, create: { key: 'backup_last_run', value: now } }),
    prisma.setting.upsert({ where: { key: 'backup_last_status' }, update: { value: status }, create: { key: 'backup_last_status', value: status } }),
    prisma.setting.upsert({ where: { key: 'backup_last_details' }, update: { value: details }, create: { key: 'backup_last_details', value: details } }),
    prisma.auditLog.create({
      data: {
        userId: null,
        action: 'run',
        entityType: 'Backup',
        entityId: 'cron',
        after: ok ? JSON.stringify({ status: 'OK', tookMs: (result as any).tookMs, rowCounts: (result as any).rowCounts }) : JSON.stringify({ status: 'ERROR', error: (result as any).error })
      }
    })
  ]);

  return NextResponse.json({
    status: ok ? 'ok' : 'error',
    action: 'ran',
    last_run: now,
    last_status: status,
    ...(ok ? { took_ms: (result as any).tookMs, row_counts: (result as any).rowCounts } : { error: (result as any).error })
  }, { status: ok ? 200 : 500 });
}
