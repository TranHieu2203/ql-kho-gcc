import { prisma } from '@/lib/db/prisma';
import { parsePeriod, type NxtPeriod } from '@/lib/domain/nxt-report';
import { PAGE_SIZES } from '@/lib/pagination';

/** Loại biến động, suy ra từ receipt.type nếu là phiếu, ngược lại từ movement.source. */
export type MovementKind =
  | 'INBOUND'
  | 'OUTBOUND'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT'
  | 'INITIAL_IMPORT';

export const MOVEMENT_KIND_LABEL: Record<MovementKind, string> = {
  INBOUND: 'Nhập kho',
  OUTBOUND: 'Xuất kho',
  TRANSFER_IN: 'Chuyển đến',
  TRANSFER_OUT: 'Chuyển đi',
  ADJUSTMENT: 'Điều chỉnh',
  INITIAL_IMPORT: 'Tồn đầu kỳ'
};

/** Nhóm filter trên UI — TRANSFER gộp cả chiều đến và đi. */
export type KindFilter = 'ALL' | 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT' | 'INITIAL_IMPORT';

export type ProductHistoryFilters = {
  preset?: 'month' | 'quarter' | 'year' | 'custom' | 'all';
  month?: string;
  from?: string;
  to?: string;
  warehouseId?: string; // ID kho hoặc 'ALL'
  kind?: KindFilter;
  page?: number;
  pageSize?: number;
};

export type HistoryRow = {
  id: string;
  occurredAt: Date;
  recordedAt: Date;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  receiptId: string | null;
  receiptCode: string | null;
  partner: string | null;
  createdByName: string | null;
  note: string | null;
  kind: MovementKind;
  unit: string;
  qtyIn: number;
  qtyOut: number;
  qtyDelta: number;
  /** Tồn luỹ kế sau giao dịch, tính trên phạm vi kho đang lọc. */
  balanceAfter: number;
};

export type ProductHistoryResult = {
  period: NxtPeriod;
  warehouseIds: string[];
  /** Toàn bộ dòng trong kỳ đã áp filter loại (chưa phân trang). */
  totalRows: number;
  rows: HistoryRow[];
  page: number;
  pageSize: number;
  pageCount: number;
  /** Số liệu tổng kết — luôn tính trên toàn kỳ, KHÔNG phụ thuộc filter loại. */
  totals: { opening: number; inbound: number; outbound: number; closing: number };
  /** Tổng riêng của tập dòng đang hiển thị (sau filter loại). */
  filteredTotals: { inbound: number; outbound: number };
};

export { PAGE_SIZES };

function toKind(source: string, receiptType: string | null, qtyDelta: number): MovementKind {
  if (receiptType === 'INBOUND') return 'INBOUND';
  if (receiptType === 'OUTBOUND') return 'OUTBOUND';
  if (receiptType === 'TRANSFER') return qtyDelta >= 0 ? 'TRANSFER_IN' : 'TRANSFER_OUT';
  if (receiptType === 'ADJUSTMENT') return 'ADJUSTMENT';
  if (source === 'INITIAL_IMPORT') return 'INITIAL_IMPORT';
  return 'ADJUSTMENT';
}

function matchesKind(kind: MovementKind, filter: KindFilter): boolean {
  if (filter === 'ALL' || !filter) return true;
  if (filter === 'TRANSFER') return kind === 'TRANSFER_IN' || kind === 'TRANSFER_OUT';
  return kind === filter;
}

/**
 * Thẻ kho của một mặt hàng: tồn đầu kỳ, từng biến động kèm tồn luỹ kế, tồn cuối kỳ.
 *
 * Tồn luỹ kế được tính trên TOÀN BỘ biến động trong kỳ (theo phạm vi kho đang lọc)
 * rồi mới áp filter loại phiếu — nhờ vậy cột "Tồn sau GD" vẫn đúng khi người dùng
 * chỉ xem riêng phiếu nhập hoặc phiếu xuất.
 *
 * userWhIds: các kho user được phép xem (ADMIN = tất cả kho active).
 */
export async function runProductHistory(
  productId: string,
  filters: ProductHistoryFilters,
  userWhIds: string[]
): Promise<ProductHistoryResult> {
  const isAllTime = filters.preset === 'all';
  const period: NxtPeriod = isAllTime
    ? { from: new Date(0), to: new Date(8640000000000000), label: 'Toàn bộ thời gian', presetUsed: 'all' }
    : parsePeriod({
        preset: filters.preset === 'all' ? undefined : filters.preset,
        month: filters.month,
        from: filters.from,
        to: filters.to
      });

  const selectedWh =
    filters.warehouseId && filters.warehouseId !== 'ALL' && filters.warehouseId !== ''
      ? [filters.warehouseId].filter((id) => userWhIds.includes(id))
      : userWhIds;

  const kindFilter: KindFilter = filters.kind ?? 'ALL';

  // Toàn bộ biến động tới hết kỳ, tăng dần — dùng để tính tồn đầu kỳ + luỹ kế.
  const movements = await prisma.stockMovement.findMany({
    where: {
      productId,
      warehouseId: { in: selectedWh },
      ...(isAllTime ? {} : { occurredAt: { lt: period.to } })
    },
    orderBy: [{ occurredAt: 'asc' }, { recordedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      occurredAt: true,
      recordedAt: true,
      qtyDelta: true,
      unit: true,
      source: true,
      warehouseId: true,
      warehouse: { select: { name: true, code: true } },
      receipt: {
        select: {
          id: true,
          code: true,
          type: true,
          customerOrPartner: true,
          note: true,
          createdBy: { select: { fullName: true } }
        }
      }
    }
  });

  // movements đã sort tăng dần → mọi biến động trước kỳ nằm ở đầu mảng
  const before = isAllTime ? [] : movements.filter((m) => m.occurredAt < period.from);
  const within = isAllTime ? movements : movements.slice(before.length);
  const opening = before.reduce((s, m) => s + m.qtyDelta, 0);

  let running = opening;
  const inPeriod: HistoryRow[] = [];

  for (const m of within) {
    running += m.qtyDelta;
    inPeriod.push({
      id: m.id,
      occurredAt: m.occurredAt,
      recordedAt: m.recordedAt,
      warehouseId: m.warehouseId,
      warehouseName: m.warehouse.name,
      warehouseCode: m.warehouse.code,
      receiptId: m.receipt?.id ?? null,
      receiptCode: m.receipt?.code ?? null,
      partner: m.receipt?.customerOrPartner ?? null,
      createdByName: m.receipt?.createdBy?.fullName ?? null,
      note: m.receipt?.note ?? null,
      kind: toKind(m.source, m.receipt?.type ?? null, m.qtyDelta),
      unit: m.unit,
      qtyIn: m.qtyDelta > 0 ? m.qtyDelta : 0,
      qtyOut: m.qtyDelta < 0 ? -m.qtyDelta : 0,
      qtyDelta: m.qtyDelta,
      balanceAfter: running
    });
  }

  const inbound = inPeriod.reduce((s, r) => s + r.qtyIn, 0);
  const outbound = inPeriod.reduce((s, r) => s + r.qtyOut, 0);
  const totals = { opening, inbound, outbound, closing: opening + inbound - outbound };

  // Filter loại + đảo về thứ tự mới nhất trước
  const filtered = inPeriod.filter((r) => matchesKind(r.kind, kindFilter)).reverse();

  const filteredTotals = filtered.reduce(
    (acc, r) => ({ inbound: acc.inbound + r.qtyIn, outbound: acc.outbound + r.qtyOut }),
    { inbound: 0, outbound: 0 }
  );

  // pageSize = 0 → không phân trang (dùng cho xuất Excel)
  const noPaging = filters.pageSize === 0;
  const pageSize = noPaging
    ? filtered.length || 1
    : PAGE_SIZES.includes(filters.pageSize as any)
      ? (filters.pageSize as number)
      : 50;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = noPaging ? 1 : Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = noPaging ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    period,
    warehouseIds: selectedWh,
    totalRows: filtered.length,
    rows,
    page,
    pageSize,
    pageCount,
    totals,
    filteredTotals
  };
}
