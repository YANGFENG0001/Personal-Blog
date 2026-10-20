# 部署指南：Linux VPS + Docker

本文以 Ubuntu 22.04/24.04 和 Debian 12 为例，其他发行版的做法类似。

## 0. 准备

- 一台 VPS，1 核 1GB 内存即可。
- 一个域名，DNS 的 **A 记录**（有 IPv6 的话再加 AAAA 记录）指向这台 VPS 的公网 IP。
- 在防火墙或云厂商安全组中放行 **80** 和 **443** 端口。

## 1. 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER     # 重新登录后生效
docker compose version            # 确认 compose 插件可用
```

> **国内服务器**：如果访问不了 Docker Hub 或 npm，在 `.env` 中取消注释 `NODE_IMAGE`、`CADDY_IMAGE` 和 `NPM_REGISTRY` 三行（见 `.env.example`），构建时就会走国内镜像。

## 2. 获取代码并配置

```bash
git clone https://github.com/<你的用户名>/<仓库名>.git ~/fieldnotes
cd ~/fieldnotes
cp .env.example .env
nano .env
```

至少需要修改这两项：

```ini
DOMAIN=blog.example.com
SITE_URL=https://blog.example.com
```

## 3. 启动

```bash
docker compose up -d --build
docker compose logs -f app        # 看到 "Server listening" 即启动成功，按 Ctrl+C 退出日志
```

Caddy 会在第一次访问时自动申请 HTTPS 证书，这一步需要 80 和 443 端口能从外网访问。

## 4. 创建站主账号

```bash
docker compose exec app node scripts/create-owner.ts admin
# 按提示输入两次密码（至少 10 位）
```

然后访问 `https://你的域名/owner/login` 登录。

> 公开页面上没有任何登录入口，请收藏这个地址。

忘记密码时，重新执行上面的命令即可重置，所有已登录的设备会被登出。

## 5. 备份（强烈建议）

所有数据都在 `~/fieldnotes/data/` 下：

- `fieldnotes.db`：数据库
- `uploads/`：上传的图片

手动备份：

```bash
docker compose exec app node scripts/backup.ts
# 备份文件写入 data/backups/，默认保留最近 14 份
```

每天凌晨 3 点自动备份（crontab）：

```bash
crontab -e
# 加入一行：
0 3 * * * cd ~/fieldnotes && docker compose exec -T app node scripts/backup.ts >> data/backups/backup.log 2>&1
```

建议再把 `data/backups/` 同步到另一台机器或对象存储，例如用 `rclone`。

**恢复：**

```bash
docker compose stop app
tar -xzf data/backups/fieldnotes-YYYYMMDD-HHMMSS.tar.gz -C /tmp
cp /tmp/fieldnotes-*/fieldnotes.db data/fieldnotes.db
rm -f data/fieldnotes.db-wal data/fieldnotes.db-shm
cp -r /tmp/fieldnotes-*/uploads data/ 2>/dev/null || true
docker compose start app
```

## 6. 升级

```bash
cd ~/fieldnotes
git pull
docker compose up -d --build      # 数据库迁移会在启动时自动执行
```

建议升级前先备份一次。

### 用预构建镜像部署（可选，推荐）

推送形如 `v1.0.0` 的 tag 后，GitHub Actions 会构建 amd64 + arm64 双架构镜像并发布到 `ghcr.io/yangfeng0001/personal-blog`，同时在 Releases 页生成版本记录。在 VPS 上就不必本机编译：

```bash
# .env 中加入固定版本（生产环境不要用 latest，回滚时才好定位）
APP_IMAGE=ghcr.io/yangfeng0001/personal-blog:1.0.0

docker compose pull app && docker compose up -d
```

镜像标签规则、发版流程见 [release.md](release.md)。如果仓库是私有的，需要先执行 `docker login ghcr.io`。

## 7. “连续在线”统计（可选）

应用每 5 分钟会写一次心跳。如果希望“连续在线”反映外部真实的可用性：

1. 在 `.env` 中设置 `HEARTBEAT_TOKEN=一串随机字符`，然后执行 `docker compose up -d`。
2. 在 UptimeRobot 等监控服务中添加 HTTP 监控，地址为 `https://你的域名/api/heartbeat?token=同一串字符`。

## 8. 常见问题

- **证书申请失败**：检查 DNS 是否已生效（`dig +short 你的域名`），以及 80 和 443 端口是否放行。查看日志：`docker compose logs caddy`。
- **登录后操作提示 “CSRF 校验失败”**：确认 `.env` 中的 `SITE_URL` 和浏览器地址栏里的域名完全一致，包括协议。如果有多个域名，把其余的加到 `EXTRA_ORIGINS`。
- **不使用 Caddy，改用现有的 Nginx**：删掉 `docker-compose.yml` 中的 `caddy` 服务，给 `app` 加上 `ports: ["127.0.0.1:4321:4321"]`，Nginx 配置如下：

  ```nginx
  location / {
    proxy_pass http://127.0.0.1:4321;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 12m;
  }
  ```

- **只想用 HTTP 临时测试**：在 `.env` 中设置 `COOKIE_SECURE=false`。生产环境不要这样做。
