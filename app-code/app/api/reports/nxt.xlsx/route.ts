import { NextResponse, type NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';

function parseMonth(value: string | null): { from: Date; to: Date; label: string; yearMonth: string } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split('-').map(Number);
    year = y;
    month = m;
  }
  const from = new Date(year, month - 1, 1, 0, 0, 0);
  const to = new Date(year, month, 1, 0, 0, 0);
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  return { from, to, label: `Tháng ${String(month).padStart(2, '0')}/${year}`, yearMonth };
}

export async function GET(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const sp = req.nextUrl.searchParams;
  const { from, to, label, yearMonth } = parseMonth(sp.get('month'));
  const whParam = sp.get('warehouseId') ?? 'ALL';

  const warehouses = user.role === 'ADMIN'
    ? await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } })
    : await getUserWarehouses(user.id).then((ids) =>
        prisma.warehouse.findMany({ where: { id: { in: ids.map((w) => w.id) }, active: true }, orderBy: { code: 'asc' } })
      );
  const selectedWh = whParam !== 'ALL' ? [whParam] : warehouses.map((w) => w.id);

  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { sku: 'asc' } });
  const periodMovements = await prisma.stockMovement.findMany({
    where: { warehouseId: { in: selectedWh }, occurredAt: { gte: from, lt: to } }
  });
  const allMovements = await prisma.stockMovement.findMany({
    where: { warehouseId: { in: selectedWh }, occurredAt: { lt: to } }
  });

  type Row = { sku: string; brand: string; size: string; pattern: string; inbound: number; outbound: number; closing: number };
  const rowMap = new Map<string, Row>();
  for (const p of products) rowMap.set(p.id, { sku: p.sku, brand: p.brand, size: p.size, pattern: p.pattern, inbound: 0, outbound: 0, closing: 0 });
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
  const rows = Array.from(rowMap.values()).filter((r) => r.inbound + r.outbound + r.closing !== 0);
  const totals = rows.reduce(
    (acc, r) => ({ inbound: acc.inbound + r.inbound, outbound: acc.outbound + r.outbound, closing: acc.closing + r.closing }),
    { inbound: 0, outbound: 0, closing: 0 }
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = 'QL Kho Lốp';
  wb.created = new Date();
  const ws = wb.addWorksheet('NXT', { views: [{ state: 'frozen', ySplit: 3 }] });

  // Title
  ws.mergeCells('A1:H1');
  const title = ws.getCell('A1');
  title.value = `BÁO CÁO NHẬP - XUẤT - TỒN`;
  title.font = { bold: true, size: 14 };
  title.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells('A2:H2');
  const subTitle = ws.getCell('A2');
  subTitle.value = `Kỳ: ${label} · ${whParam === 'ALL' ? 'Tất cả các kho' : warehouses.find((w) => w.id === whParam)?.name ?? 'Kho không xác định'}`;
  subTitle.font = { italic: true };
  subTitle.alignment = { horizontal: 'center' };

  // Header row at 4
  const headers = ['TT', 'Mã hàng', 'Thương hiệu', 'Kích thước', 'Mã gai', 'Nhập', 'Xuất', 'Tồn cuối kỳ'];
  ws.getRow(4).values = headers;
  ws.getRow(4).font = { bold: true };
  ws.getRow(4).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F2F5' } };

  // Totals row
  ws.getRow(5).values = ['Tổng cộng', '', '', '', '', totals.inbound, totals.outbound, totals.closing];
  ws.getRow(5).font = { bold: true };
  ws.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FB' } };
  ws.mergeCells('A5:E5');

  rows.forEach((r, idx) => {
    ws.getRow(6 + idx).values = [idx + 1, r.sku, r.brand, r.size, r.pattern, r.inbound, r.outbound, r.closing];
  });

  // Borders
  const lastRow = 5 + rows.length;
  for (let row = 4; row <= lastRow; row++) {
    for (let col = 1; col <= 8; col++) {
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

  // Right-align numbers
  for (let row = 5; row <= lastRow; row++) {
    for (const col of [6, 7, 8]) ws.getCell(row, col).alignment = { horizontal: 'right' };
    ws.getCell(row, 2).font = { name: 'Consolas' };
  }

  const buffer = await wb.xlsx.writeBuffer();

  const whSuffix = whParam === 'ALL' ? 'tat-ca-kho' : (warehouses.find((w) => w.id === whParam)?.code ?? 'kho').toLowerCase();
  const filename = `bao-cao-nxt-${yearMonth}-${whSuffix}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
