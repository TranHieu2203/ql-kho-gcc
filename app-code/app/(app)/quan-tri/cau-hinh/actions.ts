'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/lucia';
import { audit } from '@/lib/security/audit';

const ALLOWED_KEYS = new Set(['out_overstock_policy']);

export async function updateSettings(fd: FormData) {
  const user = await requireAdmin();
  const updates: Array<{ key: string; value: string }> = [];
  for (const [k, v] of fd.entries()) {
    if (!ALLOWED_KEYS.has(k)) continue;
    updates.push({ key: k, value: String(v) });
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
