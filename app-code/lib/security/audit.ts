import { prisma } from '@/lib/db/prisma';
import { getRequestMeta } from './request-meta';

export type AuditInput = {
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: object | null;
  after?: object | null;
};

/**
 * Tạo audit log entry tự động gắn ipAddress + userAgent từ headers.
 * Chấp nhận before/after là object → tự stringify (giới hạn ~8KB tránh log bloat).
 */
export async function audit(input: AuditInput) {
  const { ipAddress, userAgent } = getRequestMeta();
  const safeStringify = (v: object | null | undefined) => {
    if (v == null) return undefined;
    try {
      const s = JSON.stringify(v);
      return s.length > 8192 ? s.slice(0, 8192) + '...[truncated]' : s;
    } catch {
      return '[unserializable]';
    }
  };
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: safeStringify(input.before),
      after: safeStringify(input.after),
      ipAddress,
      userAgent
    }
  });
}
