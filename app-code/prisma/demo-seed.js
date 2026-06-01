/**
 * Seed demo data ~30 ngày hoạt động kho lốp.
 * Idempotent: chạy lại sẽ skip phiếu đã tạo (dedupe qua clientRequestId).
 *
 * Usage:
 *   node prisma/demo-seed.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Khách hàng giả định (free-text theo brief)
const CUSTOMERS = [
  'Hải - Nghệ An',
  'Hồng Anh - Bắc Ninh',
  'Tuấn Thành - Hà Nam',
  'Minh - Hải Dương',
  'Khang - Bắc Giang',
  'Sơn - Hưng Yên',
  'Phong - Thái Bình'
];

const SUPPLIERS = ['NCC Khang Minh', 'NCC Phú Thái', 'NCC Hoà Phát'];

function pick(arr, i) { return arr[i % arr.length]; }

async function ensureSeed() {
  // Skip nếu DB đã có > 50 receipts (đã seed rồi)
  const exist = await p.receipt.count();
  if (exist >= 50) {
    console.log(`[demo-seed] DB đã có ${exist} phiếu — bỏ qua seed (đã chạy trước đó).`);
    return;
  }

  const admin = await p.user.findFirst({ where: { role: 'ADMIN' } });
  const products = await p.product.findMany({ orderBy: { sku: 'asc' } });
  const warehouses = await p.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } });

  if (!admin || products.length === 0 || warehouses.length < 1) {
    console.error('[demo-seed] DB chưa đủ admin/product/warehouse. Chạy `npm run db:seed` trước.');
    process.exit(1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let inboundCount = 0;
  let outboundCount = 0;
  let transferCount = 0;

  // === 30 ngày trước → hôm nay ===
  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    const dayKey = date.toISOString().slice(0, 10);

    // 1-2 phiếu nhập/ngày (2/3 ngày)
    if (dayOffset % 3 !== 0) {
      const wh = warehouses[dayOffset % warehouses.length];
      const lines = [];
      const numLines = 1 + (dayOffset % 3);
      for (let i = 0; i < numLines; i++) {
        const prod = products[(dayOffset * 3 + i) % products.length];
        lines.push({
          productId: prod.id,
          unit: 'BO',
          quantity: 10 + ((dayOffset + i) % 5) * 10  // 10-50
        });
      }
      const code = `IN-DEMO-${dayKey}-${wh.code}`;
      const requestId = `DEMO_SEED:INBOUND:${dayKey}:${wh.id}`;
      const exists = await p.receipt.findUnique({ where: { clientRequestId: requestId } });
      if (!exists) {
        await p.$transaction(async (tx) => {
          const receipt = await tx.receipt.create({
            data: {
              code,
              type: 'INBOUND',
              status: 'CONFIRMED',
              warehouseId: wh.id,
              date,
              customerOrPartner: pick(SUPPLIERS, dayOffset),
              note: `Lô hàng ngày ${dayKey}`,
              createdById: admin.id,
              clientRequestId: requestId,
              confirmedAt: date,
              lines: { create: lines }
            }
          });
          for (const ln of lines) {
            await tx.stockMovement.create({
              data: {
                warehouseId: wh.id,
                productId: ln.productId,
                unit: ln.unit,
                qtyDelta: ln.quantity,
                source: 'RECEIPT',
                sourceId: receipt.id,
                occurredAt: date
              }
            });
          }
        });
        inboundCount++;
      }
    }

    // 1-2 phiếu xuất/ngày (3/4 ngày, không trùng cả ngày trước)
    if (dayOffset % 4 !== 1) {
      const wh = warehouses[(dayOffset + 1) % warehouses.length];
      const customer = pick(CUSTOMERS, dayOffset);

      // Chỉ chọn product có tồn (kiểm tra rough)
      const candidates = [];
      for (const prod of products) {
        const total = await p.stockMovement.aggregate({
          _sum: { qtyDelta: true },
          where: { warehouseId: wh.id, productId: prod.id, occurredAt: { lte: date } }
        });
        if ((total._sum.qtyDelta ?? 0) >= 10) candidates.push(prod);
      }
      if (candidates.length === 0) continue;

      const lines = [];
      const numLines = 1 + (dayOffset % 2);
      for (let i = 0; i < numLines && i < candidates.length; i++) {
        const prod = candidates[(dayOffset + i) % candidates.length];
        const total = await p.stockMovement.aggregate({
          _sum: { qtyDelta: true },
          where: { warehouseId: wh.id, productId: prod.id, occurredAt: { lte: date } }
        });
        const available = total._sum.qtyDelta ?? 0;
        const qty = Math.min(available, 5 + ((dayOffset + i) % 4) * 5);
        if (qty > 0) {
          lines.push({ productId: prod.id, unit: 'BO', quantity: qty });
        }
      }
      if (lines.length === 0) continue;

      const code = `OUT-DEMO-${dayKey}-${wh.code}-${dayOffset}`;
      const requestId = `DEMO_SEED:OUTBOUND:${dayKey}:${wh.id}:${customer}`;
      const exists = await p.receipt.findUnique({ where: { clientRequestId: requestId } });
      if (!exists) {
        await p.$transaction(async (tx) => {
          const receipt = await tx.receipt.create({
            data: {
              code,
              type: 'OUTBOUND',
              status: 'CONFIRMED',
              warehouseId: wh.id,
              date,
              customerOrPartner: customer,
              note: `Giao cho ${customer}`,
              createdById: admin.id,
              clientRequestId: requestId,
              confirmedAt: date,
              lines: { create: lines }
            }
          });
          for (const ln of lines) {
            await tx.stockMovement.create({
              data: {
                warehouseId: wh.id,
                productId: ln.productId,
                unit: ln.unit,
                qtyDelta: -ln.quantity,
                source: 'RECEIPT',
                sourceId: receipt.id,
                occurredAt: date
              }
            });
          }
        });
        outboundCount++;
      }
    }

    // Phiếu chuyển kho mỗi 7 ngày (nếu có >= 2 kho)
    if (warehouses.length >= 2 && dayOffset % 7 === 3) {
      const from = warehouses[0];
      const to = warehouses[1];
      const prod = products[dayOffset % products.length];

      const total = await p.stockMovement.aggregate({
        _sum: { qtyDelta: true },
        where: { warehouseId: from.id, productId: prod.id, occurredAt: { lte: date } }
      });
      const available = total._sum.qtyDelta ?? 0;
      if (available < 10) continue;
      const qty = Math.min(available, 10 + (dayOffset % 3) * 5);

      const code = `TR-DEMO-${dayKey}-${from.code}-${to.code}`;
      const requestId = `DEMO_SEED:TRANSFER:${dayKey}:${from.id}:${to.id}`;
      const exists = await p.receipt.findUnique({ where: { clientRequestId: requestId } });
      if (!exists) {
        await p.$transaction(async (tx) => {
          const receipt = await tx.receipt.create({
            data: {
              code,
              type: 'TRANSFER',
              status: 'CONFIRMED',
              warehouseId: from.id,
              fromWarehouseId: from.id,
              toWarehouseId: to.id,
              date,
              note: 'Chuyển bù tồn (demo)',
              createdById: admin.id,
              clientRequestId: requestId,
              confirmedAt: date,
              lines: { create: [{ productId: prod.id, unit: 'BO', quantity: qty }] }
            }
          });
          // -from
          await tx.stockMovement.create({
            data: {
              warehouseId: from.id, productId: prod.id, unit: 'BO',
              qtyDelta: -qty, source: 'RECEIPT', sourceId: receipt.id, occurredAt: date
            }
          });
          // +to
          await tx.stockMovement.create({
            data: {
              warehouseId: to.id, productId: prod.id, unit: 'BO',
              qtyDelta: qty, source: 'RECEIPT', sourceId: receipt.id, occurredAt: date
            }
          });
        });
        transferCount++;
      }
    }
  }

  console.log(`[demo-seed] OK — đã thêm: ${inboundCount} phiếu nhập + ${outboundCount} phiếu xuất + ${transferCount} phiếu chuyển kho`);
  const finalCount = await p.receipt.count();
  console.log(`[demo-seed] Tổng phiếu hiện có trong DB: ${finalCount}`);
}

ensureSeed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await p.$disconnect(); });
