import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Sean's Blog",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    // Google Search Console 验证码，fork 后请替换为你自己的
    googleSiteVerification: "cVJjK0bzRs-HKM4xz3cY6OMNG_ZaatotiR95JwYt3yw",
    locale: "zh-CN",
    baseUrl: "sean2077.pages.dev",
    ignorePatterns: [
      "private",
      "templates",
      ".obsidian",
      ".git",
      ".ref",
      ".tools",
      ".vscode",
      "_obscripts",
      "0*/**",
      "2*/**",
      // "9Z 系统区" subdirectories exclusion:
      // Exclude all subdirectories except "附件" (attachments)
      // Note: extglob patterns like "9Z 系统区/!(附件)/**" don't work reliably in micromatch
      // So we list specific subdirectories to exclude explicitly
      "9Z 系统区/背景/**",
      "9Z 系统区/模板/**",
      "9Z 系统区/示例/**",
      "9Z 系统区/*.md", // Exclude markdown files in the root of 9Z 系统区
      // The "9Z 系统区/附件" folder is NOT excluded so OnDemandAssets can copy referenced images
      "1Y LeetCode/**", // leetcode 问题库
    ],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: { name: "LXGW WenKai", weights: [400, 700] },
        body: { name: "LXGW WenKai", weights: [300, 400, 500, 700], includeItalic: false },
        code: "Fira Code",
      },
      colors: {
        lightMode: {
          light: "#faf6ef", // 内容区背景基色 (温暖的纸张色)
          lightgray: "#e8e4dc", // 边框、分隔线 (暖灰)
          gray: "#8a857c", // 次要文字 (加深)
          darkgray: "#3a3632", // 正文文字 (加深，提高对比度)
          dark: "#1a1816", // 标题文字 (更深)
          secondary: "#2d5a6b", // 链接、h1/h2 颜色 (加深)
          tertiary: "#4d8577", // 链接悬停色 (加深)
          highlight: "rgba(143, 159, 169, 0.12)", // 高亮背景
          textHighlight: "#fff23688", // 文字高亮 (黄色)
        },
        darkMode: {
          light: "#232328", // 内容区背景基色 (深灰)
          lightgray: "#393639", // 边框、分隔线
          gray: "#7a7a7a", // 次要文字 (加亮)
          darkgray: "#e8e8e8", // 正文文字 (加亮，提高对比度)
          dark: "#f5f5f5", // 标题文字 (更亮)
          secondary: "#8eadc2", // 链接、h1/h2 颜色 (加亮)
          tertiary: "#9cc4b5", // 链接悬停色 (加亮)
          highlight: "rgba(143, 159, 169, 0.15)", // 高亮背景
          textHighlight: "#b3aa0288", // 文字高亮 (橙黄)
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.LeetCodeLinks(), // Convert LeetCode wiki-links to external links (must be before OFM)
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({
        renderEngine: "katex",
        katexOptions: {
          strict: false,
        },
      }),
      // Custom plugins for on-demand assets and folder notes
      Plugin.CollectAssets(),
      Plugin.MarkFolderNotes(),
      // Obsidian Bases support (database views)
      Plugin.ObsidianBases(),
      // Note: StoreFolderNotes is no longer needed - FolderNotes filter now stores folder notes
    ],
    filters: [Plugin.RemoveDrafts(), Plugin.ExplicitPublish(), Plugin.FolderNotes()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderNotePage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.OnDemandAssets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // CustomOgImages 暂时禁用：LXGW WenKai 字体不被 satori 支持
      // Plugin.CustomOgImages(),
    ],
  },
}

export default config
