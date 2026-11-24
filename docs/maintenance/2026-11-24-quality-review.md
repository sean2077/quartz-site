---
title: 2026-11-24 上游同步与质量改进
---

# 范围与结论

审查基线为本仓库 `main@b4956fb6`，上游为 [Quartz v5@2386362d](https://github.com/jackyzha0/quartz/commit/2386362d)，其包版本为 5.2.2。本仓库已经采用 v5 的配置和插件架构；本次选择兼容的修复，保留现有本地插件、发布规则和独立内容仓库的边界。

优先处理的实际问题是：Fork 的 CI 未运行、本地插件未纳入类型检查、插件安装未严格兑现 lockfile、增量构建残留页面、Bases 多视图共用首个视图的查询结果、分页仍操作全表，以及阅读布局和背景组件耦合。原有暖色浅色／冷色深色配色、霞鹜文楷、分时段城市背景继续保留。

## 上游选择

以下 13 个提交均通过 `git cherry-pick -x` 引入，Git 历史保留原始提交来源。涉及本地能力的冲突按下文适配。

| 上游提交                                                                                        | 改进                                  | 选择理由                         |
| ----------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------- |
| [e56ffae8](https://github.com/jackyzha0/quartz/commit/e56ffae883932397931a882847915e6bd52fb8c9) | 清空输出目录内容，保留目录本身        | 兼容 bind mount，避免 EBUSY      |
| [581f6707](https://github.com/jackyzha0/quartz/commit/581f6707dad87b6803785d5c06446f5a60c0f786) | Head 解除对 OG image 插件的运行时依赖 | 禁用可选插件时保持核心可构建     |
| [a791a4f1](https://github.com/jackyzha0/quartz/commit/a791a4f12dd9a41e17c616966d87e8c584de7c32) | 代码块关闭连字                        | 保持代码字符的可辨识性           |
| [b080c219](https://github.com/jackyzha0/quartz/commit/b080c219b905648392272c86ad52790e6a43d4b8) | LiveReload 根据页面协议选择 ws/wss    | 支持 HTTPS 开发代理              |
| [f5fa2343](https://github.com/jackyzha0/quartz/commit/f5fa2343a4b85986de5573897c11cdb1f2fa4f1e) | 增量构建成功后清空已处理记录          | 避免重复消费旧事件               |
| [762f7634](https://github.com/jackyzha0/quartz/commit/762f7634b411a69f10f519c572892b4abcb21bd9) | 挂载内容目录的 polling 与文件发现     | 改善跨文件系统开发体验           |
| [4ef1814e](https://github.com/jackyzha0/quartz/commit/4ef1814ec186933b94add98b7ee3441552366adb) | bfcache 恢复时清理旧 popover          | 避免返回页面时残留浮层           |
| [3e4a50a5](https://github.com/jackyzha0/quartz/commit/3e4a50a5edcd8ad9950e54e7d0e2bb5ac1ff0754) | SPA 使用重定向后的真实地址            | 相对链接和浏览器历史使用同一基准 |
| [041de1c6](https://github.com/jackyzha0/quartz/commit/041de1c6928f0ed0102eda9e936852848c5c51f3) | 合并重复 mkdir 操作                   | 降低同目录并行输出的文件系统操作 |
| [b7998bbd](https://github.com/jackyzha0/quartz/commit/b7998bbd2db1cc6325859d43aa1dd07120f35b27) | 手机侧栏、长词和行内代码换行          | 避免内容撑宽页面                 |
| [7531e678](https://github.com/jackyzha0/quartz/commit/7531e678f51175c31c994d01d92d470c4797b83c) | 窄屏 Grid 使用 minmax(0, 1fr)         | 约束内容列与页面标题宽度         |
| [254af5dc](https://github.com/jackyzha0/quartz/commit/254af5dcff5934aeb1f3218ee59c8ab40d977041) | 增量构建删除过期页面                  | 删除／取消发布后不残留旧正文     |
| [50227ba2](https://github.com/jackyzha0/quartz/commit/50227ba2c329de7eadd04a1a7dddc5643546339e) | slug 所有者变化时重新输出             | 冲突赢家被移除后恢复剩余页面     |

### 必要的 Fork 适配

- `write()` 的目录 Promise 缓存按 `BuildCtx` 保存到 WeakMap，失败项移除。每次完整构建清空输出后创建新 context，不复用上一次构建的目录状态；保留本地 Cloudflare `folder/index` alias 与 `_headers` 写入逻辑。
- 删除事件在从 `contentMap` 移除之前保留原始 VFile，使 dispatcher 可以清理转换器实际生成的 slug；删除目录笔记时同时清理扩展名为空的 Cloudflare alias。存在其他公开内容时，虚拟目录页会重新生成并替换旧笔记。
- Polling 清理会取消发现 interval 和 debounce timeout，并阻止尚未完成的文件扫描重新打开已经关闭的 watcher。
- Git 插件锁定借鉴上游 [8eae6a1](https://github.com/jackyzha0/quartz/commit/8eae6a1) 和 [166d09b8](https://github.com/jackyzha0/quartz/commit/166d09b8) 的修复目的，针对本 Fork 的 Git loader 实现小范围回移；不把新版 npm 插件管理器整批移入。全长 SHA 校验、精确 fetch、checkout 后验证、子目录来源元数据和失败退出均有本地 Git 集成测试。
- 清理配置未引用的 `quartz-themes`、`obsidian-plugin-ttrpg-tools-maps`、`stacked-pages` 锁条目。旧版主题插件在全新安装验证中触发约 2 GiB Node heap 上限，过去安装器吞掉了失败状态。索引生成限定于 lockfile／当前配置声明的插件，旧缓存不再影响导出；构建失败保留诊断信息。
- 上游新增的三份 changeset 针对 `@jackyzha0/quartz` 的发布流程，本 Fork 不使用该发布工具，因此最终变更不保留这些发行元数据。

### 暂缓的上游变化

上游近期还迁移了 npm 插件分发、核心 frontmatter／链接／索引处理、主题系统和相关插件 API。它们相互依赖，且与本地 Folder Note、按需附件、Bases 和别名处理交叠；应作为单独迁移项目建立兼容矩阵，不能把更新版本号当作兼容性验证。已有 Dependabot PR 的大批依赖升级也留在各自 PR 中评估。

## 架构改进

| 层次           | 责任与本次调整                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------- |
| 配置与插件加载 | YAML 保持现有能力；安装时兑现 `quartz.lock.json`，出错停止而非静默跟随远端默认分支                |
| 内容构建       | parse → filter → emit；增量事件保留删除前元数据，并在成功后清空已处理状态                         |
| 页面输出       | dispatcher 决定页面归属；`write()` 负责目录、HTML 和 Cloudflare alias；全量／增量重建均有回归覆盖 |
| 本地功能插件   | `plugins/local/` 全部纳入 TypeScript；Bases 的全局过滤与每个视图的查询分开                        |
| 站点外观       | `quartz/styles/custom.scss` 管理布局、阅读面板、排版和焦点状态；背景插件只负责图片与时钟          |
| 验证           | 单元与 Git 集成 → 合成站点构建 → 浏览器交互；输入不依赖独立 vault                                 |

TypeScript 使用 `moduleResolution: bundler` 与实际 esbuild 构建方式一致，并允许本地插件既有的 `.ts` 导入。`remark-parse` 的未导出内部类型改为 `mdast` 类型；micromorph 0.4.5 的 exports map 未暴露其声明文件，因此用与已安装 API 一致的最小声明补齐。没有用全局关闭严格检查来消除新增类型错误。

`npm test` 明确发现 `quartz/` 与 `plugins/local/` 中的 `.test.ts`／`.test.js`，通过 `node --import tsx --test` 执行，避免旧 Node 22 自动发现遗漏 TypeScript 测试，也不依赖 tsx CLI 的 IPC server。

## 正确性与性能

### Bases

- 每个 Tab 分别执行自己的 filter、sort、limit；全局过滤结果可共享，不共享首个 Tab 的最终结果。
- SSR 仍输出全部表格行作为无 JavaScript 回退。脚本初始化后，只把当前页的行挂在 tbody 上；行文本和列值只读取一次，翻页复用已计算的筛选／排序结果。
- SPA 清理恢复完整 SSR 行并重置初始化标记，避免返回页面后只剩上次的十行。搜索仍能命中未挂载的行。
- 新挂载行用局部、非冒泡的 `render` 事件通知 Popover；捕获监听只扫描更新子树，WeakSet 避免重复注册。它不会重新初始化全局主题／阅读模式按钮，浏览器测试检查翻页后一次点击只触发一次主题变化。
- 数值比较只处理完整数值；日期文本不再被 `parseFloat` 错当成年份而排成相同值。地图 CDN 加载异步进行，不阻塞表格控件。

此处优化的是活动 DOM 和翻页更新；完整行仍保存在内存和 HTML 中，不宣称 HTML 传输体积下降或大型数据库查询复杂度已经解决。

### 附件

完整路径和解码后的路径优先于 basename；同名附件的模糊简写不再由目录遍历顺序任意选择。URL 的 query／fragment、百分号编码扩展名和外部协议正确区分。增量复制将候选附件与当前已发布内容实际保留的附件集合相交，防止一次未发布笔记的变化把附件写入输出。

当前 `CrawlLinks(shortest)` 会先改写链接，某些模糊 `./image.png` 引用可能在进入本地附件处理前已失去源目录信息。重名附件应使用明确的 vault 路径或相对路径；无法唯一识别时继续给出可见的缺失提示。本次不把这项上游路径语义限制表述为已经全面解决。

### 可复现的体积和 DOM 指标

| 指标                       |       原状态 |                               本次 |
| -------------------------- | -----------: | ---------------------------------: |
| 六个时段背景源图总大小     | 16,547,108 B |                           原图保留 |
| 六张桌面展示图总大小       | 使用上述源图 |             978,850 B，减少 94.08% |
| 六张手机展示图总大小       | 使用上述源图 |             341,170 B，减少 97.94% |
| 当前时段单张展示图         |   取决于原图 | 桌面约 148–176 kB；手机约 54–59 kB |
| 样例 Bases 活动 tbody 行数 |           45 |                            默认 10 |
| 背景时钟                   |   每分钟检查 |       下一时段边界更新，隐藏时暂停 |

背景数据来自文件大小，不是整站加载时间或 Lighthouse 成绩。原图保留并仍由 Static emitter 输出，所以部署目录总大小没有因此下降；页面使用 WebP 展示版本。可运行 `node plugins/local/dynamic-background/optimize-backgrounds.mjs` 重新生成，细节见[背景组件说明](../../plugins/local/dynamic-background/README.md)。

## 阅读与无障碍

阅读面板提高不透明度，常规文章限制正文宽度为 52rem；桌面、平板、手机分别采用三列、两列和单列。代码块、分隔线、标题、正文行距和键盘焦点使用一致的站点样式。去除正文容器的 backdrop-filter，避免它把 fixed 控件定位基准变为容器。

移动目录采用原生 `dialog.showModal()`，提供 inert、Escape 关闭、打开按钮焦点恢复、44px 触摸目标、安全区和动态视口适配；首尾的 Tab／Shift+Tab 另做局部循环，避免 Chromium 将焦点交给浏览器界面。点目录链接、点遮罩、切换为桌面宽度和 SPA 清理均恢复滚动状态。支持 reduced-motion、reduced-transparency 和打印场景。

## 验证与复现

```sh
npm ci
npm run check
npm test
npm run test:smoke
npx playwright install chromium
npm run test:e2e
```

`npm run check` 的 precheck 安装锁定插件；smoke 输出在 `.quartz/smoke-public/`。完整源码、测试和固定图片属于 Git；生成内容、浏览器报告和截图不提交。

- 当前本地 Node 24.22.3：225 个单元／集成测试通过；TypeScript 与全仓格式检查通过。测试 runner 显式传入所有文件，Node 22 的验证以 CI 为准。
- 合成站点包含 54 个索引页：检查 Folder Note 与扩展名为空的 alias、正文／搜索／附件的未发布排除、45 行分页 SSR 回退，以及第二个视图恰好 3 行且 rank 为 44、42、40。
- CI 在 Ubuntu Node 22、Ubuntu Node 24、Windows Node 24 运行类型／格式／测试／合成构建；Ubuntu Node 24 额外执行 Chromium 浏览器回归，并上传报告与可审查截图。
- 浏览器测试覆盖响应式布局、主题、分页与搜索、独立视图、目录焦点与关闭、SPA 返回和 WebP 选择；浏览器结果以 PR 的 Actions 记录为准。为保证确定性，测试阻止外部请求，采用系统 Noto CJK 字体；外部字体、分析服务与图谱 CDN 未纳入该套测试，截图中的图谱为加载失败的回退状态。

工作环境未连接独立 `obsidian-vault`，没有执行真实内容构建或部署。工作区 Chromium 被运行环境限制，远程浏览器也无法访问工作区预览，所以本地没有浏览器通过或性能跑分的结论。真实 vault 的内容特例仍需在发布流程中用项目既有 `quartz-safe-deploy` 检查。

## 后续优先级

1. 用真实公开内容复核中文长标题、大型 Bases、重名附件和目录笔记；分别记录构建时间、HTML／JS／图片传输和交互耗时，建立性能预算。
2. 单独规划上游 npm 插件和核心处理器迁移，先验证 local plugin contract、锁定版本、发布过滤和别名，再逐项替换。
3. 数据规模继续增长时，再考虑 Bases 的数据切片／索引加载和搜索索引分片；当前完整 SSR 回退保留了初始传输和内存成本。
4. 把字体策略作为单独的视觉与性能选择：目前保留 Google Fonts 和霞鹜文楷，字体网络与外部服务不属于此次优化的量化结果。
