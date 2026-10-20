# 发版与镜像发布

版本号只有两个地方：`VERSION` 文件和 `package.json`。用脚本一次改完，别手改。

```bash
npm run version:bump 1.0.1
```

## 一次发版的全过程

```bash
npm run version:bump 1.0.1        # 改 VERSION + package.json
git add VERSION package.json
git commit -m "release: v1.0.1"
git push
git tag v1.0.1
git push origin v1.0.1            # ← 这一下触发发布
```

推 tag 之后 `.github/workflows/release.yml` 会依次执行：

| 阶段 | 做什么 | 失败会怎样 |
| --- | --- | --- |
| `verify` | 校验 tag = `v` + `VERSION` = `package.json`，再跑类型检查和单元测试 | 版本不一致或测试红，后面全部不执行 |
| `image-amd64` | 在 `ubuntu-latest` 构建 amd64 镜像并推送 | 不发版 |
| `image-arm64` | 在原生 `ubuntu-24.04-arm` 构建 arm64 镜像并推送 | 不发版 |
| `smoke` | 真起一个容器，等 `/robots.txt` 返回 200 | 不发版 |
| `manifest` | 把两个单架构镜像合成 manifest list，并校验 amd64/arm64 都在 | 不发版 |
| `release` | 生成 GitHub Release，附部署包 `fieldnotes-vX.Y.Z-deploy.zip` | 镜像已发布，但 Release 缺失，可手动重跑 |

任一步失败都不会留下"有 Release 但拉不到镜像"的状态——Release 是最后一步。

## 镜像标签

`ghcr.io/yangfeng0001/personal-blog`：

| 标签 | 内容 |
| --- | --- |
| `1.0.1`、`v1.0.1`、`latest` | 多架构 manifest（amd64 + arm64 同一引用） |
| `v1.0.1-amd64`、`v1.0.1-arm64` | 单架构，构建中间产物，一般不用 |
| `edge` | main 分支每次提交自动构建，仅 amd64，供测试最新代码 |

`docker pull` 会自动按宿主机架构挑对应的层，x86 VPS 和树莓派 / 甲骨文 ARM 机器都能用同一个标签。

## 部署与回滚

```bash
# 升级
APP_IMAGE=ghcr.io/yangfeng0001/personal-blog:1.0.1 \
  docker compose pull app && docker compose up -d

# 回滚：把版本号改回上一个 tag 再 up -d
APP_IMAGE=ghcr.io/yangfeng0001/personal-blog:1.0.0 \
  docker compose pull app && docker compose up -d
```

数据库迁移在容器启动时自动执行且幂等，向前升级不用手动跑脚本。**但迁移是单向的**：如果新版本加过列，回滚到旧镜像时数据库结构仍停留在新版本上，旧代码一般仍能运行（多出来的列被忽略），只是不要指望自动降级。所以升级前先备份：

```bash
tar czf ~/fieldnotes-data-$(date +%F).tar.gz data/
```

## 仓库设置

1. **Settings → Actions → General → Workflow permissions** 需要是 **Read and write permissions**
   —— 否则 `GITHUB_TOKEN` 推不了 GHCR、也建不了 Release。当前仓库已验证可用。
2. GHCR 包 `personal-blog` 当前是 **Public**，服务器上直接 `docker compose pull` 即可，无需 `docker login`。
   如果以后改成私有，拉取前要先 `docker login ghcr.io`。

## 手动触发

Actions → release → Run workflow 可以手动跑一次构建（用当前 `VERSION`）。手动跑只出镜像，不建 Release、不动 `latest`，适合验证构建链路。

## 本地构建

不想等 CI 时：

```bash
docker build -t personal-blog:dev .
docker run --rm -p 4321:4321 -v "$PWD/data:/data" \
  -e SITE_URL=http://localhost:4321 -e COOKIE_SECURE=false personal-blog:dev
```
