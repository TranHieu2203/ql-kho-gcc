import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db/prisma';
import { validateRequest } from '@/lib/auth/lucia';

export const runtime = 'nodejs';

export async function GET() {
  const { user } = await validateRequest();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  // Fetch warehouse codes to embed as hint in template
  const warehouses = await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } });
  const whCodes = warehouses.map((w) => w.code).join(', ') || '(chưa có kho — tạo kho ở /quan-tri/kho trước)';
  const exampleWh1 = warehouses[0]?.code ?? 'WH-HN';
  const exampleWh2 = warehouses[1]?.code ?? warehouses[0]?.code ?? 'WH-BN';

  const wb = new ExcelJS.Workbook();
  wb.creator = 'QL Kho Lốp';
  wb.created = new Date();

  // === Helper ===
  const HEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F0FB' } // primary-soft
  };
  const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF1E5FB4' } };
  const BORDER: ExcelJS.Borders = {
    top: { style: 'thin', color: { argb: 'FFE2E5EB' } },
    left: { style: 'thin', color: { argb: 'FFE2E5EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E5EB' } },
    right: { style: 'thin', color: { argb: 'FFE2E5EB' } }
  } as ExcelJS.Borders;

  function styleHeader(ws: ExcelJS.Worksheet, rowIdx: number, colCount: number) {
    const row = ws.getRow(rowIdx);
    row.font = HEADER_FONT;
    row.fill = HEADER_FILL;
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 22;
    for (let c = 1; c <= colCount; c++) row.getCell(c).border = BORDER;
  }

  function addReadmeBox(ws: ExcelJS.Worksheet, startRow: number, lines: string[]) {
    lines.forEach((text, i) => {
      const row = ws.getRow(startRow + i);
      row.getCell(1).value = text;
      row.font = { italic: true, color: { argb: 'FF5A6473' }, size: 10 };
    });
  }

  // ============================
  // Sheet 0: HƯỚNG DẪN
  // ============================
  const guide = wb.addWorksheet('HƯỚNG DẪN', {
    properties: { tabColor: { argb: 'FF1E5FB4' } },
    views: [{ showGridLines: false }]
  });
  guide.columns = [{ width: 110 }];
  const guideLines = [
    'TEMPLATE IMPORT — Phần mềm Quản lý Kho Lốp (ql-kho-gcc)',
    '',
    'File này có 4 sheet dữ liệu:',
    '  1. DANH MỤC      — danh sách sản phẩm (SKU master)',
    '  2. NHẬP KHO      — phiếu nhập kho lịch sử',
    '  3. XUẤT KHO      — phiếu xuất kho lịch sử',
    '  4. CHUYỂN KHO    — phiếu chuyển kho giữa các kho',
    '',
    'CÁCH ĐIỀN:',
    '  • Mỗi sheet có 1 dòng tiêu đề (header) và 2-3 dòng ví dụ — XÓA các dòng ví dụ trước khi điền dữ liệu thật.',
    '  • Cột bắt đầu bằng dấu * là BẮT BUỘC.',
    '  • Mỗi sản phẩm trong DANH MỤC phải có Mã SKU duy nhất. Khi import phiếu Nhập/Xuất/Chuyển, Mã SKU phải khớp với DANH MỤC.',
    '  • Ngày có thể nhập dạng ô Date hoặc text dd/mm/yyyy (vd 31/05/2026).',
    '  • Số lượng là số nguyên dương ≤ 9999.',
    '  • ĐVT chỉ chấp nhận "Bộ" hoặc "Chiếc". Nếu để trống mặc định là "Bộ".',
    '',
    `MÃ KHO HIỆN CÓ: ${whCodes}`,
    '  → Cột "TỪ KHO" và "ĐẾN KHO" trong sheet CHUYỂN KHO phải dùng mã kho này.',
    '  → Nếu cần thêm kho, vào /quan-tri/kho trước khi import.',
    '',
    'IDEMPOTENT (import lại nhiều lần không sợ trùng):',
    '  • Phiếu Nhập/Xuất nhóm theo (loại + ngày + kho). Re-import cùng file → tự skip phiếu trùng.',
    '  • Phiếu Chuyển nhóm theo (ngày + từ-kho + đến-kho). Tương tự.',
    '  • Sản phẩm dedupe theo SKU.',
    '',
    'CHÍNH SÁCH KHI CÓ LỖI (chọn ở bước 3):',
    '  • Bỏ qua dòng lỗi và import dòng hợp lệ (mặc định)',
    '  • Huỷ toàn bộ nếu có lỗi',
    '  • Có thể tải file LỖI sau khi validate để sửa offline rồi import lại',
    '',
    'TRANG WEB IMPORT: /danh-muc/import (yêu cầu quyền Quản trị)'
  ];
  addReadmeBox(guide, 1, guideLines);
  guide.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E5FB4' } };

  // ============================
  // Sheet 1: DANH MỤC
  // ============================
  const cat = wb.addWorksheet('DANH MỤC', { properties: { tabColor: { argb: 'FF15803D' } } });
  cat.columns = [
    { header: '* MÃ HÀNG', key: 'sku', width: 28 },
    { header: '* THƯƠNG HIỆU', key: 'brand', width: 16 },
    { header: '* KÍCH THƯỚC (Size)', key: 'size', width: 20 },
    { header: '* MÃ GAI (Pattern)', key: 'pattern', width: 14 },
    { header: 'TÊN ĐẦY ĐỦ (tuỳ chọn)', key: 'fullName', width: 36 }
  ];
  styleHeader(cat, 1, 5);
  cat.addRow({ sku: 'KV789H3 1200R20 24PR', brand: 'KOIVI', size: '1200R20 24PR', pattern: 'KV789H3', fullName: 'LỐP KOIVI 1200R20 KV789 H3' });
  cat.addRow({ sku: 'GD639 1100R20 18PR', brand: 'GASVIDO', size: '1100R20 18PR', pattern: 'GD639', fullName: 'LỐP GASVIDO 1100R20 GD639' });
  // Note row at bottom
  const catNote = cat.addRow(['XÓA 2 dòng ví dụ trên trước khi điền dữ liệu thật.']);
  catNote.font = { italic: true, color: { argb: 'FFB45309' }, size: 9 };
  cat.mergeCells(`A${catNote.number}:E${catNote.number}`);

  // ============================
  // Sheet 2: NHẬP KHO
  // ============================
  const inb = wb.addWorksheet('NHẬP KHO', { properties: { tabColor: { argb: 'FF1D4ED8' } } });
  inb.columns = [
    { header: '* NGÀY', key: 'date', width: 14 },
    { header: '* MÃ HÀNG', key: 'sku', width: 28 },
    { header: 'ĐVT', key: 'unit', width: 8 },
    { header: '* SỐ LƯỢNG', key: 'quantity', width: 12 },
    { header: 'GHI CHÚ', key: 'note', width: 36 }
  ];
  styleHeader(inb, 1, 5);
  inb.addRow({ date: new Date(), sku: 'KV789H3 1200R20 24PR', unit: 'Bộ', quantity: 30, note: 'NCC Khang Minh' });
  inb.addRow({ date: new Date(), sku: 'GD639 1100R20 18PR', unit: 'Bộ', quantity: 50, note: '' });
  inb.getColumn('date').numFmt = 'dd/mm/yyyy';
  inb.getColumn('quantity').alignment = { horizontal: 'right' };
  const inbNote = inb.addRow(['Kho đích của phiếu Nhập sẽ được chọn trong wizard import (bước 2).']);
  inbNote.font = { italic: true, color: { argb: 'FFB45309' }, size: 9 };
  inb.mergeCells(`A${inbNote.number}:E${inbNote.number}`);

  // ============================
  // Sheet 3: XUẤT KHO
  // ============================
  const out = wb.addWorksheet('XUẤT KHO', { properties: { tabColor: { argb: 'FFB91C1C' } } });
  out.columns = [
    { header: '* NGÀY', key: 'date', width: 14 },
    { header: '* MÃ HÀNG', key: 'sku', width: 28 },
    { header: 'ĐVT', key: 'unit', width: 8 },
    { header: '* SỐ LƯỢNG', key: 'quantity', width: 12 },
    { header: 'KHÁCH HÀNG / NGƯỜI NHẬN', key: 'customer', width: 28 },
    { header: 'GHI CHÚ', key: 'note', width: 30 }
  ];
  styleHeader(out, 1, 6);
  out.addRow({ date: new Date(), sku: 'KV789H3 1200R20 24PR', unit: 'Bộ', quantity: 10, customer: 'Hải - Nghệ An', note: '' });
  out.addRow({ date: new Date(), sku: 'GD639 1100R20 18PR', unit: 'Bộ', quantity: 5, customer: 'Hồng Anh - Bắc Ninh', note: 'Hàng mẫu' });
  out.getColumn('date').numFmt = 'dd/mm/yyyy';
  out.getColumn('quantity').alignment = { horizontal: 'right' };
  const outNote = out.addRow(['Kho xuất sẽ được chọn trong wizard import (bước 2).']);
  outNote.font = { italic: true, color: { argb: 'FFB45309' }, size: 9 };
  out.mergeCells(`A${outNote.number}:F${outNote.number}`);

  // ============================
  // Sheet 4: CHUYỂN KHO
  // ============================
  const tr = wb.addWorksheet('CHUYỂN KHO', { properties: { tabColor: { argb: 'FF92400E' } } });
  tr.columns = [
    { header: '* NGÀY', key: 'date', width: 14 },
    { header: '* MÃ HÀNG', key: 'sku', width: 28 },
    { header: '* TỪ KHO (mã)', key: 'fromWh', width: 14 },
    { header: '* ĐẾN KHO (mã)', key: 'toWh', width: 14 },
    { header: 'ĐVT', key: 'unit', width: 8 },
    { header: '* SỐ LƯỢNG', key: 'quantity', width: 12 },
    { header: 'GHI CHÚ', key: 'note', width: 30 }
  ];
  styleHeader(tr, 1, 7);
  tr.addRow({ date: new Date(), sku: 'GA518 1200R20 20PR', fromWh: exampleWh1, toWh: exampleWh2, unit: 'Bộ', quantity: 20, note: 'Chuyển bù cho đơn BN' });
  tr.addRow({ date: new Date(), sku: 'GD737 1200R20 20PR', fromWh: exampleWh1, toWh: exampleWh2, unit: 'Bộ', quantity: 5, note: '' });
  tr.getColumn('date').numFmt = 'dd/mm/yyyy';
  tr.getColumn('quantity').alignment = { horizontal: 'right' };
  tr.getColumn('fromWh').font = { name: 'Consolas' };
  tr.getColumn('toWh').font = { name: 'Consolas' };
  const trNote = tr.addRow([`Mã kho hợp lệ: ${whCodes}. Phiếu chuyển sẽ được tạo ở trạng thái "Đang đi"; kho đến cần xác nhận nhận hàng để hoàn tất.`]);
  trNote.font = { italic: true, color: { argb: 'FFB45309' }, size: 9 };
  tr.mergeCells(`A${trNote.number}:G${trNote.number}`);

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ql-kho-template.xlsx"`
    }
  });
}
