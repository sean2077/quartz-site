---
title: 阅读与记录
description: 把零散的发现，整理成值得反复阅读的笔记。
publish: true
tags: [notebook, design]
---

这里收集关于技术、阅读与日常观察的笔记。让知识慢慢连接，也让每一次回访都能找到新的线索。

> [!note] 从一个问题出发
> 好的笔记不急着给出全部答案，而是保留思考的过程。可以从 [[Notes/Reading|阅读与思考]] 开始，或浏览 [[Notes|笔记目录]]。

## 最近的思考

阅读的节奏需要留白。清晰的标题、稳定的正文宽度与克制的强调，让长篇文字也能从容地读下去。**记录事实，连接想法**，再把结论放回真实的问题中检验。

### 代码与结构

行内标识符 `configuration.links.disableBrokenWikilinksAndVeryLongConfigurationName` 应在窄屏中自然换行，代码块则保留独立滚动。

```typescript
const notes = library.filter((note) => note.publish && note.tags.includes("reading"))
const titles = notes.map((note) => ({ title: note.title, updated: note.modified }))
```

## 笔记索引

每个视图保留自己的筛选和排序。分页时可以继续搜索，也可以点击表头改变顺序。

```base
filters:
  and:
    - file.inFolder("samples")
    - file.hasTag("sample")
properties:
  file.name:
    displayName: 笔记
  rank:
    displayName: 序号
  status:
    displayName: 状态
views:
  - type: paginated-table
    name: 全部笔记
    pageSize: 10
    order: [file.name, rank, status]
    sort:
      - property: rank
        direction: asc
  - type: table
    name: 已完成
    filters: status == "done"
    limit: 3
    order: [file.name, rank, status]
    sort:
      - property: rank
        direction: desc
```

## 慢慢积累

有些连接要隔一段时间才会出现。为想法留下一条清晰的路径，比一次写得完整更重要。

![公开样例附件](attachments/visible.svg)

## 延伸阅读

- [[Notes/Reading|阅读与思考]]
- [[Notes|按主题浏览笔记]]
- [[Samples/Note-01|打开第一条样例笔记]]
