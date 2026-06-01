import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Admin (default: admin / Admin@123)
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!existingAdmin) {
    const hash = await bcrypt.hash('Admin@123', 10);
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: hash,
        fullName: 'Quản trị viên',
        role: 'ADMIN',
        active: true
      }
    });
    console.log('Seed admin: username=admin password=Admin@123');
  }

  // Sample staff user (hung / Staff@123)
  const existingStaff = await prisma.user.findUnique({ where: { username: 'hung' } });
  if (!existingStaff) {
    const hash = await bcrypt.hash('Staff@123', 10);
    await prisma.user.create({
      data: {
        username: 'hung',
        passwordHash: hash,
        fullName: 'Hùng (Thủ kho)',
        role: 'WAREHOUSE_STAFF',
        active: true
      }
    });
    console.log('Seed staff: username=hung password=Staff@123');
  }

  // Warehouses
  const whHN = await prisma.warehouse.upsert({
    where: { code: 'WH-HN' },
    update: {},
    create: { code: 'WH-HN', name: 'Kho Hà Nội', address: 'KCN Sài Đồng, Hà Nội' }
  });
  const whBN = await prisma.warehouse.upsert({
    where: { code: 'WH-BN' },
    update: {},
    create: { code: 'WH-BN', name: 'Kho Bắc Ninh', address: 'KCN Tiên Sơn, Bắc Ninh' }
  });

  // Link hung to both warehouses
  const hung = await prisma.user.findUnique({ where: { username: 'hung' } });
  if (hung) {
    for (const wh of [whHN, whBN]) {
      await prisma.userWarehouse.upsert({
        where: { userId_warehouseId: { userId: hung.id, warehouseId: wh.id } },
        update: {},
        create: { userId: hung.id, warehouseId: wh.id }
      });
    }
  }

  // Products — from real Excel data
  const products = [
    { sku: 'KV789H3 1200R20 24PR', fullName: 'LỐP KOIVI 1200R20 KV789 H3', brand: 'KOIVI', size: '1200R20 20PR', pattern: 'KV789H3' },
    { sku: 'KV888 12R22.5 20PR', fullName: 'LỐP KOIVI 12R22.5 KV888', brand: 'KOIVI', size: '12R22.5 20PR', pattern: 'KV888' },
    { sku: 'KV789H2 1100R20 22PR', fullName: 'LỐP KOIVI 1100R20 KV789 H2', brand: 'KOIVI', size: '1100R20 22PR', pattern: 'KV789H2' },
    { sku: 'GD639 1200R20 20PR', fullName: 'LỐP GASVIDO 1200R20 20PR GD639', brand: 'GASVIDO', size: '1200R20 20PR', pattern: 'GD639' },
    { sku: 'GA518 1200R20 20PR', fullName: 'LỐP GASVIDO 1200R20 20PR GD518', brand: 'GASVIDO', size: '1200R20 20PR', pattern: 'GA518' },
    { sku: 'GD639 1100R20 18PR', fullName: 'LỐP GASVIDO 1100R20 18PR GD639', brand: 'GASVIDO', size: '1100R20 18PR', pattern: 'GD639' },
    { sku: 'GA518 1100R20 18PR', fullName: 'LỐP GASVIDO 1100R20 18PR GD518', brand: 'GASVIDO', size: '1100R20 18PR', pattern: 'GA518' },
    { sku: 'GD737 1200R20 20PR', fullName: 'LỐP GASVIDO 1200R20 20PR GD737', brand: 'GASVIDO', size: '1200R20 20PR', pattern: 'GD737' }
  ];
  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: { ...p, defaultUnit: 'BO', lowStockThreshold: 10, active: true }
    });
  }

  // Default settings
  await prisma.setting.upsert({
    where: { key: 'out_overstock_policy' },
    update: {},
    create: { key: 'out_overstock_policy', value: 'warn' }
  });

  console.log('Seed complete. Warehouses:', whHN.code, whBN.code);
  console.log(`Products seeded: ${products.length}`);
  console.log('Login admin: admin / Admin@123');
  console.log('Login staff: hung / Staff@123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
