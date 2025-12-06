# Quartz 部署指南

本指南将详细介绍如何将您的 Quartz 网站部署到 Cloudflare Pages。

## 1. Cloudflare Pages (推荐)

Cloudflare Pages 是部署 Quartz 最简单的方式，提供极佳的全球性能和免费的 SSL 证书。

### 方法 A: 连接 Git (最简单)
1.  将您的 Quartz 代码推送到 GitHub 仓库。
2.  登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
3.  进入 **Workers & Pages** > **Create Application** > **Pages** > **Connect to Git**。
4.  选择您的仓库。
5.  配置构建设置：
    *   **Framework Preset (框架预设)**: 选 `None` (如果可选 `Quartz` 也可以，但通常 `None` 配合自定义命令最稳妥)。
    *   **Build command (构建命令)**: `npx quartz build`
    *   **Build output directory (输出目录)**: `public`
    *   **Environment Variables (环境变量)**:
        *   `NODE_VERSION`: `22` (或 `18.14.0` 及以上)
6.  点击 **Save and Deploy**。

### 方法 B: 直接上传 (CLI 命令行)
如果您更喜欢在本地构建然后上传：
1.  安装 Wrangler: `npm install -g wrangler`
2.  登录: `npx wrangler login`
3.  构建网站: `npx quartz build`
4.  部署: `npx wrangler pages deploy public --project-name=my-quartz-site`

---

## 重要提示
*   **Node 版本**: 确保构建环境使用 Node.js v18.14 或更高版本 (推荐 v20+)。
*   **Base URL**: 如果您使用自定义域名，请务必更新 `quartz.config.ts` 中的 `baseUrl` 字段。

