/** Local contract/lifecycle tests. Does not claim an official IDE build or phone/native publication. */
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

if (typeof vm.SourceTextModule !== 'function') {
  execFileSync(process.execPath, ['--experimental-vm-modules', fileURLToPath(import.meta.url)], { stdio: 'inherit' });
  process.exit(0);
}
const root = new URL('./example/', import.meta.url);
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function equal(value, expected, message) { assert.deepEqual(JSON.parse(JSON.stringify(value)), expected, message); checks++; }
const text = file => readFile(new URL(file, root), 'utf8');
async function loadEsm(file, globals = {}, overrides = {}) {
  const context = vm.createContext(globals), cache = new Map();
  assert(!('require' in context) && !('module' in context), 'ESM检查环境不提供CommonJS全局桩');
  const replacements = new Map(Object.entries(overrides).map(([name, value]) => [new URL(name, root).href, value]));
  async function load(url) {
    if (cache.has(url.href)) return cache.get(url.href);
    assert(url.href.startsWith(root.href), '模块只能从本工程加载');
    const module = replacements.has(url.href)
      ? new vm.SyntheticModule(['default'], function () { this.setExport('default', replacements.get(url.href)); }, { context, identifier: url.href })
      : new vm.SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href });
    cache.set(url.href, module);
    return module;
  }
  const entry = await load(new URL(file, root));
  await entry.link((specifier, parent) => {
    assert(specifier.startsWith('.') && specifier.endsWith('.js'), '真实编译器要求相对ESM导入显式.js扩展名');
    return load(new URL(specifier, parent.identifier));
  });
  await entry.evaluate();
  return entry.namespace;
}
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) await walk(url); else files.push(url);
  }
}
await walk(root);
for (const file of files) {
  if (file.pathname.endsWith('.json')) { JSON.parse(await readFile(file, 'utf8')); checks++; }
  if (file.pathname.endsWith('.js')) { new vm.SourceTextModule(await readFile(file, 'utf8'), { identifier: file.href }); checks++; }
}
check(!files.some(file => /\.(wxml|wxss)$/.test(file.pathname)), '必须使用官方XHSML/CSS扩展名');
const app = JSON.parse(await text('app.json'));
check(app.pages.length === 1 && app.pages[0] === 'pages/publish/index', '小组件只有一个页面，pages保持官方数组格式');
check(Object.keys(app).every(key => ['pages', 'window', 'networkTimeout', 'permission', 'usingComponents'].includes(key)), '只使用小组件全局配置已列出的字段，不造类型或入口标记');
const sourceBytes = (await Promise.all(files.map(async file => (await readFile(file)).byteLength))).reduce((total, bytes) => total + bytes, 0);
check(sourceBytes <= 2 * 1024 * 1024, '本地源文件不超过2MiB工程预算，官方编译包体仍待IDE核对');
for (const page of app.pages) for (const ext of ['js', 'json', 'xhsml', 'css']) {
  check(files.some(file => file.pathname === new URL(page + '.' + ext, root).pathname), '页面具有四类官方文件');
}
check(!files.some(file => /project\.config\.json$/.test(file.pathname)), '不猜测官方IDE元数据');
const template = await text('pages/publish/index.xhsml');
check(template.includes('<post-note-button') && template.includes('binderror="onPostError"'), '使用官方原生组件及文档错误事件');
check(!/bindsuccess|bindpublishsuccess|bindtap="(?:publish|prepare)|wx:/.test(template), '不捏造成功回调、不用tap宣称发布');
check(!/取图码|专属码|服务选择|agreement|agreed|preparePublisher|保存|复制/.test(template), '顾客不用旧取图码、服务和额外确认步骤');
check(template.includes('bindtap="goHome"') && template.includes('回到首页'), '明显回到首页');
check(template.includes('mode="aspectFit"') && !template.includes('mode="aspectFill"'), '保持原图及其说明不裁切');
check(template.includes('nativeEnabled && publisher && !busy'), '身份和图文状态共同控制真实组件');
const config = (await loadEsm('config.js')).default;
check(config.apiBase === 'https://jmryqyx.cn/aidog-share', '使用爱多格现有真实服务入口');
check(config.ownAppId === '' && config.enablePostNoteButton === false, '没有AppID时发布默认禁用');
const css = await text('app.css');
const font = await readFile(new URL('./resources/yahei-ui.woff2', import.meta.url));
check(font.subarray(0, 4).toString() === 'wOF2', '审计副本是真实WOFF2文件');
check(css.includes('@font-face') && css.includes(font.toString('base64')), 'CSS实际引用同一内嵌字体，不仅声明family');
check(css.includes('Microsoft YaHei') && !/font-family:[^;]*(?:Arial|PingFang|Inter)/.test(css), '微软雅黑字体声明一致');
check(!files.some(file => /\.(?:woff2?|md)$/.test(file.pathname)), '可上传目录不含白名单未列的字体文件或说明文档');
check(files.every(file => /\.(?:js|json|xhsml|css|png|jpg)$/.test(file.pathname)), '可上传工程资源全部使用官方白名单中当前实际需要的类型');
for (const name of ['adog-logo.png', 'xhs.jpg']) {
  const bytes = await readFile(new URL('assets/' + name, root));
  check(name.endsWith('.png') ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])), '实际品牌图片按正确格式随工程打包');
}

const apiSource = await text('lib/api.js');
check(!/\/consume|share-receipt|packages\/next|unlock|serviceType|albumId|console\./.test(apiSource), '原生线路不触发交付、旧服务或私册接口');
let pendingApi = null;
let nextApiResponse = null;
const calls = [], aborted = [];
const fakeBearer = 'a'.repeat(64);
const api = (await loadEsm('lib/api.js', {
  Promise, Error,
  xhs: { request(options) {
    calls.push(options);
    const task = { abort() { aborted.push(options.url); options.fail({ errMsg: 'abort' }); } };
    if (nextApiResponse === 'pending') { pendingApi = options; return task; }
    const response = nextApiResponse;
    nextApiResponse = null;
    queueMicrotask(() => {
      if (response && response.fail) return options.fail({ errMsg: 'offline' });
      options.success(response || { statusCode: 200, data: options.url.includes('bootstrap') ? { ok: true, guestToken: fakeBearer, capabilities: { packages: true } } : { ok: true, pack: null } });
    });
    return task;
  } },
})).default;
await api.bootstrap();
await api.start({ currentId: 'one', next: true, skip: Array.from({ length: 60 }, (_, i) => 'seen-' + i), serviceType: 'vaccine', channel: 'reviews', albumId: 'PRIVATE' });
check(calls[0].url.endsWith('/api/bootstrap?client=miniapp') && !calls[0].header.Authorization, '原生游客初始化');
check(calls[1].url.endsWith('/api/quick-share/start') && calls[1].header.Authorization === 'Bearer ' + fakeBearer, '同一游客Bearer取批次');
equal(calls[1].data, { channel: 'xhs', platform: 'xhs', currentId: 'one', next: true, skip: Array.from({ length: 50 }, (_, i) => 'seen-' + (i + 10)) }, '请求固定XHS双库scope且限定浏览记录');
check(calls.every(c => !c.url.includes(fakeBearer) && !c.header.Cookie && !c.header.Origin && !c.header.Referer), 'Bearer不入URL，不伪造浏览器头');
nextApiResponse = { statusCode: 401, data: { ok: false, error: '会话过期' } };
await assert.rejects(api.start(), /会话过期/); checks++;
const countAfter401 = calls.length;
await api.start();
check(calls.length === countAfter401 + 2 && calls[countAfter401].url.includes('bootstrap'), '401清除内存令牌，下次明确重试先重新初始化');
check(!calls[countAfter401].header.Authorization, '重新初始化不携带失效令牌');
nextApiResponse = 'pending';
const cancelResult = api.start().catch(error => error.message);
await new Promise(resolve => setImmediate(resolve));
api.cancel();
check((await cancelResult).includes('无法连接') && aborted.length === 1 && pendingApi, '退出终止真实RequestTask');

const publisher = (await loadEsm('lib/publisher.js', { Error, String, Array, JSON })).default;
const clock = { now: 1800000000000 };
function fixture(id = 'one') {
  return {
    id, channel: 'xhs', serviceType: 'general', status: 'reserved', reservedByMe: true,
    reservedUntil: clock.now + 900000,
    title: '旧稿不能优先', body: '旧正文',
    materials: [1, 2, 3].map(i => ({ id: id + '-photo-' + i, url: 'https://own-test.invalid/api/image/' + id + '-' + i + '?access=LOCAL_TEST' })),
  };
}
function result(id = 'one') { return { pack: fixture(id), platformCopies: { xhs: [{ id: id + '-copy-a', title: id + '第一稿', body: '等了二十分钟，狗狗叫豆豆。不满意的地方保留。' }, { id: id + '-copy-b', title: id + '第二稿', body: '不强加赞美，也不补写疗效。' }] } }; }
let enabledDefinition;
const enabledRequests = [];
await loadEsm('pages/publish/index.js', {
  Page: definition => { enabledDefinition = definition; }, Promise, Error, Date: { now: () => clock.now }, Math, Number, Array, JSON,
  setTimeout: () => 1, clearTimeout: () => {},
  xhs: { request(options) {
    enabledRequests.push(options);
    queueMicrotask(() => options.success({ statusCode: 200, data: options.url.includes('bootstrap')
      ? { ok: true, guestToken: fakeBearer, capabilities: { packages: true } }
      : { ok: true, ...result() } }));
    return { abort() {} };
  } },
}, { 'config.js': { ...config, ownAppId: 'LOCAL_TEST_APP_ID', enablePostNoteButton: true } });
const enabledPage = { ...enabledDefinition, data: structuredClone(enabledDefinition.data) };
enabledPage.setData = patch => { enabledPage.data = { ...enabledPage.data, ...patch }; };
enabledPage.onLoad();
for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
check(enabledPage.data.nativeEnabled === true && enabledPage.data.pack.id === 'one' && enabledPage.data.publisher.title === 'one第一稿' && !enabledPage.data.error, '无require/module的真实ESM模块图可执行onLoad，启用配置后不再停留默认false状态');
check(enabledRequests.length === 2 && enabledRequests[0].url.endsWith('/api/bootstrap?client=miniapp') && enabledRequests[1].url.endsWith('/api/quick-share/start') && enabledRequests[1].header.Authorization === 'Bearer ' + fakeBearer, 'ESM页面通过真实api/publisher模块完成游客初始化及三图配稿请求');
enabledPage.onUnload();
const validPack = fixture();
const payload = publisher.data(validPack, { title: '', body: '' });
equal(JSON.parse(payload.mediaInfo), { image_resources: validPack.materials.map(p => ({ url: p.url })) }, '媒体参数是JSON字符串且保持3图顺序');
check(payload.title === '' && payload.content === '', '允许顾客删空选填文字，不自动补写');
check(!publisher.enabled(config), '无身份不启用原生组件');
check(!publisher.enabled({ ownAppId: 'YOUR_APP_ID', enablePostNoteButton: true }), '占位AppID不能开通');
check(publisher.enabled({ ownAppId: 'LOCAL_TEST_APP_ID', enablePostNoteButton: true }), '仅明确配置的身份进入原生待验证线路');
for (const bad of [
  { ...validPack, channel: 'reviews' }, { ...validPack, serviceType: 'vaccine' },
  { ...validPack, reservedByMe: false }, { ...validPack, materials: validPack.materials.slice(0, 2) },
  { ...validPack, materials: validPack.materials.map(p => ({ ...p, url: 'http://insecure.invalid/a.jpg' })) },
  { ...validPack, materials: validPack.materials.map(p => ({ ...p, url: p.url + '&download=1' })) },
  { ...validPack, materials: [validPack.materials[0], validPack.materials[0], validPack.materials[2]] },
]) { assert.throws(() => publisher.data(bad, { title: '标题', body: '正文' })); checks++; }
assert.throws(() => publisher.data(validPack, { title: '长'.repeat(21), body: '' }), /20/); checks++;
assert.throws(() => publisher.data(validPack, { title: '', body: '长'.repeat(1001) }), /1000/); checks++;

let pageDefinition;
let response = result();
let pendingStart = null;
let startCalls = [];
let canceled = 0;
const previews = [], scrolls = [], timers = new Map();
let timerSequence = 0;
const mockApi = {
  bootstrap: async () => ({}), cancel: () => canceled++,
  start: options => {
    startCalls.push(structuredClone(options));
    if (response === 'pending') return new Promise(resolve => { pendingStart = resolve; });
    if (response instanceof Error) return Promise.reject(response);
    return Promise.resolve(structuredClone(response));
  },
};
await loadEsm('pages/publish/index.js', {
  Page: value => { pageDefinition = value; }, Promise, Error, Date: { now: () => clock.now }, Math, Number, Array, JSON,
  setTimeout: (callback, delay) => { const id = ++timerSequence; timers.set(id, { callback, delay }); return id; },
  clearTimeout: id => timers.delete(id),
  xhs: { previewImage: options => previews.push(options), pageScrollTo: options => scrolls.push(options) },
}, { 'lib/api.js': mockApi, 'lib/publisher.js': publisher, 'config.js': config });
const page = { ...pageDefinition, data: structuredClone(pageDefinition.data) };
page.setData = patch => { page.data = { ...page.data, ...patch }; };
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
page.onLoad(); await settle();
check(page.data.pack.id === 'one' && page.data.draft.title === 'one第一稿', '首次游客直接显示本库三图和平台备稿，不用先选服务');
check(page.data.variant === 1 && page.data.variantCount === 2 && !page.data.nativeEnabled, '首稿计数正确，身份仍待配置');
check(timers.size === 1 && [...timers.values()][0].delay === 840000, '预留到期前一分钟刷新');
check(page.data.publisher && page.data.sessionInfo.packageId === 'one' && !JSON.stringify(page.data.sessionInfo).includes(fakeBearer), '媒体已准备，关联字段不含令牌');
check(!('published' in page.data) && !('prepared' in page.data) && !('agreed' in page.data), '没有假成功或旧多步确认状态');
const firstPhotos = JSON.stringify(page.data.pack.materials), startCount = startCalls.length;
page.onBodyInput({ detail: { value: '我等了二十分钟。豆豆不喜欢吹风，不能写成喜欢。' } });
for (const method of ['onShareAppMessage', 'onShareChat', 'onCopyUrl']) {
  const share = page[method]();
  check(share.path === '/pages/publish/index' && share.query === '', '官方分享事件仅回到本组件公开首页，不携带游客当前批次');
  check(!JSON.stringify(share).includes(fakeBearer) && !JSON.stringify(share).includes('LOCAL_TEST') && !JSON.stringify(share).includes('不能写成喜欢') && !JSON.stringify(share).includes(page.data.pack.materials[0].url), '分享数据无Bearer、签名原图或本人草稿');
}
check(startCalls.length === startCount && JSON.stringify(page.data.pack.materials) === firstPhotos, '调用分享配置不联网、不换图、不改库存');
const shareCover = 'https://xiaoxiao430.github.io/adog-xiaohongshu/share/brand/adog-logo.png';
check(page.onShareChat().externalImageUrl === shareCover && page.onCopyUrl().externalImageUrl === shareCover && page.onShareChat().imageUrl === shareCover && page.onShareAppMessage().imageUrl === shareCover, '站外封面显式固定公开Logo，不使用默认栈顶截图；站内卡片也固定Logo');
const originalState = page.data;
const sharesBeforePrivateChanges = ['onShareAppMessage', 'onShareChat', 'onCopyUrl'].map(method => page[method]());
page.data = {
  ...originalState,
  draft: { title: '私有修改标题', body: '不可出现在分享截图的本人改稿' },
  sessionInfo: { privateMarker: 'PRIVATE_SESSION_MARKER' },
  pack: { ...originalState.pack, materials: [{ url: 'https://private.invalid/photo?access=PRIVATE_PHOTO_MARKER' }] },
};
const sharesAfterPrivateChanges = ['onShareAppMessage', 'onShareChat', 'onCopyUrl'].map(method => page[method]());
page.data = originalState;
equal(sharesAfterPrivateChanges, JSON.parse(JSON.stringify(sharesBeforePrivateChanges)), '替换本人改稿、原图签名及session后分享配置完全不变，封面仍只用公开Logo');
page.anotherCopy();
check(page.data.variant === 2 && page.data.draft.title === 'one第二稿', '换文案轮到下一条');
check(startCalls.length === startCount && JSON.stringify(page.data.pack.materials) === firstPhotos, '换文案不联网、不动图片');
page.anotherCopy();
check(page.data.variant === 1 && page.data.draft.body.includes('不能写成喜欢'), '轮回恢复同图同稿的本人修改');
page.onTitleInput({ detail: { value: '超'.repeat(21) } });
check(page.data.draft.title.length === 21 && !page.data.publisher && page.data.draftError.includes('20'), '超长内容保留原文并阻止发布，不静默截断');
page.onTitleInput({ detail: { value: '我改的标题' } });
check(page.data.publisher.title === '我改的标题', '改正后恢复组件数据');
response = { ...result(), sameAsCurrent: true };
await page.nextPack();
check(page.data.pack.id === 'one' && page.data.draft.title === '我改的标题' && page.data.hint.includes('仍保留'), '无下一批保留当前图片和修改');
equal(startCalls.at(-1), { currentId: 'one', next: true, skip: ['one'] }, '下一批传当前ID及浏览记录');
response = result('two');
await page.nextPack();
check(page.data.pack.id === 'two' && page.data.draft.title === 'two第一稿', '换批同时换对应第一稿，不串旧稿');
response = result('one');
await page.nextPack();
check(page.data.pack.id === 'one' && page.data.draft.title === '我改的标题', '再次浏览恢复该批已改文案');
page.onBodyInput({ detail: { value: '不满意也保留，等待时间不变。' } });
clock.now += 60000;
response = result('one');
await page.refreshPublisher();
check(page.data.draft.body === '不满意也保留，等待时间不变。' && page.data.pack.reservedUntil === clock.now + 900000, '续租更新图片与期限，不改本人文字');
equal(startCalls.at(-1), { currentId: 'one' }, '续租只重读当前XHS批次，不记录下载');
response = new Error('模拟响应丢失');
await page.nextPack();
check(page.data.pack.id === 'one' && page.data.draft.body.includes('不满意') && !page.data.publisher && !page.data.leaseValid, '换批响应丢失保留文字并要求核实当前预留');
response = result('one');
await page.refreshPublisher();
check(page.data.publisher && page.data.leaseValid, '再次成功核实本批后恢复有效媒体');
page.previewPhoto({ currentTarget: { dataset: { index: 1 } } });
check(previews[0].current === page.data.pack.materials[1].url && previews[0].urls.length === 3, '点图预览三张原图');
page.goHome();
check(scrolls[0].scrollTop === 0 && page.data.draft.body.includes('不满意'), '明显回首页保留当前内容');
page.onPostError({ detail: { errMsg: '本地模拟官方参数错误' } });
check(page.data.error === '本地模拟官方参数错误' && !('published' in page.data), '官方参数错误可恢复且不宣称已发');
page.onHide();
check(timers.size === 0, '后台暂停续租定时器');
clock.now += 901000;
response = 'pending';
page.onShow();
check(page.data.busy && !page.data.publisher && !page.data.leaseValid, '返回时过期链接先禁用再核实');
await settle();
pendingStart(result('one')); await settle();
check(page.data.publisher && page.data.draft.body.includes('不满意'), '返回刷新成功后仍使用本人修改稿');
const stateBeforeUnload = JSON.stringify(page.data);
response = 'pending';
page.nextPack(); await settle();
page.onUnload();
pendingStart(result('two')); await settle();
check(page.data.pack.id === 'one' && canceled === 1 && timers.size === 0, '离开后旧响应不能换图、重开定时器或遗留请求');
check(!stateBeforeUnload.includes('published'), '客户端始终无发布成功声明');
check(!/consume|shareReceipt|manual_confirm|system_share/.test(await text('pages/publish/index.js')), '原生发布不冒充照片交付');

const temporary = await mkdtemp(path.join(tmpdir(), 'aidog-miniapp-ide-'));
try {
  const actualProject = path.join(temporary, 'official-created');
  const output = path.join(temporary, 'complete');
  await mkdir(actualProject);
  const metadata = '{"fixture":"metadata generated by test only","futureOfficialField":{"kept":true}}\n';
  await writeFile(path.join(actualProject, 'project.config.json'), metadata);
  const script = fileURLToPath(new URL('./scripts/prepare-ide-project.mjs', import.meta.url));
  execFileSync(process.execPath, [script, '--project', actualProject, '--out', output], { stdio: 'pipe' });
  check((await readFile(path.join(output, 'project.config.json'), 'utf8')) === metadata, '合并工程完整原样保留官方元数据，不猜字段');
  check((await readFile(path.join(output, 'pages/publish/index.xhsml'), 'utf8')).includes('<post-note-button'), '合并输出包含完整原生页面');
  check((await readFile(path.join(output, 'config.js'), 'utf8')).includes("ownAppId: ''"), '没有提供身份时不能生成AppID');
  assert.throws(() => execFileSync(process.execPath, [script, '--project', actualProject, '--out', output], { stdio: 'pipe' })); checks++;
  check((await readFile(path.join(output, 'project.config.json'), 'utf8')) === metadata, '拒绝覆盖已有工程');
  const preview = path.join(temporary, 'internal-preview');
  assert.throws(() => execFileSync(process.execPath, [script, '--project', actualProject, '--out', preview, '--enable-native-preview'], { stdio: 'pipe' })); checks++;
  execFileSync(process.execPath, [script, '--project', actualProject, '--out', preview, '--app-id', 'LOCAL_TEST_APP_ID', '--enable-native-preview'], { stdio: 'pipe' });
  const previewConfig = await readFile(path.join(preview, 'config.js'), 'utf8');
  check(previewConfig.includes('ownAppId: "LOCAL_TEST_APP_ID"') && previewConfig.includes('enablePostNoteButton: true'), '自有测试身份可直接启用内部原生预览，不循环等待验收');
  check((await text('config.js')).includes("ownAppId: ''") && (await text('config.js')).includes('enablePostNoteButton: false'), '测试预览只改新工程，不修改模板或线上ready');
  const oversized = path.join(temporary, 'oversized-widget');
  await writeFile(path.join(actualProject, 'project.config.json'), JSON.stringify({ fixture: 'x'.repeat(2 * 1024 * 1024) }));
  assert.throws(() => execFileSync(process.execPath, [script, '--project', actualProject, '--out', oversized], { stdio: 'pipe' }), /2MiB/); checks++;
  check(!(await readdir(temporary)).includes('oversized-widget'), '超过本地预算时在创建输出前停止');

} finally { await rm(temporary, { recursive: true, force: true }); }
console.log(`爱多格联网小组件本地验证通过：${checks}项，源文件${sourceBytes}字节。仅语法、合同、生命周期、分享配置与工程合并；未执行官方IDE构建或真机发布。`);
