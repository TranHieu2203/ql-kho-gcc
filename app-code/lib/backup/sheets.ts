/**
 * Backup data lên Google Sheets.
 *
 * Cách xác thực: Service Account JSON (bot Google account).
 *   1. Tạo Service Account trong Google Cloud Console → tạo key JSON
 *   2. Tạo Google Sheet → Share với email service account (vd: ql-kho-bot@xxx.iam.gserviceaccount.com)
 *   3. Copy spreadsheet ID từ URL (https://docs.google.com/spreadsheets/d/{ID}/edit)
 *   4. Upload JSON + paste ID vào /quan-tri/backup
 *
 * Mỗi lần backup: clear toàn bộ sheet rồi ghi dữ liệu mới (overwrite snapshot).
 * Tab `Backups Log` được append (lịch sử các lần backup) thay vì overwrite.
 */
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import { prisma } from '@/lib/db/prisma';

type SnapshotData = {
  products: any[][];
  warehouses: any[][];
  users: any[][];
  receipts: any[][];
  receiptLines: any[][];
  stockMovements: any[][];
  currentStock: any[][];
  meta: any[][];
};

function fmt(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toISOString().replace('T', ' ').slice(0, 19);
}

function unitVN(u: string): string {
  return u === 'CHIEC' ? 'Chiếc' : 'Bộ';
}

/**
 * Đọc toàn bộ DB và trả về snapshot dạng arrays (row-major).
 */
export async function buildSnapshot(): Promise<SnapshotData> {
  const [products, warehouses, users, receipts, lines, movements] = await Promise.all([
    prisma.product.findMany({ orderBy: { sku: 'asc' } }),
    prisma.warehouse.findMany({ orderBy: { code: 'asc' } }),
    prisma.user.findMany({ orderBy: { username: 'asc' } }),
    prisma.receipt.findMany({
      orderBy: { date: 'desc' },
      include: {
        warehouse: { select: { code: true } },
        fromWarehouse: { select: { code: true } },
        toWarehouse: { select: { code: true } },
        createdBy: { select: { username: true, fullName: true } }
      }
    }),
    prisma.receiptLine.findMany({
      include: {
        receipt: { select: { code: true } },
        product: { select: { sku: true } }
      }
    }),
    prisma.stockMovement.findMany({
      orderBy: { occurredAt: 'desc' },
      include: {
        warehouse: { select: { code: true } },
        product: { select: { sku: true } }
      }
    })
  ]);

  // Compute current stock per (warehouse, product)
  const stockMap = new Map<string, { wh: string; sku: string; qty: number }>();
  for (const m of movements) {
    const key = `${m.warehouse.code}|${m.product.sku}`;
    const ex = stockMap.get(key);
    if (ex) ex.qty += m.qtyDelta;
    else stockMap.set(key, { wh: m.warehouse.code, sku: m.product.sku, qty: m.qtyDelta });
  }
  const currentStock: any[][] = [
    ['Kho', 'Mã hàng', 'Tồn']
  ];
  for (const v of [...stockMap.values()].sort((a, b) => a.wh.localeCompare(b.wh) || a.sku.localeCompare(b.sku))) {
    currentStock.push([v.wh, v.sku, v.qty]);
  }

  return {
    products: [
      ['Mã hàng', 'Tên đầy đủ', 'Thương hiệu', 'Kích thước', 'Mã gai', 'ĐVT', 'Ngưỡng tồn thấp', 'Đang hoạt động', 'Tạo lúc'],
      ...products.map((p) => [p.sku, p.fullName, p.brand, p.size, p.pattern, unitVN(p.defaultUnit), p.lowStockThreshold, p.active, fmt(p.createdAt)])
    ],
    warehouses: [
      ['Mã kho', 'Tên kho', 'Địa chỉ', 'Đang hoạt động', 'Tạo lúc'],
      ...warehouses.map((w) => [w.code, w.name, w.address ?? '', w.active, fmt(w.createdAt)])
    ],
    users: [
      // KHÔNG export passwordHash
      ['Tên đăng nhập', 'Họ tên', 'Vai trò', 'Đang hoạt động', 'Tạo lúc'],
      ...users.map((u) => [u.username, u.fullName, u.role, u.active, fmt(u.createdAt)])
    ],
    receipts: [
      ['Mã phiếu', 'Loại', 'Trạng thái', 'Kho', 'Từ kho', 'Đến kho', 'Ngày', 'KH/Đối tác', 'Ghi chú', 'Người tạo', 'Tạo lúc', 'Xác nhận lúc'],
      ...receipts.map((r) => [
        r.code, r.type, r.status, r.warehouse.code, r.fromWarehouse?.code ?? '', r.toWarehouse?.code ?? '',
        fmt(r.date), r.customerOrPartner ?? '', r.note ?? '', r.createdBy.username, fmt(r.createdAt), fmt(r.confirmedAt)
      ])
    ],
    receiptLines: [
      ['Mã phiếu', 'Mã hàng', 'ĐVT', 'Số lượng', 'Ghi chú dòng'],
      ...lines.map((l) => [l.receipt.code, l.product.sku, unitVN(l.unit), l.quantity, l.lineNote ?? ''])
    ],
    stockMovements: [
      ['Thời gian', 'Kho', 'Mã hàng', 'ĐVT', 'Delta', 'Nguồn'],
      ...movements.slice(0, 50_000).map((m) => [
        fmt(m.occurredAt), m.warehouse.code, m.product.sku, unitVN(m.unit), m.qtyDelta, m.source
      ])
    ],
    currentStock,
    meta: [
      ['Trường', 'Giá trị'],
      ['Ngày backup', fmt(new Date())],
      ['Phiên bản schema', '1'],
      ['Số sản phẩm', products.length],
      ['Số kho', warehouses.length],
      ['Số user', users.length],
      ['Số phiếu', receipts.length],
      ['Số line', lines.length],
      ['Số movement', movements.length],
      ['Lưu ý', 'Không export mật khẩu hash. Snapshot ghi đè toàn bộ tab dữ liệu mỗi lần backup.']
    ]
  };
}

function buildSheetsClient(serviceAccountJson: string) {
  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Test kết nối: gọi spreadsheets.get để xác nhận có quyền + tên file.
 */
export async function testBackupConnection(saJson: string, spreadsheetId: string): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  try {
    const sheets = buildSheetsClient(saJson);
    const r = await sheets.spreadsheets.get({ spreadsheetId, fields: 'properties.title,sheets.properties.title' });
    return { ok: true, title: r.data.properties?.title ?? '(không tên)' };
  } catch (e: any) {
    return { ok: false, error: extractGoogleError(e) };
  }
}

function extractGoogleError(e: any): string {
  if (e?.response?.data?.error) {
    const d = e.response.data.error;
    if (d.code === 403) return 'Service account không có quyền — share spreadsheet với email service account.';
    if (d.code === 404) return 'Spreadsheet ID không tồn tại hoặc sai.';
    return `${d.code}: ${d.message}`;
  }
  if (e?.message) return e.message;
  return 'Lỗi không xác định khi gọi Google API.';
}

/**
 * Đảm bảo tab (sheet trong workbook) tồn tại. Trả về sheetId number.
 */
async function ensureSheet(sheets: sheets_v4.Sheets, spreadsheetId: string, title: string, existing: sheets_v4.Schema$Sheet[]): Promise<number> {
  const found = existing.find((s) => s.properties?.title === title);
  if (found?.properties?.sheetId != null) return found.properties.sheetId;
  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] }
  });
  return res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
}

/**
 * Ghi toàn bộ snapshot lên spreadsheet đích.
 * - Tab dữ liệu (Products, Warehouses, ...): clear + write (overwrite).
 * - Tab `Backups Log`: append 1 dòng lịch sử (KHÔNG clear).
 */
export async function pushBackupToSheet(saJson: string, spreadsheetId: string): Promise<{ ok: true; rowCounts: Record<string, number>; tookMs: number } | { ok: false; error: string }> {
  const t0 = Date.now();
  try {
    const sheets = buildSheetsClient(saJson);
    const snap = await buildSnapshot();

    const targets: { title: string; values: any[][] }[] = [
      { title: 'Meta', values: snap.meta },
      { title: 'Products', values: snap.products },
      { title: 'Warehouses', values: snap.warehouses },
      { title: 'Users', values: snap.users },
      { title: 'CurrentStock', values: snap.currentStock },
      { title: 'Receipts', values: snap.receipts },
      { title: 'ReceiptLines', values: snap.receiptLines },
      { title: 'StockMovements', values: snap.stockMovements }
    ];

    // Get existing sheets to avoid re-adding
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
    const existing = meta.data.sheets ?? [];

    // Ensure all needed tabs exist
    for (const t of targets) {
      await ensureSheet(sheets, spreadsheetId, t.title, existing);
    }
    await ensureSheet(sheets, spreadsheetId, 'Backups Log', existing);

    // Clear + write each data tab
    const rowCounts: Record<string, number> = {};
    for (const t of targets) {
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${t.title}!A:Z` });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${t.title}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: t.values }
      });
      rowCounts[t.title] = Math.max(0, t.values.length - 1); // -1 for header
    }

    // Append to Backups Log
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Backups Log!A1',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [
          [
            fmt(new Date()),
            'OK',
            Object.entries(rowCounts).map(([k, v]) => `${k}=${v}`).join(', '),
            `${Date.now() - t0}ms`
          ]
        ]
      }
    });

    return { ok: true, rowCounts, tookMs: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, error: extractGoogleError(e) };
  }
}
