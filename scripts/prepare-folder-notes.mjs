import fs from 'fs/promises';
import path from 'path';
import { globby } from 'globby';

const args = process.argv.slice(2);
const VAULT = args.find(arg => arg.startsWith('--vault='))?.split('=')[1] ||
    (args.includes('--vault') || args.includes('-v') ? args[args.findIndex(a => a === '--vault' || a === '-v') + 1] : 'obsidian-vault');
const DRY_RUN = args.includes('--dry-run');
const RENAME = args.includes('--rename');
const ADD_TITLE = args.includes('--add-title');
const FORCE_TITLE = args.includes('--force-title');
const ADD_PUBLISH = args.includes('--add-publish');
const HELP = args.includes('--help') || args.includes('-h');

if (HELP || (!RENAME && !ADD_TITLE && !ADD_PUBLISH)) {
    console.log(`
用法: node scripts/prepare-folder-notes.mjs [选项]

选项:
  --rename           将 folder/folder.md 重命名为 folder/index.md
  --add-title        为 index.md 添加基于目录名的 title
  --force-title      强制更新已存在的 title（需配合 --add-title）
  --add-publish      为 index.md 添加 publish: true
  -v, --vault <dir>  指定 vault 目录 (默认: obsidian-vault)
  --dry-run          预览模式，不实际修改文件
  -h, --help         显示此帮助

示例:
  # 重命名所有文件夹笔记
  node scripts/prepare-folder-notes.mjs --rename

  # 添加标题和发布标记
  node scripts/prepare-folder-notes.mjs --add-title --add-publish

  # 一次性完成所有操作（预览）
  node scripts/prepare-folder-notes.mjs --rename --add-title --add-publish --dry-run
  `);
    process.exit(0);
}

async function renameToIndex() {
    const files = await globby('**/*.md', { cwd: VAULT, absolute: false });
    const toRename = files.filter(file => {
        const dir = path.dirname(file);
        const base = path.basename(file, '.md');
        const dirBase = path.basename(dir);
        return base === dirBase && base !== '.' && dir !== '.';
    });

    console.log(`\n📝 重命名: 找到 ${toRename.length} 个文件\n`);

    for (const file of toRename) {
        const from = path.join(VAULT, file);
        const to = path.join(VAULT, path.dirname(file), 'index.md');

        if (DRY_RUN) {
            console.log(`[Dry Run] ${file} -> ${path.dirname(file)}/index.md`);
        } else {
            await fs.rename(from, to);
            console.log(`✓ ${file} -> ${path.dirname(file)}/index.md`);
        }
    }
}

async function addTitles() {
    const files = await globby('**/index.md', { cwd: VAULT, absolute: false });
    let updated = 0;

    console.log(`\n📝 添加标题: 找到 ${files.length} 个 index.md\n`);

    for (const file of files) {
        if (file === 'index.md') continue;

        const filePath = path.join(VAULT, file);
        const content = await fs.readFile(filePath, 'utf-8');

        if (!content.startsWith('---')) {
            console.log(`⚠️  跳过（无 frontmatter）: ${file}`);
            continue;
        }

        const dirName = path.basename(path.dirname(file));
        const hasTitle = /^title:/m.test(content);

        if (hasTitle && !FORCE_TITLE) {
            console.log(`⏭️  跳过（已有 title）: ${file}`);
            continue;
        }

        const lines = content.split('\n');

        if (hasTitle && FORCE_TITLE) {
            // 替换已有的 title
            const titleIndex = lines.findIndex(line => /^title:/.test(line));
            if (titleIndex !== -1) {
                lines[titleIndex] = `title: ${dirName}`;
            }
        } else {
            // 添加新的 title
            lines.splice(1, 0, `title: ${dirName}`);
        }

        if (!DRY_RUN) {
            await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
        }
        console.log(`${DRY_RUN ? '[Dry Run] ' : '✓ '}${file} (标题: ${dirName})`);
        updated++;
    }

    console.log(`\n完成: ${updated} 个文件`);
}

async function addPublish() {
    const files = await globby('**/index.md', { cwd: VAULT, absolute: false });
    let updated = 0;

    console.log(`\n📝 添加 publish: 找到 ${files.length} 个 index.md\n`);

    for (const file of files) {
        const filePath = path.join(VAULT, file);
        const content = await fs.readFile(filePath, 'utf-8');

        if (/^publish:/m.test(content)) {
            console.log(`⏭️  跳过（已有 publish）: ${file}`);
            continue;
        }

        if (!content.startsWith('---')) {
            console.log(`⚠️  跳过（无 frontmatter）: ${file}`);
            continue;
        }

        const frontmatterEnd = content.split('\n').findIndex((line, i) => i > 0 && line.trim() === '---');
        if (frontmatterEnd === -1) continue;

        const lines = content.split('\n');
        lines.splice(frontmatterEnd, 0, 'publish: true');

        if (!DRY_RUN) {
            await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
        }
        console.log(`${DRY_RUN ? '[Dry Run] ' : '✓ '}${file}`);
        updated++;
    }

    console.log(`\n完成: ${updated} 个文件`);
}

async function main() {
    console.log(`🔍 目标目录: ${VAULT}${DRY_RUN ? ' (Dry Run)' : ''}`);

    if (RENAME) await renameToIndex();
    if (ADD_TITLE) await addTitles();
    if (ADD_PUBLISH) await addPublish();

    if (DRY_RUN) {
        console.log('\n⚠️  Dry Run 模式，没有实际修改文件');
    }
}

main().catch(console.error);
