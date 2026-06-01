'use server';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/lucia';
import { audit } from '@/lib/security/audit';

// ====== H2: Server-side parse to avoid xlsx (SheetJS) prototype pollution / ReDoS CVEs ======

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_ROWS_TOTAL = 10_000;

export type ParsedSheetSummary = { name: string; rowCount: number };
export type ValidatedRow = {
  type: 'PRODUCT' | 'INBOUND' | 'OUTBOUND' | 'TRANSFER';
  ok: boolean;
  source: { sheet: string; rowIndex: number };
  data: any;
  errors: string[];
};

function normalizeHeader(h: any): string {
  return String(h ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function getCol(row: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return row[k];
  }
  return '';
}

function parseDateCell(v: any): Date | null {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v !== null && 'getTime' in v && typeof (v as any).getTime === 'function') {
    return v as Date;
  }
  if (typeof v === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + v * 86400000);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      let yy = parseInt(m[3], 10);
      if (yy < 100) yy += 2000;
      const d = new Date(yy, mm - 1, dd);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Parse uploaded Excel file SERVER-SIDE via exceljs and validate every row.
 * Returns sheets summary + validated rows. Client never touches xlsx.
 */
export async function parseImportFile(fd: FormData): Promise<
  | { error: string }
  | { sheets: ParsedSheetSummary[]; rows: ValidatedRow[] }
> {
  await requireAdmin();
  const file = fd.get('file');
  if (!(file instanceof File)) return { error: 'Không tìm thấy file.' };
  if (file.size > MAX_UPLOAD_BYTES) return { error: `File quá lớn (>${MAX_UPLOAD_BYTES / 1024 / 1024}MB).` };
  if (!/\.xlsx$/i.test(file.name)) return { error: 'Chỉ chấp nhận file .xlsx' };

  const arrayBuf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(arrayBuf);
  } catch (e: any) {
    return { error: 'File không đọc được: ' + (e?.message ?? 'unknown') };
  }

  // Build warehouse code → presence set for transfer validation
  const warehouses = await prisma.warehouse.findMany({ where: { active: true } });
  const whCodes = new Set(warehouses.map((w) => w.code.toUpperCase()));

  const sheets: ParsedSheetSummary[] = [];
  const all: ValidatedRow[] = [];

  for (const ws of wb.worksheets) {
    const name = ws.name;
    const upper = name.toUpperCase();
    const isCatalog = upper.includes('DANH MỤC') || upper.includes('DANH MUC');
    const isTransfer = upper.includes('CHUYỂN') || upper.includes('CHUYEN');
    const isInbound = !isTransfer && upper.includes('NHẬP');
    const isOutbound = !isTransfer && upper.includes('XUẤT');

    if (!isCatalog && !isTransfer && !isInbound && !isOutbound) {
      sheets.push({ name, rowCount: 0 });
      continue;
    }

    // Find header row: scan first 5 rows for one matching expected headers
    let headerRowIdx = 1;
    for (let i = 1; i <= Math.min(ws.rowCount, 5); i++) {
      const row = ws.getRow(i);
      const headers = (row.values as any[]).slice(1).map(normalizeHeader);
      if (headers.some((h) => h.includes('MÃ HÀNG') || h.includes('NGÀY') || h.includes('THƯƠNG HIỆU'))) {
        headerRowIdx = i;
        break;
      }
    }
    const headerRow = ws.getRow(headerRowIdx);
    const headers = (headerRow.values as any[]).slice(1).map(normalizeHeader);

    let rowCount = 0;
    for (let i = headerRowIdx + 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      if (all.length >= MAX_ROWS_TOTAL) {
        return { error: `Vượt giới hạn ${MAX_ROWS_TOTAL} dòng dữ liệu.` };
      }
      const vals = (row.values as any[]).slice(1);
      const obj: Record<string, any> = {};
      vals.forEach((v, idx) => {
        const h = headers[idx];
        if (h) obj[h] = v;
      });
      // Skip fully empty rows
      const isEmpty = Object.values(obj).every((v) => v == null || (typeof v === 'string' && v.trim() === ''));
      if (isEmpty) continue;
      rowCount++;

      const errors: string[] = [];

      if (isCatalog) {
        const sku = String(getCol(obj, '* MÃ HÀNG', 'MÃ HÀNG')).trim();
        const brand = String(getCol(obj, '* THƯƠNG HIỆU', 'THƯƠNG HIỆU')).trim();
        const size = String(getCol(obj, '* KÍCH THƯỚC (SIZE)', 'KÍCH THƯỚC (SIZE)', 'KÍCH THƯỚC')).trim();
        const pattern = String(getCol(obj, '* MÃ GAI (PATTERN)', 'MÃ GAI (PATTERN)', 'MÃ GAI')).trim();
        const fullName = String(getCol(obj, 'TÊN ĐẦY ĐỦ (TUỲ CHỌN)', 'TÊN ĐẦY ĐỦ')).trim() || sku;
        if (!sku) errors.push('Thiếu mã hàng');
        if (!brand) errors.push('Thiếu thương hiệu');
        if (!size) errors.push('Thiếu size');
        if (!pattern) errors.push('Thiếu mã gai');
        all.push({
          type: 'PRODUCT',
          ok: errors.length === 0,
          source: { sheet: name, rowIndex: i },
          data: { sku, fullName, brand, size, pattern },
          errors
        });
      } else if (isInbound || isOutbound) {
        const date = parseDateCell(getCol(obj, '* NGÀY', 'NGÀY'));
        const sku = String(getCol(obj, '* MÃ HÀNG', 'MÃ HÀNG')).trim();
        const qtyRaw = getCol(obj, '* SỐ LƯỢNG', 'SỐ LƯỢNG');
        const qty = parseInt(String(qtyRaw).trim(), 10);
        const unit = String(getCol(obj, 'ĐVT') || 'Bộ').trim().toUpperCase().includes('CHI') ? 'CHIEC' : 'BO';
        const customer = String(getCol(obj, 'KHÁCH HÀNG / NGƯỜI NHẬN', 'KHÁCH HÀNG')).trim();
        const note = String(getCol(obj, 'GHI CHÚ')).trim();
        if (!date) errors.push('Thiếu/sai ngày');
        if (!sku) errors.push('Thiếu mã hàng');
        if (!Number.isFinite(qty) || qty <= 0) errors.push('Số lượng không hợp lệ');
        if (sku.includes('#N/A') || sku.startsWith('#')) errors.push('Mã hàng lỗi (#N/A)');
        all.push({
          type: isInbound ? 'INBOUND' : 'OUTBOUND',
          ok: errors.length === 0,
          source: { sheet: name, rowIndex: i },
          data: { date, sku, quantity: qty, unit, customer, note },
          errors
        });
      } else if (isTransfer) {
        const date = parseDateCell(getCol(obj, '* NGÀY', 'NGÀY'));
        const sku = String(getCol(obj, '* MÃ HÀNG', 'MÃ HÀNG')).trim();
        const fromCode = String(getCol(obj, '* TỪ KHO (MÃ)', 'TỪ KHO (MÃ)', 'TỪ KHO')).trim().toUpperCase();
        const toCode = String(getCol(obj, '* ĐẾN KHO (MÃ)', 'ĐẾN KHO (MÃ)', 'ĐẾN KHO')).trim().toUpperCase();
        const qty = parseInt(String(getCol(obj, '* SỐ LƯỢNG', 'SỐ LƯỢNG')).trim(), 10);
        const unit = String(getCol(obj, 'ĐVT') || 'Bộ').trim().toUpperCase().includes('CHI') ? 'CHIEC' : 'BO';
        const note = String(getCol(obj, 'GHI CHÚ')).trim();
        if (!date) errors.push('Thiếu/sai ngày');
        if (!sku) errors.push('Thiếu mã hàng');
        if (!fromCode) errors.push('Thiếu mã kho nguồn');
        if (!toCode) errors.push('Thiếu mã kho đến');
        if (fromCode && toCode && fromCode === toCode) errors.push('Kho nguồn và kho đến phải khác nhau');
        if (fromCode && !whCodes.has(fromCode)) errors.push(`Mã kho nguồn "${fromCode}" không tồn tại`);
        if (toCode && !whCodes.has(toCode)) errors.push(`Mã kho đến "${toCode}" không tồn tại`);
        if (!Number.isFinite(qty) || qty <= 0) errors.push('Số lượng không hợp lệ');
        all.push({
          type: 'TRANSFER',
          ok: errors.length === 0,
          source: { sheet: name, rowIndex: i },
          data: { date, sku, fromCode, toCode, quantity: qty, unit, note },
          errors
        });
      }
    }
    sheets.push({ name, rowCount });
  }

  return { sheets, rows: all };
}

// ====== Existing import action ======

const productRow = z.object({
  type: z.literal('PRODUCT'),
  data: z.object({
    sku: z.string().min(1),
    fullName: z.string().min(1),
    brand: z.string().min(1),
    size: z.string().min(1),
    pattern: z.string().min(1)
  })
});

const inOutRow = z.object({
  type: z.enum(['INBOUND', 'OUTBOUND']),
  data: z.object({
    date: z.coerce.date(),
    sku: z.string().min(1),
    quantity: z.number().int().positive(),
    unit: z.enum(['BO', 'CHIEC']).default('BO'),
    customer: z.string().optional().default(''),
    note: z.string().optional().default('')
  })
});

const transferRow = z.object({
  type: z.literal('TRANSFER'),
  data: z.object({
    date: z.coerce.date(),
    sku: z.string().min(1),
    fromCode: z.string().min(1),
    toCode: z.string().min(1),
    quantity: z.number().int().positive(),
    unit: z.enum(['BO', 'CHIEC']).default('BO'),
    note: z.string().optional().default('')
  })
});

const payloadSchema = z.object({
  rows: z.array(z.union([productRow, inOutRow, transferRow])).max(10_000, 'Tối đa 10.000 dòng / lần import'),
  warehouseId: z.string().min(1),
  updateExisting: z.boolean().default(false)
});

export async function importData(payload: unknown) {
  const me = await requireAdmin();
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { error: 'Dữ liệu không hợp lệ.' };

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const productRows = parsed.data.rows.filter((r): r is z.infer<typeof productRow> => r.type === 'PRODUCT');
  const inOutRows = parsed.data.rows.filter((r): r is z.infer<typeof inOutRow> => r.type === 'INBOUND' || r.type === 'OUTBOUND');
  const transferRows = parsed.data.rows.filter((r): r is z.infer<typeof transferRow> => r.type === 'TRANSFER');

  // ===== Step 1: Import / upsert products =====
  for (const r of productRows) {
    try {
      const existing = await prisma.product.findUnique({ where: { sku: r.data.sku } });
      if (existing) {
        if (parsed.data.updateExisting) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              fullName: r.data.fullName,
              brand: r.data.brand,
              size: r.data.size,
              pattern: r.data.pattern
            }
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        await prisma.product.create({
          data: {
            sku: r.data.sku,
            fullName: r.data.fullName,
            brand: r.data.brand,
            size: r.data.size,
            pattern: r.data.pattern,
            defaultUnit: 'BO',
            lowStockThreshold: 10,
            active: true
          }
        });
        created++;
      }
    } catch {
      errors++;
    }
  }

  // ===== Step 2: Lookup maps =====
  const skuMap = new Map<string, string>();
  const products = await prisma.product.findMany();
  for (const p of products) skuMap.set(p.sku, p.id);

  const whMap = new Map<string, string>();
  const warehouses = await prisma.warehouse.findMany();
  for (const w of warehouses) whMap.set(w.code.toUpperCase(), w.id);

  // ===== Step 3: Group IN/OUT by (date + type + customer) — 1 phiếu per group =====
  type IOGroup = {
    date: Date;
    type: 'INBOUND' | 'OUTBOUND';
    customer: string;
    lines: { productId: string; unit: 'BO' | 'CHIEC'; quantity: number; lineNote?: string }[];
  };
  const ioGroupMap = new Map<string, IOGroup>();
  for (const r of inOutRows) {
    const productId = skuMap.get(r.data.sku);
    if (!productId) { errors++; continue; }
    const dateKey = r.data.date.toISOString().slice(0, 10);
    const customer = (r.data.customer ?? '').trim();
    const key = `${r.type}|${dateKey}|${customer}`;
    let g = ioGroupMap.get(key);
    if (!g) {
      g = { date: r.data.date, type: r.type, customer, lines: [] };
      ioGroupMap.set(key, g);
    }
    g.lines.push({ productId, unit: r.data.unit, quantity: r.data.quantity, lineNote: r.data.note || undefined });
  }

  for (const g of ioGroupMap.values()) {
    if (g.lines.length === 0) continue;
    const requestId = `IMPORT:${g.type}:${g.date.toISOString().slice(0, 10)}:${parsed.data.warehouseId}:${g.customer}`;
    const dup = await prisma.receipt.findUnique({ where: { clientRequestId: requestId } });
    if (dup) { skipped++; continue; }

    const year = g.date.getFullYear();
    const prefix = g.type === 'INBOUND' ? 'IN' : 'OUT';
    const last = await prisma.receipt.findFirst({
      where: { type: g.type, code: { startsWith: `${prefix}-${year}-` } },
      orderBy: { code: 'desc' }
    });
    const seq = last ? parseInt(last.code.split('-').pop() || '0', 10) + 1 : 1;
    const code = `${prefix}-${year}-${String(seq).padStart(4, '0')}`;

    try {
      await prisma.$transaction(async (tx) => {
        const receipt = await tx.receipt.create({
          data: {
            code,
            type: g.type,
            status: 'CONFIRMED',
            warehouseId: parsed.data.warehouseId,
            date: g.date,
            customerOrPartner: g.customer || null,
            createdById: me.id,
            clientRequestId: requestId,
            confirmedAt: new Date(),
            note: 'Import từ Excel',
            lines: { create: g.lines.map((l) => ({ productId: l.productId, unit: l.unit, quantity: l.quantity, lineNote: l.lineNote })) }
          }
        });
        const sign = g.type === 'INBOUND' ? 1 : -1;
        for (const ln of g.lines) {
          await tx.stockMovement.create({
            data: {
              warehouseId: parsed.data.warehouseId,
              productId: ln.productId,
              unit: ln.unit,
              qtyDelta: ln.quantity * sign,
              source: 'INITIAL_IMPORT',
              sourceId: receipt.id,
              occurredAt: g.date
            }
          });
        }
      });
      created++;
    } catch {
      errors++;
    }
  }

  // ===== Step 4: Group TRANSFER by (date + from + to) =====
  type TGroup = {
    date: Date;
    fromWarehouseId: string;
    toWarehouseId: string;
    fromCode: string;
    toCode: string;
    lines: { productId: string; unit: 'BO' | 'CHIEC'; quantity: number; lineNote?: string }[];
  };
  const trGroupMap = new Map<string, TGroup>();
  for (const r of transferRows) {
    const productId = skuMap.get(r.data.sku);
    if (!productId) { errors++; continue; }
    const fromId = whMap.get(r.data.fromCode.toUpperCase());
    const toId = whMap.get(r.data.toCode.toUpperCase());
    if (!fromId || !toId) { errors++; continue; }
    const dateKey = r.data.date.toISOString().slice(0, 10);
    const key = `TR|${dateKey}|${fromId}|${toId}`;
    let g = trGroupMap.get(key);
    if (!g) {
      g = { date: r.data.date, fromWarehouseId: fromId, toWarehouseId: toId, fromCode: r.data.fromCode, toCode: r.data.toCode, lines: [] };
      trGroupMap.set(key, g);
    }
    g.lines.push({ productId, unit: r.data.unit, quantity: r.data.quantity, lineNote: r.data.note || undefined });
  }

  for (const g of trGroupMap.values()) {
    if (g.lines.length === 0) continue;
    const requestId = `IMPORT:TRANSFER:${g.date.toISOString().slice(0, 10)}:${g.fromWarehouseId}:${g.toWarehouseId}`;
    const dup = await prisma.receipt.findUnique({ where: { clientRequestId: requestId } });
    if (dup) { skipped++; continue; }

    const year = g.date.getFullYear();
    const last = await prisma.receipt.findFirst({
      where: { type: 'TRANSFER', code: { startsWith: `TR-${year}-` } },
      orderBy: { code: 'desc' }
    });
    const seq = last ? parseInt(last.code.split('-').pop() || '0', 10) + 1 : 1;
    const code = `TR-${year}-${String(seq).padStart(4, '0')}`;

    try {
      await prisma.$transaction(async (tx) => {
        // For imported transfers, we treat them as ALREADY CONFIRMED (lịch sử đã đi rồi)
        // → both from-decrement and to-increment movements at the same date
        const receipt = await tx.receipt.create({
          data: {
            code,
            type: 'TRANSFER',
            status: 'CONFIRMED',
            warehouseId: g.fromWarehouseId,
            fromWarehouseId: g.fromWarehouseId,
            toWarehouseId: g.toWarehouseId,
            date: g.date,
            createdById: me.id,
            clientRequestId: requestId,
            confirmedAt: new Date(),
            note: 'Import từ Excel (đã hoàn tất)',
            lines: { create: g.lines.map((l) => ({ productId: l.productId, unit: l.unit, quantity: l.quantity, lineNote: l.lineNote })) }
          }
        });
        for (const ln of g.lines) {
          await tx.stockMovement.create({
            data: {
              warehouseId: g.fromWarehouseId,
              productId: ln.productId,
              unit: ln.unit,
              qtyDelta: -ln.quantity,
              source: 'INITIAL_IMPORT',
              sourceId: receipt.id,
              occurredAt: g.date
            }
          });
          await tx.stockMovement.create({
            data: {
              warehouseId: g.toWarehouseId,
              productId: ln.productId,
              unit: ln.unit,
              qtyDelta: ln.quantity,
              source: 'INITIAL_IMPORT',
              sourceId: receipt.id,
              occurredAt: g.date
            }
          });
        }
      });
      created++;
    } catch {
      errors++;
    }
  }

  // ===== Audit + revalidate =====
  await audit({
    userId: me.id,
    action: 'import',
    entityType: 'BulkImport',
    entityId: 'excel',
    after: {
      created,
      updated,
      skipped,
      errors,
      breakdown: {
        products: productRows.length,
        inOut: inOutRows.length,
        transfers: transferRows.length
      }
    }
  });

  revalidatePath('/danh-muc');
  revalidatePath('/ton-kho');
  revalidatePath('/tong-quan');
  revalidatePath('/nhap-kho');
  revalidatePath('/xuat-kho');
  revalidatePath('/chuyen-kho');
  revalidatePath('/bao-cao/nxt');

  return { summary: { created, updated, skipped, errors } };
}
