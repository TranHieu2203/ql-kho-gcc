'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/lucia';
import { audit } from '@/lib/security/audit';
import { testBackupConnection, pushBackupToSheet } from '@/lib/backup/sheets';

const KEY_SA = 'backup_sa_json';
const KEY_SHEET_ID = 'backup_sheet_id';
const KEY_SCHEDULE = 'backup_schedule';      // 'manual' | 'daily' | 'weekly'
const KEY_LAST_RUN = 'backup_last_run';
const KEY_LAST_STATUS = 'backup_last_status'; // OK | ERROR: ...
const KEY_LAST_DETAILS = 'backup_last_details';

const configSchema = z.object({
  // SA JSON optional khi update: giữ giá trị cũ nếu không paste
  saJson: z.string().max(8192).optional().default(''),
  spreadsheetId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, 'Spreadsheet ID chỉ chứa A-Z a-z 0-9 _ -'),
  schedule: z.enum(['manual', 'hourly', 'daily', 'weekly'])
});

export async function saveBackupConfig(fd: FormData) {
  const me = await requireAdmin();
  const parsed = configSchema.safeParse({
    saJson: String(fd.get('saJson') ?? '').trim(),
    spreadsheetId: String(fd.get('spreadsheetId') ?? '').trim(),
    schedule: fd.get('schedule')
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ' };

  const existing = await prisma.setting.findUnique({ where: { key: KEY_SA } });
  const newSa = parsed.data.saJson;
  const finalSa = newSa.length >= 20 ? newSa : existing?.value ?? '';

  if (!finalSa) {
    return { error: 'Chưa có Service Account JSON. Vui lòng paste nội dung file .json.' };
  }

  // Validate SA JSON shape (chỉ khi user paste mới)
  if (newSa.length >= 20) {
    try {
      const j = JSON.parse(newSa);
      if (!j.client_email || !j.private_key) return { error: 'Service account JSON thiếu client_email hoặc private_key.' };
      if (!j.type || j.type !== 'service_account') return { error: 'JSON phải là loại "service_account".' };
    } catch {
      return { error: 'Không parse được JSON. Kiểm tra lại nội dung.' };
    }
  }

  await prisma.$transaction([
    prisma.setting.upsert({ where: { key: KEY_SA }, update: { value: finalSa }, create: { key: KEY_SA, value: finalSa } }),
    prisma.setting.upsert({ where: { key: KEY_SHEET_ID }, update: { value: parsed.data.spreadsheetId }, create: { key: KEY_SHEET_ID, value: parsed.data.spreadsheetId } }),
    prisma.setting.upsert({ where: { key: KEY_SCHEDULE }, update: { value: parsed.data.schedule }, create: { key: KEY_SCHEDULE, value: parsed.data.schedule } })
  ]);

  await audit({
    userId: me.id,
    action: 'update',
    entityType: 'BackupConfig',
    entityId: 'system',
    after: { spreadsheetId: parsed.data.spreadsheetId, schedule: parsed.data.schedule, saConfigured: true }
  });

  revalidatePath('/quan-tri/backup');
  return { ok: true };
}

export async function testConnection() {
  const me = await requireAdmin();
  const cfg = await getBackupConfig();
  if (!cfg.saJson || !cfg.spreadsheetId) return { error: 'Chưa cấu hình. Nhập Service Account JSON và Spreadsheet ID rồi lưu trước.' };
  const r = await testBackupConnection(cfg.saJson, cfg.spreadsheetId);
  await audit({ userId: me.id, action: 'test', entityType: 'BackupConfig', entityId: 'system', after: r });
  if ('error' in r && (r as any).error) return { error: (r as any).error };
  if ('ok' in r && r.ok) return { ok: true, title: r.title };
  return { error: 'Không xác định được kết quả' };
}

export async function runBackupNow() {
  const me = await requireAdmin();
  const cfg = await getBackupConfig();
  if (!cfg.saJson || !cfg.spreadsheetId) return { error: 'Chưa cấu hình.' };

  const result = await pushBackupToSheet(cfg.saJson, cfg.spreadsheetId);
  const status = 'ok' in result && result.ok ? 'OK' : `ERROR: ${(result as any).error}`;
  const details = 'ok' in result && result.ok
    ? `Took ${result.tookMs}ms · ${Object.entries(result.rowCounts).map(([k, v]) => `${k}:${v}`).join(' ')}`
    : '';

  await prisma.$transaction([
    prisma.setting.upsert({ where: { key: KEY_LAST_RUN }, update: { value: new Date().toISOString() }, create: { key: KEY_LAST_RUN, value: new Date().toISOString() } }),
    prisma.setting.upsert({ where: { key: KEY_LAST_STATUS }, update: { value: status }, create: { key: KEY_LAST_STATUS, value: status } }),
    prisma.setting.upsert({ where: { key: KEY_LAST_DETAILS }, update: { value: details }, create: { key: KEY_LAST_DETAILS, value: details } })
  ]);

  await audit({
    userId: me.id,
    action: 'run',
    entityType: 'Backup',
    entityId: 'manual',
    after: 'ok' in result && result.ok ? { status: 'OK', rowCounts: result.rowCounts, tookMs: result.tookMs } : { status: 'ERROR', error: (result as any).error }
  });

  revalidatePath('/quan-tri/backup');
  if ('ok' in result && result.ok) return { ok: true, rowCounts: result.rowCounts, tookMs: result.tookMs };
  return { error: (result as any).error };
}

export async function clearBackupConfig() {
  const me = await requireAdmin();
  await prisma.setting.deleteMany({
    where: { key: { in: [KEY_SA, KEY_SHEET_ID, KEY_SCHEDULE, KEY_LAST_RUN, KEY_LAST_STATUS, KEY_LAST_DETAILS] } }
  });
  await audit({ userId: me.id, action: 'clear', entityType: 'BackupConfig', entityId: 'system' });
  revalidatePath('/quan-tri/backup');
  return { ok: true };
}

export type BackupHistoryEntry = {
  id: string;
  at: string;
  source: 'manual' | 'cron' | 'config' | 'test' | 'clear' | 'other';
  status: 'OK' | 'ERROR' | 'INFO';
  actor: string | null;
  ipAddress: string | null;
  details: string;
};

/**
 * Đọc lịch sử backup từ audit_log (entityType=Backup hoặc BackupConfig).
 * Trả về tối đa N entries gần nhất theo thời gian giảm dần.
 */
export async function getBackupHistory(limit = 50): Promise<BackupHistoryEntry[]> {
  await requireAdmin();
  const rows = await prisma.auditLog.findMany({
    where: { entityType: { in: ['Backup', 'BackupConfig'] } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(1, limit), 200),
    include: { user: { select: { username: true, fullName: true } } }
  });

  return rows.map((r) => {
    const isConfig = r.entityType === 'BackupConfig';
    const source: BackupHistoryEntry['source'] =
      isConfig
        ? (r.action === 'update' ? 'config' : r.action === 'test' ? 'test' : r.action === 'clear' ? 'clear' : 'other')
        : (r.entityId === 'cron' ? 'cron' : r.entityId === 'manual' ? 'manual' : 'other');

    let status: BackupHistoryEntry['status'] = 'INFO';
    let detailsObj: any = null;
    try { detailsObj = r.after ? JSON.parse(r.after) : null; } catch {}

    if (detailsObj) {
      if (typeof detailsObj.status === 'string') {
        if (detailsObj.status.startsWith('OK') || detailsObj.status === 'OK') status = 'OK';
        else if (detailsObj.status.startsWith('ERROR')) status = 'ERROR';
      } else if (typeof detailsObj.ok === 'boolean') {
        status = detailsObj.ok ? 'OK' : 'ERROR';
      }
    } else if (isConfig && r.action === 'update') {
      status = 'INFO';
    }

    let details = '';
    if (detailsObj) {
      if (detailsObj.status === 'OK' || detailsObj.ok === true) {
        const rc = detailsObj.rowCounts ?? {};
        const took = detailsObj.tookMs ?? detailsObj.took_ms;
        details = `${took ? `${took}ms · ` : ''}` + Object.entries(rc).map(([k, v]) => `${k}=${v}`).join(' ');
      } else if (detailsObj.error) {
        details = String(detailsObj.error);
      } else if (detailsObj.title) {
        details = `Sheet: "${detailsObj.title}"`;
      } else if (detailsObj.spreadsheetId) {
        details = `Đã lưu config: ${detailsObj.spreadsheetId.slice(0, 12)}... · schedule=${detailsObj.schedule}`;
      } else {
        details = JSON.stringify(detailsObj).slice(0, 240);
      }
    }

    return {
      id: r.id,
      at: r.createdAt.toISOString(),
      source,
      status,
      actor: r.user ? `${r.user.fullName} (${r.user.username})` : null,
      ipAddress: r.ipAddress,
      details
    };
  });
}

export async function getBackupConfig() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [KEY_SA, KEY_SHEET_ID, KEY_SCHEDULE, KEY_LAST_RUN, KEY_LAST_STATUS, KEY_LAST_DETAILS] } }
  });
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return {
    saJson: m.get(KEY_SA) ?? '',
    spreadsheetId: m.get(KEY_SHEET_ID) ?? '',
    schedule: (m.get(KEY_SCHEDULE) ?? 'manual') as 'manual' | 'hourly' | 'daily' | 'weekly',
    lastRun: m.get(KEY_LAST_RUN) ?? '',
    lastStatus: m.get(KEY_LAST_STATUS) ?? '',
    lastDetails: m.get(KEY_LAST_DETAILS) ?? ''
  };
}
