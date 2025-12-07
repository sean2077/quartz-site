#!/usr/bin/env node
/**
 * 遍历指定目录下的所有 md 文件，在其 frontmatter 中添加指定的文档属性
 * 基于 gray-matter 库实现，与 Quartz 使用相同的 frontmatter 解析方式
 *
 * 用法:
 *   node scripts/add-frontmatter.mjs <目录路径> <属性名> <属性值>
 *
 * 示例:
 *   node scripts/add-frontmatter.mjs ./content publish true
 *   node scripts/add-frontmatter.mjs ./content draft false
 *   node scripts/add-frontmatter.mjs ./content "tags" '["note", "blog"]'
 *
 * 选项:
 *   --dry-run    只显示将要修改的文件，不实际修改
 *   --overwrite  如果属性已存在，覆盖其值（默认跳过）
 */

import fs from "fs/promises"
import path from "path"
import { globby } from "globby"
import matter from "gray-matter"
import yaml from "js-yaml"

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    dryRun: false,
    overwrite: false,
    directory: null,
    property: null,
    value: null,
  }

  const positionalArgs = []

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true
    } else if (arg === "--overwrite") {
      options.overwrite = true
    } else if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    } else {
      positionalArgs.push(arg)
    }
  }

  if (positionalArgs.length < 3) {
    console.error("❌ 错误: 缺少必要参数")
    printHelp()
    process.exit(1)
  }

  options.directory = positionalArgs[0]
  options.property = positionalArgs[1]
  options.value = positionalArgs[2]

  return options
}

function printHelp() {
  console.log(`
用法: node scripts/add-frontmatter.mjs <目录路径> <属性名> <属性值> [选项]

参数:
  <目录路径>    要遍历的目录路径
  <属性名>      要添加的 frontmatter 属性名
  <属性值>      要设置的属性值（支持 JSON 格式的复杂值）

选项:
  --dry-run     只显示将要修改的文件，不实际修改
  --overwrite   如果属性已存在，覆盖其值（默认跳过已存在的属性）
  -h, --help    显示帮助信息

示例:
  node scripts/add-frontmatter.mjs ./content publish true
  node scripts/add-frontmatter.mjs ./content draft false --overwrite
  node scripts/add-frontmatter.mjs ./content "tags" '["note", "blog"]' --dry-run

值类型说明:
  - "true" / "false" 会被解析为布尔值
  - 纯数字会被解析为数字
  - JSON 格式的数组/对象会被解析为对应类型
  - 其他值保持为字符串
`)
}

// 解析属性值，支持多种类型
function parseValue(value) {
  // 布尔值
  if (value === "true") return true
  if (value === "false") return false

  // 数字
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value)
  }

  // JSON 数组或对象
  if (
    (value.startsWith("[") && value.endsWith("]")) ||
    (value.startsWith("{") && value.endsWith("}"))
  ) {
    try {
      return JSON.parse(value)
    } catch {
      // 解析失败，保持为字符串
    }
  }

  // 默认为字符串
  return value
}

// 处理单个文件
async function processFile(filePath, options) {
  const { property, value, dryRun, overwrite } = options

  try {
    const content = await fs.readFile(filePath, "utf-8")

    // 使用 gray-matter 解析 frontmatter
    const parsed = matter(content, {
      engines: {
        yaml: (s) => yaml.load(s, { schema: yaml.JSON_SCHEMA }),
      },
    })

    const parsedValue = parseValue(value)
    let action

    // 检查属性是否已存在
    if (property in parsed.data) {
      if (overwrite) {
        parsed.data[property] = parsedValue
        action = "更新"
      } else {
        return { status: "skipped", reason: "属性已存在" }
      }
    } else {
      parsed.data[property] = parsedValue
      action = "添加"
    }

    // 使用 gray-matter 重新生成文件内容
    const newContent = matter.stringify(parsed.content, parsed.data, {
      engines: {
        yaml: {
          stringify: (obj) =>
            yaml.dump(obj, {
              schema: yaml.JSON_SCHEMA,
              lineWidth: -1, // 不自动换行
              quotingType: '"',
              forceQuotes: false,
            }),
        },
      },
    })

    if (!dryRun) {
      await fs.writeFile(filePath, newContent, "utf-8")
    }

    return { status: "modified", action }
  } catch (error) {
    return { status: "error", reason: error.message }
  }
}

async function main() {
  const options = parseArgs()
  const { directory, property, value, dryRun } = options

  console.log(`\n📁 目录: ${directory}`)
  console.log(`📝 属性: ${property}: ${value}`)
  console.log(`🔧 模式: ${dryRun ? "预览模式 (dry-run)" : "实际修改"}`)
  console.log(`📋 覆盖: ${options.overwrite ? "是" : "否"}\n`)

  // 检查目录是否存在
  try {
    await fs.access(directory)
  } catch {
    console.error(`❌ 错误: 目录不存在: ${directory}`)
    process.exit(1)
  }

  // 查找所有 md 文件
  const pattern = path.join(directory, "**/*.md").replace(/\\/g, "/")
  const files = await globby(pattern)

  if (files.length === 0) {
    console.log("⚠️ 未找到任何 .md 文件")
    return
  }

  console.log(`🔍 找到 ${files.length} 个 .md 文件\n`)

  const results = {
    modified: 0,
    skipped: 0,
    errors: 0,
  }

  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file)
    const result = await processFile(file, options)

    if (result.status === "modified") {
      console.log(`✅ ${dryRun ? "[预览]" : ""} ${result.action}: ${relativePath}`)
      results.modified++
    } else if (result.status === "skipped") {
      console.log(`⏭️  跳过: ${relativePath} (${result.reason})`)
      results.skipped++
    } else if (result.status === "error") {
      console.log(`❌ 错误: ${relativePath} (${result.reason})`)
      results.errors++
    }
  }

  console.log(`\n📊 统计:`)
  console.log(`   ${dryRun ? "将修改" : "已修改"}: ${results.modified} 个文件`)
  console.log(`   跳过: ${results.skipped} 个文件`)
  console.log(`   错误: ${results.errors} 个文件`)

  if (dryRun && results.modified > 0) {
    console.log(`\n💡 提示: 这是预览模式，实际文件未被修改。移除 --dry-run 参数以执行实际修改。`)
  }
}

main().catch(console.error)
