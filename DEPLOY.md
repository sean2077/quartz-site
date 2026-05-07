# Quartz v5 部署指南

本指南详细介绍如何将 Quartz 网站手动部署到 Cloudflare Pages。

## 前置条件

- Node.js v22+
- npm v10.9.2+
- Cloudflare 账号

## 本地构建

```bash
# 构建网站（输出到 public/ 目录）
npm run build

# 本地测试（模拟 Cloudflare Pages 行为）
npm run dev
# 访问 http://localhost:8788 验证
```

## 部署到 Cloudflare Pages

### 首次部署：创建项目

#### 步骤 1：Cloudflare 网页端创建项目

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
2. 左侧菜单选择 **Workers & Pages**
3. 点击 **Create** 按钮
4. 选择 **Pages** 标签
5. 选择 **Direct Upload**（直接上传）
6. 输入项目名称（当前站点使用 `sean2077`）
7. 点击 **Create project**

> 注意：首次创建时会要求上传文件，可以先上传一个空目录或直接用 CLI 上传。

#### 步骤 2：本地安装 Wrangler CLI

```bash
# 全局安装（推荐）
npm install -g wrangler

# 或使用 npx（无需安装）
npx wrangler --version
```

#### 步骤 3：登录 Cloudflare

```bash
npx wrangler login
# 浏览器会自动打开，授权登录
```

#### 步骤 4：部署

```bash
# 部署到 Cloudflare Pages （main为 production 分支）
npx wrangler pages deploy public --project-name=sean2077 --branch=main

# 如果是新项目，会提示创建，选择 Y
```

部署成功后，会显示类似：

```
✨ Deployment complete! Take a peek over at https://xxxxxxxx.sean2077.pages.dev
```

### 后续更新部署

每次更新内容后，只需重复以下步骤：

```bash
# 1. 构建
npm run build

# 2. 本地测试（可选）
npm run dev

# 3. 部署
npm run deploy
```

可以创建一个脚本简化操作：

```bash
npm run release
```

## 配置自定义域名（可选）

1. 在 Cloudflare 控制台进入项目
2. 点击 **Custom domains** 标签
3. 点击 **Set up a custom domain**
4. 输入您的域名（如 `blog.example.com`）
5. 按照提示配置 DNS 记录

> 如果域名已在 Cloudflare 管理，DNS 会自动配置。

## 重要配置

### quartz.config.yaml

确保 `baseUrl` 配置正确：

```yaml
configuration:
  baseUrl: sean2077.pages.dev # 不要包含 https:// 或尾部斜杠
```

### 环境变量（Git 部署方式需要）

如果后续改用 Git 连接部署，需要设置：

- `NODE_VERSION`: `22`

## Google 搜索收录

要让 Google 收录你的网站，需要完成以下步骤：

### 1. 修改 robots.txt

编辑 `quartz/static/robots.txt`，将 Sitemap URL 改为你的域名：

```txt
User-agent: *
Allow: /

Sitemap: https://your-site.pages.dev/sitemap.xml
```

### 2. 获取 Google Search Console 验证码

1. 访问 [Google Search Console](https://search.google.com/search-console)
2. 点击 **添加资源**
3. 选择 **"网址前缀"**（右侧），输入 `https://your-site.pages.dev/`
4. 选择 **"HTML 标签"** 验证方式
5. 复制 meta 标签中的 `content` 值（即验证码）

### 3. 配置验证码

在 `quartz.config.yaml` 中配置你的验证码：

```yaml
configuration:
  googleSiteVerification: "你的验证码" # fork 后请替换为你自己的
```

本地迁移分支已通过 `plugins/local/head-meta` 将该配置写入页面 `<head>`。

部署网站后，回到 Search Console 点击验证。

### 4. 提交站点地图

验证成功后：

1. 在 Search Console 左侧菜单选择 **站点地图**
2. 输入 `sitemap.xml`
3. 点击提交

> **注意**：Google 索引新站点通常需要几天到几周时间。

## 常见问题

### Wrangler 端口被占用 / 页面无法加载

如果遇到 `localhost:8788` 无法访问，可能是之前的 wrangler 进程没有正确关闭，导致端口被僵尸进程占用。

**诊断：**

```bash
# 查看占用 8788 端口的进程
netstat -ano | grep 8788
```

如果看到多个 `LISTENING` 状态的进程，或大量 `CLOSE_WAIT`/`FIN_WAIT` 连接，说明有僵尸进程。

**解决方法：**

```bash
# 方法 1：杀掉占用端口的进程（Windows）
# 先找出 PID
netstat -ano | grep "8788.*LISTENING"
# 然后杀掉（替换 <PID> 为实际进程号）
taskkill //F //PID <PID>

# 方法 2：一行命令解决
netstat -ano | grep "8788.*LISTENING" | awk '{print $5}' | xargs -I {} taskkill //F //PID {}

# 方法 3：换一个端口
npx wrangler pages dev public --port 9000
```

**预防：**

- 使用 `Ctrl+C` 正常关闭 wrangler，不要直接关闭终端
- 如果使用 Claude Code 等工具，避免在后台运行 wrangler 进程

## 后续：CI 自动部署

当工作流稳定后，可以考虑设置 GitHub Actions 自动部署：

1. 在 Cloudflare 创建 API Token（Pages 部署权限）
2. 在 GitHub 仓库添加 Secrets
3. 创建 `.github/workflows/deploy.yml`

详细步骤待后续补充。
