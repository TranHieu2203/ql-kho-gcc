import { prisma } from '@/lib/db/prisma';

export type NxtFilters = {
  preset?: 'month' | 'quarter' | 'year' | 'custom';
  month?: string;      // YYYY-MM (backward-compat)
  from?: string;       // YYYY-MM-DD
  to?: string;         // YYYY-MM-DD
  warehouseId?: string; // ID kho hoặc 'ALL'
  q?: string;          // search SKU/brand/size/pattern
  brand?: string;      // exact brand filter (hoặc 'ALL')
  stockState?: 'all' | 'ok' | 'low' | 'out';
  activeOnly?: '1' | '';  // '1' = chỉ SP có Nhập+Xuất trong kỳ
  sort?: 'sku' | 'inbound' | 'outbound' | 'closing';
};

export type NxtPeriod = { from: Date; to: Date; label: string; presetUsed: string };

export function parsePeriod(f: NxtFilters): NxtPeriod {
  const now = new Date();
  const preset = f.preset ?? (f.month ? 'month' : 'month');

  // Backward-compat: `month=YYYY-MM` param
  if (f.month && /^\d{4}-\d{2}$/.test(f.month)) {
    const [y, m] = f.month.split('-').map(Number);
    const from = new Date(y, m - 1, 1, 0, 0, 0);
    const to = new Date(y, m, 1, 0, 0, 0);
    return { from, to, label: `Tháng ${String(m).padStart(2, '0')}/${y}`, presetUsed: 'month' };
  }

  if (preset === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0);
    const to = new Date(now.getFullYear(), q * 3 + 3, 1, 0, 0, 0);
    return { from, to, label: `Quý ${q + 1}/${now.getFullYear()}`, presetUsed: 'quarter' };
  }
  if (preset === 'year') {
    const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    const to = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0);
    return { from, to, label: `Năm ${now.getFullYear()}`, presetUsed: 'year' };
  }
  if (preset === 'custom' && f.from && f.to) {
    const from = new Date(f.from + 'T00:00:00');
    const to = new Date(f.to + 'T00:00:00');
    // to là exclusive, cộng thêm 1 ngày
    to.setDate(to.getDate() + 1);
    return {
      from,
      to,
      label: `${f.from} → ${f.to}`,
      presetUsed: 'custom'
    };
  }

  // Default: tháng hiện tại
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const from = new Date(y, m - 1, 1, 0, 0, 0);
  const to = new Date(y, m, 1, 0, 0, 0);
  return { from, to, label: `Tháng ${String(m).padStart(2, '0')}/${y}`, presetUsed: 'month' };
}

export type NxtRow = {
  productId: string;
  sku: string;
  brand: string;
  size: string;
  pattern: string;
  lowStockThreshold: number;
  inbound: number;
  outbound: number;
  closing: number;
};

export type NxtResult = {
  period: NxtPeriod;
  warehouseIds: string[];      // các kho được filter
  rows: NxtRow[];
  totals: { inbound: number; outbound: number; closing: number };
  brands: string[];            // dropdown options
};

/**
 * Chạy báo cáo NXT với các filter đã áp dụng.
 * userWhIds: danh sách kho user có quyền (ADMIN đã list full, staff = phân quyền).
 */
export async function runNxtReport(
  filters: NxtFilters,
  userWhIds: string[]
): Promise<NxtResult> {
  const period = parsePeriod(filters);

  const selectedWh = filters.warehouseId && filters.warehouseId !== 'ALL' && filters.warehouseId !== ''
    ? [filters.warehouseId].filter((id) => userWhIds.includes(id))
    : userWhIds;

  const q = (filters.q ?? '').trim();
  const brand = filters.brand && filters.brand !== 'ALL' ? filters.brand : undefined;

  // Product filter: server-side WHERE (indexed on active + brand? just brand=eq is OK)
  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(brand ? { brand } : {}),
      ...(q
        ? {
            OR: [
              { sku: { contains: q } },
              { brand: { contains: q } },
              { size: { contains: q } },
              { pattern: { contains: q } },
              { fullName: { contains: q } }
            ]
          }
        : {})
    },
    orderBy: { sku: 'asc' }
  });

  const productIds = new Set(products.map((p) => p.id));

  // Movements: chỉ scope theo kho (đã filter product ở step sau bằng in-memory)
  const [periodMovements, allMovements] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        warehouseId: { in: selectedWh },
        occurredAt: { gte: period.from, lt: period.to }
      },
      select: { productId: true, qtyDelta: true }
    }),
    prisma.stockMovement.findMany({
      where: {
        warehouseId: { in: selectedWh },
        occurredAt: { lt: period.to }
      },
      select: { productId: true, qtyDelta: true }
    })
  ]);

  const rowMap = new Map<string, NxtRow>();
  for (const p of products) {
    rowMap.set(p.id, {
      productId: p.id,
      sku: p.sku,
      brand: p.brand,
      size: p.size,
      pattern: p.pattern,
      lowStockThreshold: p.lowStockThreshold,
      inbound: 0,
      outbound: 0,
      closing: 0
    });
  }
  for (const m of periodMovements) {
    const r = rowMap.get(m.productId);
    if (!r) continue;
    if (m.qtyDelta > 0) r.inbound += m.qtyDelta;
    else r.outbound += -m.qtyDelta;
  }
  for (const m of allMovements) {
    const r = rowMap.get(m.productId);
    if (!r) continue;
    r.closing += m.qtyDelta;
  }

  let rows = Array.from(rowMap.values());

  // Active-only: chỉ SP có activity trong kỳ HOẶC có tồn ≠ 0
  if (filters.activeOnly === '1') {
    rows = rows.filter((r) => r.inbound + r.outbound + r.closing !== 0);
  }

  // Stock state filter
  const st = filters.stockState ?? 'all';
  if (st === 'ok') {
    rows = rows.filter((r) => r.closing >= r.lowStockThreshold);
  } else if (st === 'low') {
    rows = rows.filter((r) => r.closing > 0 && r.closing < r.lowStockThreshold);
  } else if (st === 'out') {
    rows = rows.filter((r) => r.closing <= 0);
  }

  // Sort
  const sortKey = filters.sort ?? 'sku';
  rows.sort((a, b) => {
    if (sortKey === 'sku') return a.sku.localeCompare(b.sku);
    if (sortKey === 'inbound') return b.inbound - a.inbound || a.sku.localeCompare(b.sku);
    if (sortKey === 'outbound') return b.outbound - a.outbound || a.sku.localeCompare(b.sku);
    if (sortKey === 'closing') return b.closing - a.closing || a.sku.localeCompare(b.sku);
    return 0;
  });

  const totals = rows.reduce(
    (acc, r) => ({
      inbound: acc.inbound + r.inbound,
      outbound: acc.outbound + r.outbound,
      closing: acc.closing + r.closing
    }),
    { inbound: 0, outbound: 0, closing: 0 }
  );

  // Distinct brands: list all brands from active products (không phụ thuộc filter hiện tại)
  const brandRows = await prisma.product.findMany({
    where: { active: true },
    select: { brand: true },
    distinct: ['brand'],
    orderBy: { brand: 'asc' }
  });
  const brands = brandRows.map((b) => b.brand);

  return {
    period,
    warehouseIds: selectedWh,
    rows,
    totals,
    brands
  };
}
