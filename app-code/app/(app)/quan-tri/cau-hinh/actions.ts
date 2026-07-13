'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/lucia';
import { audit } from '@/lib/security/audit';

const ALLOWED_KEYS = new Set([
  'out_overstock_policy',
  'company_name',
  'company_address',
  'company_bank',
  'company_phone',
  'outbound_receipt_prefix',
  'inbound_receipt_prefix'
]);

const MAX_LEN: Record<string, number> = {
  company_name: 256,
  company_address: 512,
  company_bank: 256,
  company_phone: 64,
  outbound_receipt_prefix: 8,
  inbound_receipt_prefix: 8
};

export async function updateSettings(fd: FormData) {
  const user = await requireAdmin();
  const updates: Array<{ key: string; value: string }> = [];
  for (const [k, v] of fd.entries()) {
    if (!ALLOWED_KEYS.has(k)) continue;
    let value = String(v).trim();
    const max = MAX_LEN[k];
    if (max && value.length > max) value = value.slice(0, max);
    updates.push({ key: k, value });
  }
  if (updates.length === 0) return { error: 'Không có thay đổi nào.' };

  await prisma.$transaction(
    updates.map((u) =>
      prisma.setting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value }
      })
    )
  );

  await audit({ userId: user.id, action: 'update', entityType: 'Setting', entityId: 'system', after: { updates } });

  revalidatePath('/quan-tri/cau-hinh');
  return { ok: true };
}

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? defaultValue;
}
