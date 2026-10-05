import type { Prisma } from '@prisma/client';

/** Query params của màn danh sách phiếu Nhập / Xuất kho. */
export type ReceiptListSearchParams = {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD (bao gồm cả ngày này)
  warehouseId?: string;
  q?: string; // mã phiếu / đối tác
  product?: string; // SKU / tên / thương hiệu / size sản phẩm trong phiếu
  page?: string;
  pageSize?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(s: string | undefined): Date | null {
  if (!s || !DATE_RE.test(s)) return null;
  const d = new Date(s + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Dựng điều kiện `where` cho prisma.receipt từ searchParams.
 * `allowedWarehouseIds` là danh sách kho người dùng được xem — kho được chọn nằm ngoài danh sách sẽ bị bỏ qua.
 */
export function buildReceiptListWhere(
  type: 'INBOUND' | 'OUTBOUND',
  sp: ReceiptListSearchParams,
  allowedWarehouseIds: string[]
): Prisma.ReceiptWhereInput {
  const and: Prisma.ReceiptWhereInput[] = [];

  const wh = sp.warehouseId && sp.warehouseId !== 'ALL' && allowedWarehouseIds.includes(sp.warehouseId)
    ? [sp.warehouseId]
    : allowedWarehouseIds;

  const from = parseDay(sp.from);
  const toDay = parseDay(sp.to);
  if (from || toDay) {
    const date: Prisma.DateTimeFilter = {};
    if (from) date.gte = from;
    if (toDay) {
      const to = new Date(toDay);
      to.setDate(to.getDate() + 1); // exclusive
      date.lt = to;
    }
    and.push({ date });
  }

  const q = (sp.q ?? '').trim();
  if (q) {
    and.push({ OR: [{ code: { contains: q } }, { customerOrPartner: { contains: q } }] });
  }

  const product = (sp.product ?? '').trim();
  if (product) {
    and.push({
      lines: {
        some: {
          product: {
            OR: [
              { sku: { contains: product } },
              { fullName: { contains: product } },
              { brand: { contains: product } },
              { size: { contains: product } }
            ]
          }
        }
      }
    });
  }

  return { type, warehouseId: { in: wh }, ...(and.length ? { AND: and } : {}) };
}

/** Các param lọc (không gồm page/pageSize) để truyền vào <Pagination params>. */
export function receiptFilterParams(sp: ReceiptListSearchParams) {
  return {
    from: sp.from,
    to: sp.to,
    warehouseId: sp.warehouseId && sp.warehouseId !== 'ALL' ? sp.warehouseId : undefined,
    q: sp.q?.trim() || undefined,
    product: sp.product?.trim() || undefined
  };
}

export function countActiveFilters(params: Record<string, string | undefined>) {
  return Object.values(params).filter((v) => v !== undefined && v !== '').length;
}
