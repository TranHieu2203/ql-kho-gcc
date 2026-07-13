import { NextResponse, type NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { runNxtReport, type NxtFilters } from '@/lib/domain/nxt-report';

export async function GET(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const sp = req.nextUrl.searchParams;
  const filters: NxtFilters = {
    preset: (sp.get('preset') as any) || undefined,
    month: sp.get('month') ?? undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
    warehouseId: sp.get('warehouseId') ?? undefined,
    q: sp.get('q') ?? undefined,
    brand: sp.get('brand') ?? undefined,
    stockState: (sp.get('stockState') as any) || 'all',
    activeOnly: (sp.get('activeOnly') as any) || '1',
    sort: (sp.get('sort') as any) || 'sku'
  };

  const warehouses = user.role === 'ADMIN'
    ? await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } })
    : await getUserWarehouses(user.id).then((ids) =>
        prisma.warehouse.findMany({ where: { id: { in: ids.map((w) => w.id) }, active: true }, orderBy: { code: 'asc' } })
      );
  const userWhIds = warehouses.map((w) => w.id);

  const result = await runNxtReport(filters, userWhIds);

  const whParam = filters.warehouseId ?? 'ALL';
  const whName = whParam === 'ALL' || !whParam
    ? 'Tất cả các kho'
    : warehouses.find((w) => w.id === whParam)?.name ?? 'Kho không xác định';

  // Build filter summary line
  const filterParts: string[] = [`Kỳ: ${result.period.label}`, `Kho: ${whName}`];
  if (filters.q) filterParts.push(`Tìm: "${filters.q}"`);
  if (filters.brand && filters.brand !== 'ALL') filterParts.push(`Thương hiệu: ${filters.brand}`);
  if (filters.stockState && filters.stockState !== 'all') {
    const stMap: Record<string, string> = { ok: 'Đủ tồn', low: 'Sắp hết', out: 'Hết hàng' };
    filterParts.push(`Trạng thái: ${stMap[filters.stockState] ?? filters.stockState}`);
  }
  if (filters.activeOnly === '1') filterParts.push('Chỉ SP có hoạt động');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'QL Kho Lốp';
  wb.created = new Date();
  const ws = wb.addWorksheet('NXT', { views: [{ state: 'frozen', ySplit: 3 }] });

  // Title
  ws.mergeCells('A1:I1');
  const title = ws.getCell('A1');
  title.value = `BÁO CÁO NHẬP - XUẤT - TỒN`;
  title.font = { bold: true, size: 14 };
  title.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells('A2:I2');
  const subTitle = ws.getCell('A2');
  subTitle.value = filterParts.join(' · ');
  subTitle.font = { italic: true };
  subTitle.alignment = { horizontal: 'center' };

  // Header row at 4
  const headers = ['TT', 'Mã hàng', 'Thương hiệu', 'Kích thước', 'Mã gai', 'Nhập', 'Xuất', 'Tồn cuối kỳ', 'Trạng thái'];
  ws.getRow(4).values = headers;
  ws.getRow(4).font = { bold: true };
  ws.getRow(4).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F2F5' } };

  // Totals row
  ws.getRow(5).values = ['Tổng cộng', '', '', '', '', result.totals.inbound, result.totals.outbound, result.totals.closing, ''];
  ws.getRow(5).font = { bold: true };
  ws.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FB' } };
  ws.mergeCells('A5:E5');

  result.rows.forEach((r, idx) => {
    const st = r.closing <= 0 ? 'Hết' : r.closing < r.lowStockThreshold ? 'Sắp hết' : 'Đủ';
    ws.getRow(6 + idx).values = [idx + 1, r.sku, r.brand, r.size, r.pattern, r.inbound, r.outbound, r.closing, st];
    // Màu tag trạng thái
    const cell = ws.getCell(6 + idx, 9);
    if (st === 'Hết') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDECEC' } };
    else if (st === 'Sắp hết') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7E0' } };
    else cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5F6EB' } };
  });

  // Borders
  const lastRow = 5 + result.rows.length;
  for (let row = 4; row <= lastRow; row++) {
    for (let col = 1; col <= 9; col++) {
      ws.getCell(row, col).border = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    }
  }

  // Column widths
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 10;
  ws.getColumn(7).width = 10;
  ws.getColumn(8).width = 14;
  ws.getColumn(9).width = 12;

  // Right-align numbers
  for (let row = 5; row <= lastRow; row++) {
    for (const col of [6, 7, 8]) ws.getCell(row, col).alignment = { horizontal: 'right' };
    ws.getCell(row, 9).alignment = { horizontal: 'center' };
    ws.getCell(row, 2).font = { name: 'Consolas' };
  }

  const buffer = await wb.xlsx.writeBuffer();

  // Filename: dùng period label để chuẩn
  const periodSlug = result.period.label
    .replace(/[^\w\d]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const whSuffix = whParam === 'ALL' || !whParam
    ? 'tat-ca-kho'
    : (warehouses.find((w) => w.id === whParam)?.code ?? 'kho').toLowerCase();
  const filename = `bao-cao-nxt-${periodSlug}-${whSuffix}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
