# Quartz 部署指南

本指南详细介绍如何将 Quartz 网站手动部署到 Cloudflare Pages。

## 前置条件

- Node.js v22+
- npm v10.9.2+
- Cloudflare 账号

## 本地构建

```bash
# 构建网站（输出到 public/ 目录）
npx quartz build -d obsidian-vault --concurrency 8

# 本地测试（模拟 Cloudflare Pages 行为）
npx wrangler pages dev public
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
6. 输入项目名称（例如：`quartz-site`）
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
✨ Deployment complete! Take a peek over at https://xxxxxxxx.quartz-site.pages.dev
```

### 后续更新部署

每次更新内容后，只需重复以下步骤：

```bash
# 1. 构建
npx quartz build -d obsidian-vault --concurrency 8

# 2. 本地测试（可选）
npx wrangler pages dev public

# 3. 部署
npx wrangler pages deploy public --project-name=quartz-site
```

可以创建一个脚本简化操作：

```bash
# deploy.sh
#!/bin/bash
npx quartz build -d obsidian-vault --concurrency 8 && \
npx wrangler pages deploy public --project-name=quartz-site
```

## 配置自定义域名（可选）

1. 在 Cloudflare 控制台进入项目
2. 点击 **Custom domains** 标签
3. 点击 **Set up a custom domain**
4. 输入您的域名（如 `blog.example.com`）
5. 按照提示配置 DNS 记录

> 如果域名已在 Cloudflare 管理，DNS 会自动配置。

## 重要配置

### quartz.config.ts

确保 `baseUrl` 配置正确：

```typescript
configuration: {
  baseUrl: "your-domain.com",  // 不要包含 https:// 或尾部斜杠
  // ...
}
```

### 环境变量（Git 部署方式需要）

如果后续改用 Git 连接部署，需要设置：

- `NODE_VERSION`: `22`

## 后续：CI 自动部署

当工作流稳定后，可以考虑设置 GitHub Actions 自动部署：

1. 在 Cloudflare 创建 API Token（Pages 部署权限）
2. 在 GitHub 仓库添加 Secrets
3. 创建 `.github/workflows/deploy.yml`

详细步骤待后续补充。
