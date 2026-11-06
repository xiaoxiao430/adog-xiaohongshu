/** Merge complete app source with real, official IDE-generated metadata. Never invent an AppID. */
import { readFile, stat, mkdir, cp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length;) {
  if (args[i] === '--enable-native-preview' && !options[args[i]]) {
    options[args[i]] = true; i++; continue;
  }
  if (!['--project', '--out', '--app-id'].includes(args[i]) || !args[i + 1] || options[args[i]]) {
    throw new Error('用法：node scripts/prepare-ide-project.mjs --project 官方IDE已建项目 --out 新输出目录 [--app-id 自己的公开AppID] [--enable-native-preview]');
  }
  options[args[i]] = args[i + 1];
  i += 2;
}
if (!options['--project'] || !options['--out']) throw new Error('必须提供官方IDE已建项目和新的输出目录。');
const source = fileURLToPath(new URL('../example/', import.meta.url));
const project = path.resolve(options['--project']);
const output = path.resolve(options['--out']);
if (output === source || output.startsWith(source + path.sep) || output === project || output.startsWith(project + path.sep)) {
  throw new Error('输出目录必须独立，不能覆盖示例或官方IDE原项目。');
}
const metadata = await readFile(path.join(project, 'project.config.json'));
JSON.parse(metadata.toString('utf8'));
try { await stat(output); throw new Error('输出目录已经存在。请使用新的目录，避免覆盖已有工程。'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const appId = options['--app-id'] || '';
if (appId && (!/^[A-Za-z0-9_-]{6,128}$/.test(appId) || /YOUR_|PLACEHOLDER|EXAMPLE/i.test(appId))) {
  throw new Error('请使用官方后台显示的自己的公开AppID；不能使用占位符。');
}
if (options['--enable-native-preview'] && !appId) throw new Error('启用原生内部预览必须明确提供自己的公开AppID。');
await mkdir(path.dirname(output), { recursive: true });
await cp(source, output, { recursive: true, filter: file => !/project\.(?:private\.)?config\.json$/.test(file) && !/(?:^|\/)node_modules(?:\/|$)/.test(file) });
await writeFile(path.join(output, 'project.config.json'), metadata);
if (appId || options['--enable-native-preview']) {
  const configPath = path.join(output, 'config.js');
  const config = await readFile(configPath, 'utf8');
  let updated = config.replace("ownAppId: ''", 'ownAppId: ' + JSON.stringify(appId));
  if (options['--enable-native-preview']) updated = updated.replace('enablePostNoteButton: false', 'enablePostNoteButton: true');
  await writeFile(configPath, updated);
}
console.log('已生成独立工程：' + output);
console.log('官方IDE元数据原样保留。请在IDE核对AppID、2.0架构、基础库和域名。');
console.log(options['--enable-native-preview'] ? '仅已启用自有测试身份的内部原生预览，不代表官方验收、上线或已发布。' : '发布按钮仍禁用。可用自己的测试AppID开启内部预览并进行真机验证。');
