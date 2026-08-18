import { NextResponse, type NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import {
  runProductHistory,
  MOVEMENT_KIND_LABEL,
  type KindFilter,
  type ProductHistoryFilters
} from '@/lib/domain/product-history';
import { formatDate } from '@/lib/utils';

const KIND_FILTER_LABEL: Record<KindFilter, string> = {
  ALL: 'Tất cả loại',
  INBOUND: 'Nhập kho',
  OUTBOUND: 'Xuất kho',
  TRANSFER: 'Chuyển kho',
  ADJUSTMENT: 'Điều chỉnh tồn',
  INITIAL_IMPORT: 'Tồn đầu kỳ (import)'
};

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^\w\d]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/** Thẻ kho (lịch sử nhập xuất) của một mặt hàng, theo đúng bộ lọc đang xem trên web. */
export async function GET(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const sp = req.nextUrl.searchParams;
  const sku = sp.get('sku');
  if (!sku) return new NextResponse('Thiếu tham số sku', { status: 400 });

  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) return new NextResponse('Không tìm thấy sản phẩm', { status: 404 });
  if (!product.active && user.role !== 'ADMIN') return new NextResponse('Not found', { status: 404 });

  const warehouses =
    user.role === 'ADMIN'
      ? await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } })
      : await getUserWarehouses(user.id).then((ids) =>
          prisma.warehouse.findMany({
            where: { id: { in: ids.map((w) => w.id) }, active: true },
            orderBy: { code: 'asc' }
          })
        );
  const userWhIds = warehouses.map((w) => w.id);

  const kind = (sp.get('kind') as KindFilter) || 'ALL';
  const filters: ProductHistoryFilters = {
    preset: (sp.get('preset') as any) || 'all',
    month: sp.get('month') ?? undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
    warehouseId: sp.get('warehouseId') ?? undefined,
    kind,
    page: 1,
    pageSize: 0 // 0 = xuất toàn bộ, không phân trang
  };

  const history = await runProductHistory(product.id, filters, userWhIds);

  const whParam = sp.get('warehouseId');
  const whName =
    !whParam || whParam === 'ALL'
      ? 'Tất cả các kho'
      : warehouses.find((w) => w.id === whParam)?.name ?? 'Kho không xác định';

  const filterParts = [
    `Kỳ: ${history.period.label}`,
    `Kho: ${whName}`,
    `Loại: ${KIND_FILTER_LABEL[kind] ?? 'Tất cả loại'}`
  ];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'QL Kho Lốp';
  wb.created = new Date();
  const ws = wb.addWorksheet('Lich su', { views: [{ state: 'frozen', ySplit: 7 }] });

  const COLS = 10;
  const lastCol = 'J';

  ws.mergeCells(`A1:${lastCol}1`);
  const title = ws.getCell('A1');
  title.value = 'LỊCH SỬ NHẬP - XUẤT THEO MẶT HÀNG';
  title.font = { bold: true, size: 14 };
  title.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`A2:${lastCol}2`);
  const sub = ws.getCell('A2');
  sub.value = `${product.sku} — ${product.fullName}`;
  sub.font = { bold: true, size: 11 };
  sub.alignment = { horizontal: 'center' };

  ws.mergeCells(`A3:${lastCol}3`);
  const sub2 = ws.getCell('A3');
  sub2.value = filterParts.join(' · ');
  sub2.font = { italic: true };
  sub2.alignment = { horizontal: 'center' };

  // Dải tổng kết
  ws.getRow(5).values = [
    'Tồn đầu kỳ',
    history.totals.opening,
    'Tổng nhập',
    history.totals.inbound,
    'Tổng xuất',
    history.totals.outbound,
    'Tồn cuối kỳ',
    history.totals.closing
  ];
  ws.getRow(5).font = { bold: true };
  for (const col of [1, 3, 5, 7]) {
    ws.getCell(5, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F2F5' } };
  }
  for (const col of [2, 4, 6, 8]) {
    ws.getCell(5, col).alignment = { horizontal: 'right' };
    ws.getCell(5, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FB' } };
  }

  const headers = [
    'TT',
    'Ngày',
    'Kho',
    'Số phiếu',
    'Loại',
    'Khách hàng / Đối tác',
    'Nhập',
    'Xuất',
    'Tồn sau GD',
    'Người tạo'
  ];
  const HEADER_ROW = 7;
  ws.getRow(HEADER_ROW).values = headers;
  ws.getRow(HEADER_ROW).font = { bold: true };
  ws.getRow(HEADER_ROW).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(HEADER_ROW).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F2F5' } };

  history.rows.forEach((r, idx) => {
    ws.getRow(HEADER_ROW + 1 + idx).values = [
      idx + 1,
      formatDate(r.occurredAt),
      r.warehouseCode,
      r.receiptCode ?? '',
      MOVEMENT_KIND_LABEL[r.kind],
      r.partner ?? '',
      r.qtyIn || '',
      r.qtyOut || '',
      r.balanceAfter,
      r.createdByName ?? ''
    ];
  });

  const lastRow = HEADER_ROW + history.rows.length;
  for (let row = HEADER_ROW; row <= lastRow; row++) {
    for (let col = 1; col <= COLS; col++) {
      ws.getCell(row, col).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      if (col >= 7 && col <= 9) ws.getCell(row, col).alignment = { horizontal: 'right' };
    }
  }

  const widths = [5, 12, 10, 16, 16, 28, 10, 10, 13, 20];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `lich-su-${slugify(product.sku)}-${slugify(history.period.label)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
