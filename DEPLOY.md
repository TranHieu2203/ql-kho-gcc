# 🚀 Deploy ql-kho-gcc lên internet (Docker + Caddy)

Hướng dẫn deploy production lần đầu từ A→Z. Thời gian dự kiến: **15–30 phút** kể từ lúc SSH vào server.

## ✅ Trước khi bắt đầu — checklist

| | Yêu cầu | Note |
|---|---|---|
| ☐ | **Server Linux** (Ubuntu 22.04+ / Debian 12+ khuyến nghị) | RAM tối thiểu 1GB, ổ cứng 5GB+ |
| ☐ | **Domain** trỏ A record về IP server | Vd: `ql-kho.example.com → 203.0.113.5` |
| ☐ | **Cổng 80 + 443 mở** (firewall) | Caddy cần để cấp Let's Encrypt |
| ☐ | **Docker + Docker Compose** đã cài | `docker --version`, `docker compose version` |
| ☐ | DNS đã propagate | `dig ql-kho.example.com +short` trả về đúng IP |

### Cài Docker nhanh (Ubuntu/Debian)
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Logout/login lại để áp dụng group
```

---

## 📦 Bước 1: Clone code lên server

```bash
sudo mkdir -p /opt/ql-kho-gcc
sudo chown $USER:$USER /opt/ql-kho-gcc
cd /opt/ql-kho-gcc

# Clone repo (hoặc rsync/scp từ máy dev)
git clone <your-repo-url> .
# Hoặc nếu copy thủ công:
# scp -r ./ql-kho-gcc user@server:/opt/
```

---

## ⚙️ Bước 2: Tạo file `.env`

```bash
cp .env.example .env
nano .env
```

Điền 4 giá trị bắt buộc:

```env
DOMAIN=ql-kho.example.com
ACME_EMAIL=admin@example.com
ADMIN_INITIAL_PASSWORD=YourStrongPass123       # >=8 ký tự, có chữ và số
ADMIN_USERNAME=admin                            # hoặc tùy chỉnh
```

> ⚠️ **Sau khi bootstrap thành công**, quay lại file `.env` và **xóa giá trị `ADMIN_INITIAL_PASSWORD`** (để rỗng) rồi `docker compose up -d` để restart sạch.

---

## 🐳 Bước 3: Build + chạy

```bash
docker compose up -d --build
```

Theo dõi log:
```bash
docker compose logs -f
```

Bạn sẽ thấy theo thứ tự:
1. `app` build (~2-5 phút lần đầu)
2. `[entrypoint] prisma migrate deploy...` — apply schema
3. `[bootstrap-admin] OK — tạo admin` (nếu lần đầu)
4. `[entrypoint] Starting Next.js server on port 3000...`
5. `caddy` start, gọi Let's Encrypt ACME
6. `certificate obtained successfully` — cert đã cấp

Tổng thời gian lần đầu: ~3–6 phút.

---

## 🌐 Bước 4: Test

```bash
# Local từ server
curl -sI https://ql-kho.example.com/api/health
# → HTTP/2 200 + {"status":"ok",...}

# Mở browser:
# https://ql-kho.example.com → trang đăng nhập
```

Đăng nhập bằng `admin / YourStrongPass123` (đã set ở Bước 2).

---

## 🔒 Bước 5: Hardening sau lần đầu

### 5.1. Xóa initial password
```bash
nano .env
# Xóa giá trị ADMIN_INITIAL_PASSWORD (để rỗng):
#   ADMIN_INITIAL_PASSWORD=
docker compose up -d
```

### 5.2. Đổi mật khẩu admin
Vào `/ca-nhan` trong UI → đổi mật khẩu.

### 5.3. Backup local (cron — file .db)
```bash
sudo tee /etc/cron.daily/ql-kho-backup <<'EOF'
#!/bin/sh
cd /opt/ql-kho-gcc
TS=$(date +%Y%m%d-%H%M)
mkdir -p backups
# SQLite .backup là consistent ngay cả khi app đang ghi
docker compose exec -T app sh -c "sqlite3 /app/data/app.db '.backup /app/data/backup-$TS.db'"
mv data/backup-$TS.db backups/
# Giữ 30 ngày
find backups -name "backup-*.db" -mtime +30 -delete
EOF
sudo chmod +x /etc/cron.daily/ql-kho-backup
```

### 5.4. Backup lên Google Sheets (UI + cron)

**Cấu hình lần đầu trong UI** (5 phút):
1. Đăng nhập admin → `/quan-tri/backup`
2. Theo hướng dẫn trong trang: tạo Google Cloud Project → enable Sheets API → tạo Service Account → tải JSON key
3. Tạo Google Sheet trống → share với email service account (Editor)
4. Paste JSON + Spreadsheet ID → Lưu → Test kết nối → Backup ngay

**Bật schedule tự động (cron gọi endpoint):**
```bash
# 1) Tạo CRON_SECRET — token bí mật ≥16 ký tự
CRON_SECRET=$(openssl rand -hex 24)
echo "CRON_SECRET=$CRON_SECRET" >> /opt/ql-kho-gcc/.env

# 2) Khai báo env vào docker-compose (đã có sẵn). Restart app:
cd /opt/ql-kho-gcc
docker compose up -d

# 3) Cài cron — chọn 1 trong 2 tùy schedule bạn dùng trong UI:
#    (a) Nếu UI chọn 'Hàng giờ' → cron mỗi 15 phút
#    (b) Nếu UI chọn 'Hàng ngày' / 'Hàng tuần' → cron mỗi 6 giờ là đủ
# Endpoint TỰ skip nếu chưa đến hạn → an toàn ngay cả khi cron freq cao.

# (a) Hourly mode:
sudo tee /etc/cron.d/ql-kho-google-backup <<EOF
*/15 * * * * root curl -fsS "https://${DOMAIN}/api/cron/backup?token=${CRON_SECRET}" >> /var/log/ql-kho-backup.log 2>&1
EOF

# (b) Daily/Weekly mode (uncomment thay vì (a) nếu dùng):
# sudo tee /etc/cron.d/ql-kho-google-backup <<EOF
# 0 */6 * * * root curl -fsS "https://${DOMAIN}/api/cron/backup?token=${CRON_SECRET}" >> /var/log/ql-kho-backup.log 2>&1
# EOF
```
Endpoint tự xử lý theo `schedule` đã chọn trong UI:
- `manual` → luôn skip
- `hourly` → chỉ chạy nếu last_run ≥ 55 phút trước (buffer 5 phút)
- `daily` → chỉ chạy nếu last_run ≥ 23 giờ trước (buffer 1 giờ)
- `weekly` → chỉ chạy nếu last_run ≥ 6 ngày 18h trước (buffer 6 giờ)

Log:
```bash
tail -f /var/log/ql-kho-backup.log
# Hoặc xem trong UI: /quan-tri/backup → "Lần chạy gần nhất / Kết quả"
```

### 5.4. Firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

---

## 🔧 Vận hành thường ngày

| Việc | Lệnh |
|---|---|
| Xem log app | `docker compose logs -f app` |
| Xem log Caddy/HTTPS | `docker compose logs -f caddy` |
| Restart app | `docker compose restart app` |
| Pull code mới + rebuild | `git pull && docker compose up -d --build` |
| Backup tay | `docker compose exec app sh -c "sqlite3 /app/data/app.db '.backup /app/data/manual-$(date +%F).db'"` |
| Vào shell container | `docker compose exec app sh` |
| Vào Prisma Studio (dev only) | `docker compose exec app npx prisma studio --port 5555` rồi tunnel SSH |
| Stop tất cả | `docker compose down` |
| Stop + xóa volumes (DESTRUCTIVE) | `docker compose down -v` |

---

## 🐞 Troubleshooting

### Caddy không cấp được TLS
- Check DNS: `dig $DOMAIN +short` phải trả đúng IP server
- Check firewall: port 80 phải mở (Let's Encrypt HTTP-01 challenge)
- Check log: `docker compose logs caddy | grep -i error`
- Rate limit Let's Encrypt: 5 cert/tuần/domain. Nếu hit → `docker compose logs caddy | grep rate`

### App không start
- Check log: `docker compose logs app`
- DB locked? Container restart liên tục? → có thể volume permission. `ls -la data/` → owner phải là 1001:1001 (nextjs user trong container)
  ```bash
  sudo chown -R 1001:1001 data/
  ```

### "Admin đã tồn tại" nhưng quên password
- SSH vào container, dùng SQLite trực tiếp + bcrypt:
  ```bash
  docker compose exec app sh
  cd /app
  node -e "
    const bcrypt = require('bcryptjs');
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    bcrypt.hash('NewStrongPass123', 10).then(h =>
      p.user.update({ where: { username: 'admin' }, data: { passwordHash: h } })
        .then(() => console.log('OK'))
    );
  "
  ```

### Out of disk
- Old Docker images: `docker system prune -a` (cẩn thận, xóa hết unused)
- Old backups: kiểm tra `backups/` và xóa thủ công

---

## 📊 Monitoring (optional)

### Uptime check ngoài
- Uptime Kuma (self-host) hoặc UptimeRobot (free SaaS) ping `https://$DOMAIN/api/health` mỗi 5 phút

### Resource monitoring
```bash
docker stats ql-kho-app ql-kho-caddy
```

---

## 🔐 Bảo mật khuyến nghị bổ sung

| | Action |
|---|---|
| ☐ | Đổi SSH port 22 → port khác, disable password auth, chỉ dùng key |
| ☐ | `fail2ban` cho SSH brute-force |
| ☐ | Backup `.env` vào nơi an toàn (1Password / Bitwarden) — đặc biệt nếu mất sẽ KHÔNG khôi phục được session keys |
| ☐ | Set up Cloudflare proxy (orange cloud) trước domain → hide origin IP |
| ☐ | Cron backup verify: thỉnh thoảng restore backup vào staging xem có chạy được |
| ☐ | Đổi `ADMIN_USERNAME` từ `admin` sang gì đó không-đoán-được |

---

## 🆘 Khi cần rollback

```bash
# Stop, restore DB từ backup
docker compose stop app
cp backups/backup-2026-06-01-1300.db data/app.db
chown 1001:1001 data/app.db
docker compose up -d app
```

---

Chúc deploy suôn sẻ! Nếu lỗi gì gửi log `docker compose logs --tail=100 app` và `docker compose logs --tail=50 caddy`.
