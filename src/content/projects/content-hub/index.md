---
title: 内容站：作品、刷题与学习雷达
slug: content-hub
summary: 把这个站从「作品集」扩成个人内容中心：项目、/now、LeetCode 看板、学习雷达，最后接上站内搜索和 RSS。
status: building
stack: [Astro, Content Collections, YAML, GitHub API, Pagefind]
repo: https://github.com/1yu2/fishplatform
date: 2026-10-16
lang: zh
---

在首页动画和博客之外，把学习和做东西的过程也公开记录下来。所有内容都是仓库里的 Markdown / YAML 文件，改完提交即可上线。

## 分期

1. **Astro + 三语 + 博客**：已上线。
2. **项目 + /now**：就是你现在看到的这一页。项目带状态(进行中 / 已上线 / 暂停)和技术栈,/now 写「正在做 / 在学 / 计划」。
3. **LeetCode 看板 + 学习雷达**：难度环形图、练习热力图、可筛选题目表;雷达只写仓库名和「为什么值得学」,星数和简介构建时从 GitHub API 拉取。
4. **批量导入 + 搜索 + RSS + 评论**：把飞书、CSDN、Notion 上的旧文章搬过来，图片下载到本地，保留指回原文的链接。

## 约定

- 文章和项目不自动翻译：每篇写一种语言，译文用 `translationKey` 关联。
- /now 只放可以公开的内容，私人待办不进仓库。
