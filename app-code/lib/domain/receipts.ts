import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
import { generateReceiptCode } from '@/lib/utils';

export type ReceiptType = 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT';

export type LineInput = {
  productId: string;
  unit: 'BO' | 'CHIEC';
  quantity: number;
  lineNote?: string | null;
};

export type CreateReceiptInput = {
  type: ReceiptType;
  warehouseId: string;            // for INBOUND/OUTBOUND/ADJUSTMENT, or "from" warehouse of TRANSFER
  fromWarehouseId?: string | null; // TRANSFER only
  toWarehouseId?: string | null;   // TRANSFER only
  date: Date;
  customerOrPartner?: string | null;
  note?: string | null;
  lines: LineInput[];
  createdById: string;
  clientRequestId?: string | null;
};

export async function getNextReceiptSequence(tx: Prisma.TransactionClient, type: ReceiptType, year: number): Promise<number> {
  const prefix = { INBOUND: 'IN', OUTBOUND: 'OUT', TRANSFER: 'TR', ADJUSTMENT: 'ADJ' }[type];
  const last = await tx.receipt.findFirst({
    where: { type, code: { startsWith: `${prefix}-${year}-` } },
    orderBy: { code: 'desc' }
  });
  if (!last) return 1;
  const seq = parseInt(last.code.split('-').pop() ?? '0', 10);
  return Number.isFinite(seq) ? seq + 1 : 1;
}

/**
 * Compute current stock for a (warehouse, product) — sum of all movements.
 */
export async function computeStock(
  tx: Prisma.TransactionClient | typeof prisma,
  warehouseId: string,
  productId: string,
  asOf?: Date
): Promise<number> {
  const result = await tx.stockMovement.aggregate({
    _sum: { qtyDelta: true },
    where: {
      warehouseId,
      productId,
      ...(asOf ? { occurredAt: { lte: asOf } } : {})
    }
  });
  return result._sum.qtyDelta ?? 0;
}

export async function createInboundOutbound(input: CreateReceiptInput, overstockPolicy: 'warn' | 'block') {
  if (input.type !== 'INBOUND' && input.type !== 'OUTBOUND' && input.type !== 'ADJUSTMENT') {
    throw new Error('Wrong type for createInboundOutbound');
  }

  // Idempotency check
  if (input.clientRequestId) {
    const existing = await prisma.receipt.findUnique({ where: { clientRequestId: input.clientRequestId } });
    if (existing) return { receipt: existing, deduped: true };
  }

  return await prisma.$transaction(async (tx) => {
    // Block-mode check for OUTBOUND
    if (input.type === 'OUTBOUND' && overstockPolicy === 'block') {
      for (const ln of input.lines) {
        const cur = await computeStock(tx, input.warehouseId, ln.productId);
        if (cur < ln.quantity) {
          throw new OverstockError(ln.productId, cur, ln.quantity);
        }
      }
    }

    const seq = await getNextReceiptSequence(tx, input.type, input.date.getFullYear());
    const code = generateReceiptCode(input.type, seq, input.date.getFullYear());

    const receipt = await tx.receipt.create({
      data: {
        code,
        type: input.type,
        status: 'CONFIRMED',
        warehouseId: input.warehouseId,
        date: input.date,
        customerOrPartner: input.customerOrPartner ?? null,
        note: input.note ?? null,
        createdById: input.createdById,
        clientRequestId: input.clientRequestId ?? null,
        confirmedAt: new Date(),
        lines: { create: input.lines.map((l) => ({ productId: l.productId, unit: l.unit, quantity: l.quantity, lineNote: l.lineNote ?? null })) }
      }
    });

    const sign = input.type === 'INBOUND' ? 1 : input.type === 'OUTBOUND' ? -1 : 1; // ADJUSTMENT can have either sign — but qty input is positive; handle separately if needed
    for (const ln of input.lines) {
      await tx.stockMovement.create({
        data: {
          warehouseId: input.warehouseId,
          productId: ln.productId,
          unit: ln.unit,
          qtyDelta: ln.quantity * sign,
          source: 'RECEIPT',
          sourceId: receipt.id,
          occurredAt: input.date
        }
      });
    }

    return { receipt, deduped: false };
  });
}

export class OverstockError extends Error {
  constructor(public productId: string, public currentStock: number, public requested: number) {
    super('OVERSTOCK');
  }
}

export class BackdateWarning extends Error {
  constructor(public issues: { sku: string; productName: string; firstNegativeDate: Date; minStock: number }[]) {
    super('BACKDATE');
  }
}

/**
 * Simulate adding negative movements at `date` for OUTBOUND and check if tồn timeline ever goes negative.
 * Only relevant when date < today (backdated).
 * Returns array of issues (empty = safe).
 */
export async function simulateBackdateOutbound(
  warehouseId: string,
  date: Date,
  lines: LineInput[]
): Promise<{ sku: string; productName: string; firstNegativeDate: Date; minStock: number }[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const proposed = new Date(date);
  proposed.setHours(0, 0, 0, 0);
  if (proposed >= today) return []; // not backdated → no simulation needed

  const issues: { sku: string; productName: string; firstNegativeDate: Date; minStock: number }[] = [];

  for (const ln of lines) {
    // Fetch all existing movements for (warehouse, product), in chronological order
    const movements = await prisma.stockMovement.findMany({
      where: { warehouseId, productId: ln.productId },
      orderBy: { occurredAt: 'asc' }
    });
    // Build timeline with new movement injected at `proposed`
    const events: { at: Date; delta: number }[] = [
      ...movements.map((m) => ({ at: m.occurredAt, delta: m.qtyDelta })),
      { at: proposed, delta: -ln.quantity }
    ];
    events.sort((a, b) => a.at.getTime() - b.at.getTime());
    let running = 0;
    let minStock = Infinity;
    let firstNegativeDate: Date | null = null;
    for (const ev of events) {
      running += ev.delta;
      if (running < minStock) minStock = running;
      if (running < 0 && firstNegativeDate === null) firstNegativeDate = ev.at;
    }
    if (firstNegativeDate) {
      const p = await prisma.product.findUnique({ where: { id: ln.productId } });
      issues.push({
        sku: p?.sku ?? ln.productId,
        productName: p?.fullName ?? '',
        firstNegativeDate,
        minStock
      });
    }
  }
  return issues;
}

export async function createTransfer(input: CreateReceiptInput) {
  if (input.type !== 'TRANSFER' || !input.fromWarehouseId || !input.toWarehouseId) {
    throw new Error('Invalid TRANSFER input');
  }
  if (input.fromWarehouseId === input.toWarehouseId) throw new Error('FROM_TO_SAME');

  if (input.clientRequestId) {
    const existing = await prisma.receipt.findUnique({ where: { clientRequestId: input.clientRequestId } });
    if (existing) return { receipt: existing, deduped: true };
  }

  return await prisma.$transaction(async (tx) => {
    // Verify enough stock at from-warehouse (always block on transfer — no point creating ghost transfer)
    for (const ln of input.lines) {
      const cur = await computeStock(tx, input.fromWarehouseId!, ln.productId);
      if (cur < ln.quantity) {
        throw new OverstockError(ln.productId, cur, ln.quantity);
      }
    }

    const seq = await getNextReceiptSequence(tx, 'TRANSFER', input.date.getFullYear());
    const code = generateReceiptCode('TRANSFER', seq, input.date.getFullYear());

    const receipt = await tx.receipt.create({
      data: {
        code,
        type: 'TRANSFER',
        status: 'IN_TRANSIT',
        warehouseId: input.fromWarehouseId!, // alias = from for queries
        fromWarehouseId: input.fromWarehouseId!,
        toWarehouseId: input.toWarehouseId!,
        date: input.date,
        note: input.note ?? null,
        createdById: input.createdById,
        clientRequestId: input.clientRequestId ?? null,
        lines: { create: input.lines.map((l) => ({ productId: l.productId, unit: l.unit, quantity: l.quantity, lineNote: l.lineNote ?? null })) }
      }
    });

    // Movement only for from-warehouse (negative); to-warehouse movement happens on confirm
    for (const ln of input.lines) {
      await tx.stockMovement.create({
        data: {
          warehouseId: input.fromWarehouseId!,
          productId: ln.productId,
          unit: ln.unit,
          qtyDelta: -ln.quantity,
          source: 'RECEIPT',
          sourceId: receipt.id,
          occurredAt: input.date
        }
      });
    }

    return { receipt, deduped: false };
  });
}

export async function confirmTransferArrival(receiptId: string) {
  return await prisma.$transaction(async (tx) => {
    const r = await tx.receipt.findUnique({ where: { id: receiptId }, include: { lines: true } });
    if (!r || r.type !== 'TRANSFER' || r.status !== 'IN_TRANSIT' || !r.toWarehouseId) {
      throw new Error('INVALID_TRANSFER_STATE');
    }
    for (const ln of r.lines) {
      await tx.stockMovement.create({
        data: {
          warehouseId: r.toWarehouseId!,
          productId: ln.productId,
          unit: ln.unit,
          qtyDelta: ln.quantity,
          source: 'RECEIPT',
          sourceId: r.id,
          occurredAt: new Date()
        }
      });
    }
    return await tx.receipt.update({
      where: { id: receiptId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() }
    });
  });
}
