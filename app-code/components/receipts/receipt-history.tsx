import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils';

type Snapshot = {
  warehouseId?: string;
  date?: string;
  customerOrPartner?: string | null;
  customerAddress?: string | null;
  customerPhone?: string | null;
  note?: string | null;
  lines?: { productId: string; unit: string; quantity: number }[];
  stockDiff?: { warehouseId: string; productId: string; change: number }[];
  negativeStockOverride?: { sku: string; minStock: number }[];
};

function parse(s: string | null): Snapshot | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null; // bị cắt bớt do quá dài
  }
}

const FIELD_LABELS: [keyof Snapshot, string][] = [
  ['customerOrPartner', 'Đối tác'],
  ['customerAddress', 'Địa chỉ'],
  ['customerPhone', 'Điện thoại'],
  ['note', 'Ghi chú']
];

/**
 * Lịch sử thao tác trên 1 phiếu, đọc từ AuditLog (create/update).
 * Với lần sửa: liệt kê trường thay đổi, chênh lệch số lượng từng dòng và tồn kho được cân đối.
 */
export async function ReceiptHistory({ receiptId }: { receiptId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { entityType: 'Receipt', entityId: receiptId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { fullName: true } } }
  });
  if (logs.length === 0) return null;

  const parsed = logs.map((l) => ({ log: l, before: parse(l.before), after: parse(l.after) }));
  const productIds = new Set<string>();
  const warehouseIds = new Set<string>();
  for (const { before, after } of parsed) {
    for (const s of [before, after]) {
      if (!s) continue;
      if (s.warehouseId) warehouseIds.add(s.warehouseId);
      s.lines?.forEach((l) => productIds.add(l.productId));
      s.stockDiff?.forEach((d) => { productIds.add(d.productId); warehouseIds.add(d.warehouseId); });
    }
  }
  const [products, warehouses] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: Array.from(productIds) } }, select: { id: true, sku: true } }),
    prisma.warehouse.findMany({ where: { id: { in: Array.from(warehouseIds) } }, select: { id: true, name: true } })
  ]);
  const sku = new Map(products.map((p) => [p.id, p.sku]));
  const wh = new Map(warehouses.map((w) => [w.id, w.name]));

  return (
    <Card>
      <CardHeader><CardTitle>Lịch sử thay đổi ({logs.length})</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        {parsed.map(({ log, before, after }) => (
          <div key={log.id} className="border-l-2 pl-3">
            <div className="flex flex-wrap gap-x-2 text-muted-foreground">
              <span className="font-mono text-xs">{formatDateTime(log.createdAt)}</span>
              <span>·</span>
              <span>{log.user?.fullName ?? '—'}</span>
              <span>·</span>
              <span className="font-medium text-foreground">
                {log.action === 'create' ? 'Tạo phiếu' : log.action === 'update' ? 'Sửa phiếu' : log.action}
              </span>
            </div>
            {log.action === 'update' && (
              before && after ? <UpdateDetail before={before} after={after} sku={sku} wh={wh} /> :
              <p className="text-muted-foreground mt-1">Chi tiết quá dài để hiển thị — xem trong Audit log.</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function UpdateDetail({
  before,
  after,
  sku,
  wh
}: {
  before: Snapshot;
  after: Snapshot;
  sku: Map<string, string>;
  wh: Map<string, string>;
}) {
  const changes: string[] = [];
  if (before.warehouseId !== after.warehouseId) {
    changes.push(`Kho: ${wh.get(before.warehouseId ?? '') ?? '?'} → ${wh.get(after.warehouseId ?? '') ?? '?'}`);
  }
  if (before.date && after.date && formatDate(before.date) !== formatDate(after.date)) {
    changes.push(`Ngày: ${formatDate(before.date)} → ${formatDate(after.date)}`);
  }
  for (const [k, label] of FIELD_LABELS) {
    const a = (before[k] as string | null | undefined) ?? '';
    const b = (after[k] as string | null | undefined) ?? '';
    if (a !== b) changes.push(`${label}: ${a || '—'} → ${b || '—'}`);
  }

  // Số lượng theo (sản phẩm, ĐVT)
  const qty = new Map<string, { productId: string; unit: string; before: number; after: number }>();
  const add = (l: { productId: string; unit: string; quantity: number }, side: 'before' | 'after') => {
    const k = `${l.productId}|${l.unit}`;
    const v = qty.get(k) ?? { productId: l.productId, unit: l.unit, before: 0, after: 0 };
    v[side] += l.quantity;
    qty.set(k, v);
  };
  before.lines?.forEach((l) => add(l, 'before'));
  after.lines?.forEach((l) => add(l, 'after'));
  const lineChanges = Array.from(qty.values()).filter((v) => v.before !== v.after);

  const stockDiff = after.stockDiff ?? [];

  if (changes.length === 0 && lineChanges.length === 0) {
    return <p className="text-muted-foreground mt-1">Không có thay đổi nội dung.</p>;
  }

  return (
    <div className="mt-1 space-y-1">
      {changes.map((c) => <div key={c}>{c}</div>)}
      {lineChanges.map((v) => (
        <div key={`${v.productId}|${v.unit}`}>
          <span className="font-mono">{sku.get(v.productId) ?? v.productId}</span>
          {' '}({v.unit === 'BO' ? 'Bộ' : 'Chiếc'}): {formatNumber(v.before)} → {formatNumber(v.after)}
        </div>
      ))}
      {stockDiff.length > 0 && (
        <div className="text-muted-foreground">
          Cân đối tồn:{' '}
          {stockDiff.map((d, i) => (
            <span key={`${d.warehouseId}|${d.productId}`}>
              {i > 0 && ', '}
              <span className="font-mono">{sku.get(d.productId) ?? d.productId}</span>
              {wh.size > 1 && ` @ ${wh.get(d.warehouseId) ?? '?'}`}{' '}
              <span className={d.change > 0 ? 'text-success' : 'text-danger'}>
                {d.change > 0 ? '+' : ''}{formatNumber(d.change)}
              </span>
            </span>
          ))}
        </div>
      )}
      {after.negativeStockOverride && after.negativeStockOverride.length > 0 && (
        <div className="text-danger">
          Quản trị viên đã ghi đè cảnh báo tồn âm: {after.negativeStockOverride.map((i) => `${i.sku} (${i.minStock})`).join(', ')}
        </div>
      )}
    </div>
  );
}
