/**
 * Production-safe admin bootstrap (non-interactive, env-driven).
 * Chỉ tạo admin đầu tiên nếu DB chưa có admin nào.
 *
 * Required env:
 *   ADMIN_INITIAL_PASSWORD  — mật khẩu (>=8 ký tự, có chữ và số)
 *
 * Optional env:
 *   ADMIN_USERNAME    (default: admin)
 *   ADMIN_FULL_NAME   (default: "Quản trị viên")
 *
 * KHÔNG seed sample data. KHÔNG log password.
 *
 * Usage trong Dockerfile entrypoint:
 *   ADMIN_INITIAL_PASSWORD='StrongPass123' node prisma/bootstrap-admin.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

(async () => {
  try {
    const existing = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (existing) {
      console.log(`[bootstrap-admin] Admin đã tồn tại (username=${existing.username}). Bỏ qua.`);
      return;
    }

    const password = process.env.ADMIN_INITIAL_PASSWORD;
    if (!password) {
      console.error('[bootstrap-admin] FATAL: ADMIN_INITIAL_PASSWORD env bắt buộc cho lần khởi tạo đầu.');
      process.exit(2);
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      console.error('[bootstrap-admin] FATAL: Password tối thiểu 8 ký tự, có ít nhất 1 chữ và 1 số.');
      process.exit(2);
    }

    const username = (process.env.ADMIN_USERNAME || 'admin').trim();
    const fullName = (process.env.ADMIN_FULL_NAME || 'Quản trị viên').trim();

    if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) {
      console.error('[bootstrap-admin] FATAL: ADMIN_USERNAME không hợp lệ (3-64 ký tự a-z, A-Z, 0-9, ._-).');
      process.exit(2);
    }

    const hash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: { username, passwordHash: hash, fullName, role: 'ADMIN', active: true }
    });
    console.log(`[bootstrap-admin] OK — tạo admin: username="${created.username}" id=${created.id}`);
    console.log('[bootstrap-admin] Nhớ XÓA env ADMIN_INITIAL_PASSWORD sau lần chạy đầu.');
  } catch (e) {
    console.error('[bootstrap-admin] ERROR:', (e && e.message) || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
