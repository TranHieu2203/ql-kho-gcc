/**
 * Interactive admin seed (prompt for password).
 * Use this in production setup instead of relying on the dev seed.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const prisma = new PrismaClient();

function ask(q: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !hidden });
    rl.question(q, (ans) => {
      rl.close();
      resolve(ans);
    });
  });
}

async function main() {
  const existing = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existing) {
    console.error(`Đã tồn tại quản trị viên: ${existing.username}. Nếu cần thêm admin, dùng giao diện /quan-tri/nguoi-dung.`);
    process.exit(1);
  }
  const username = (await ask('Tên đăng nhập admin: ')).trim();
  const fullName = (await ask('Họ tên: ')).trim();
  const password = await ask('Mật khẩu (>=6 ký tự): ');
  if (!username || !fullName || password.length < 6) {
    console.error('Dữ liệu không hợp lệ.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { username, fullName, passwordHash: hash, role: 'ADMIN', active: true }
  });
  console.log(`Đã tạo quản trị viên: ${username}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
