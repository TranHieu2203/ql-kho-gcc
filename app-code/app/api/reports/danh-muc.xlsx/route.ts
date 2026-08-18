import { NextResponse, type NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db/prisma';
import { validateRequest } from '@/lib/auth/lucia';

/**
 * Xuất danh mục sản phẩm theo đúng bộ lọc đang xem — TOÀN BỘ kết quả, không phân trang.
 * Người dùng thường chỉ xuất được hàng đang áp dụng.
 */
export async function GET(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });
  const isAdmin = user.role === 'ADMIN';

  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim();
  const requested = sp.get('trangThai') ?? 'dang-ap-dung';
  const status = isAdmin && (requested === 'ngung-ap-dung' || requested === 'tat-ca') ? requested : 'dang-ap-dung';

  const statusWhere =
    status === 'dang-ap-dung' ? { active: true } : status === 'ngung-ap-dung' ? { active: false } : {};
  const searchWhere = q
    ? {
        OR: [
          { sku: { contains: q } },
          { fullName: { contains: q } },
          { brand: { contains: q } },
          { size: { contains: q } },
          { pattern: { contains: q } }
        ]
      }
    : {};

  const products = await prisma.product.findMany({
    where: { ...statusWhere, ...searchWhere },
    orderBy: { sku: 'asc' }
  });

  const stockGroups = await prisma.stockMovement.groupBy({
    by: ['productId'],
    where: { productId: { in: products.map((p) => p.id) } },
    _sum: { qtyDelta: true }
  });
  const stockMap = new Map(stockGroups.map((g) => [g.productId, g._sum.qtyDelta ?? 0]));

  const statusLabel =
    status === 'dang-ap-dung' ? 'Đang áp dụng' : status === 'ngung-ap-dung' ? 'Ngừng áp dụng' : 'Tất cả';
  const filterParts = [`Trạng thái: ${statusLabel}`];
  if (q) filterParts.push(`Tìm: "${q}"`);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'QL Kho Lốp';
  wb.created = new Date();
  const ws = wb.addWorksheet('Danh muc', { views: [{ state: 'frozen', ySplit: 4 }] });

  const COLS = 9;
  ws.mergeCells('A1:I1');
  const title = ws.getCell('A1');
  title.value = 'DANH MỤC SẢN PHẨM';
  title.font = { bold: true, size: 14 };
  title.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells('A2:I2');
  const sub = ws.getCell('A2');
  sub.value = `${filterParts.join(' · ')} · ${products.length} sản phẩm`;
  sub.font = { italic: true };
  sub.alignment = { horizontal: 'center' };

  const HEADER_ROW = 4;
  ws.getRow(HEADER_ROW).values = [
    'TT',
    'Mã SKU',
    'Tên đầy đủ',
    'Thương hiệu',
    'Kích thước',
    'Mã gai',
    'ĐVT',
    'Ngưỡng cảnh báo',
    'Tồn tổng'
  ];
  ws.getRow(HEADER_ROW).font = { bold: true };
  ws.getRow(HEADER_ROW).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(HEADER_ROW).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F2F5' } };

  products.forEach((p, idx) => {
    ws.getRow(HEADER_ROW + 1 + idx).values = [
      idx + 1,
      p.sku,
      p.fullName,
      p.brand,
      p.size,
      p.pattern,
      p.defaultUnit === 'BO' ? 'Bộ' : 'Chiếc',
      p.lowStockThreshold,
      stockMap.get(p.id) ?? 0
    ];
  });

  const lastRow = HEADER_ROW + products.length;
  for (let row = HEADER_ROW; row <= lastRow; row++) {
    for (let col = 1; col <= COLS; col++) {
      ws.getCell(row, col).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      if (col >= 8) ws.getCell(row, col).alignment = { horizontal: 'right' };
    }
  }

  const widths = [5, 26, 38, 14, 16, 12, 8, 16, 12];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `danh-muc-san-pham-${status}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
