> [!NOTE]
> 本项目是 [Quartz v5](https://github.com/jackyzha0/quartz) 的一个魔改 Fork 版本。
>
> 目前本 Fork 在 v5 架构上保留的主要本地能力包括：
>
> - **Folder Note**: 支持文件夹笔记
> - **按需打包附件**: 仅复制已发布内容引用的附件
> - **动态背景**: 增强视觉体验
> - **移动端优化**: 更好的移动端阅读体验
> - **Bases 支持**: Bases 笔记和块渲染
> - **Google Search Console**: 内置搜索收录验证支持
>
> 在线示例: [sean2077.pages.dev](https://sean2077.pages.dev)
>
> 部署指南: 详见 [DEPLOY.md](DEPLOY.md)

## 本地架构速览

这是 Quartz v5 架构上的本地 Fork。站点内容来自根目录的 `obsidian-vault` 符号链接，`npm run build` 会以 `obsidian-vault/` 为输入并输出到 `public/`。

关键入口：

- `quartz.config.yaml`: 站点配置、插件列表、插件顺序、布局位置和页面模板。
- `quartz.ts`: 加载 YAML 配置和布局，也作为需要 TypeScript 回调时的覆盖入口。
- `quartz/build.ts`: 构建协调器，负责 glob、parse、filter、emit 和 watch 增量重建。
- `quartz/processors/`: Markdown 解析、发布过滤和文件输出三阶段处理。
- `quartz/plugins/loader/`: 社区插件安装、manifest 解析、依赖校验、组件/Frame 注册。
- `plugins/local/`: 本 Fork 保留的本地插件和组件能力。
