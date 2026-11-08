/** Local request preparation only. Never sends requests or generates a URL Link. */
import { access, lstat, open, readFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const OFFICIAL = Object.freeze({
  tokenUrl: 'https://miniapp.xiaohongshu.com/api/rmp/token',
  linkUrl: 'https://miniapp.xiaohongshu.com/api/rmp/url',
  tokenDoc: 'https://miniapp.xiaohongshu.com/doc/DC010382',
  linkDoc: 'https://miniapp.xiaohongshu.com/doc/DC274658',
  introductionDoc: 'https://miniapp.xiaohongshu.com/doc/DC853803',
  // The public URL Link page names app_id/access_token but does not locate them.
  // Do not select query, headers or JSON body until an official contract confirms it.
  linkAuthTransport: null,
  checkedOn: '2026-11-08'
});
const project = fileURLToPath(new URL('../../../', import.meta.url));
export class LinkError extends Error {
  constructor(code, message) { super(message); this.name = 'LinkError'; this.code = code; }
}
function insideProject(filename) {
  const relative = path.relative(project, filename);
  return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
function fail(code, message) { throw new LinkError(code, message); }
function credential(value, name) {
  if (typeof value !== 'string' || !value.trim()) return '';
  if (value !== value.trim() || /[\r\n\0]/.test(value)) fail('invalid_configuration', name + '格式不正确。');
  return value;
}
export function parseArgs(args) {
  const result = { pageUrl: 'pages/publish/index' };
  const names = { '--config': 'config', '--out': 'out', '--page-url': 'pageUrl', '--query': 'query', '--expire-days': 'expireDays' };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const name = names[args[i]];
    if (!name || seen.has(name) || !args[i + 1] || args[i + 1].startsWith('--')) fail('invalid_arguments', '参数不正确。可用 --config、--out、--page-url、--query、--expire-days；凭据只从环境变量或私有文件读取。');
    seen.add(name);
    result[name] = args[i + 1];
  }
  return result;
}
export async function readConfiguration(options = {}, env = process.env) {
  let config = {};
  if (options.config) {
    try {
      if (!path.isAbsolute(options.config)) fail('private_config_required', '私有配置必须使用项目外的绝对路径。');
      const filename = await realpath(options.config);
      const info = await lstat(options.config);
      if (insideProject(filename) || info.isSymbolicLink() || !info.isFile() || (info.mode & 0o077) !== 0 ||
          (typeof process.getuid === 'function' && info.uid !== process.getuid())) fail('private_config_required', '配置须为项目外、本人所有且权限0600的普通私有JSON文件。');
      config = JSON.parse(await readFile(filename, 'utf8'));
      if (!config || Array.isArray(config) || typeof config !== 'object') fail('invalid_configuration', '私有配置必须为JSON对象。');
    } catch (error) {
      if (error instanceof LinkError) throw error;
      fail('private_config_unreadable', '无法读取私有JSON配置，请检查路径、权限和JSON格式。');
    }
  }
  const appId = credential(env.XHS_MINIAPP_APP_ID || config.app_id, '小程序AppID');
  const appSecret = credential(env.XHS_MINIAPP_APP_SECRET || config.app_secret, '小程序AppSecret');
  const accessToken = credential(env.XHS_MINIAPP_ACCESS_TOKEN || config.access_token, '小程序调用凭证');
  if (!appId || (!appSecret && !accessToken)) fail('configuration_missing', '缺少自有小程序配置：须提供XHS_MINIAPP_APP_ID及XHS_MINIAPP_ACCESS_TOKEN或XHS_MINIAPP_APP_SECRET；本次未联网。');
  if (/YOUR_|PLACEHOLDER|EXAMPLE/i.test(appId) || /[\s/?#&=]/.test(appId)) fail('invalid_configuration', '请使用官方控制台中自己的真实小程序AppID，不能使用占位符或小工具身份。');
  return { appId, appSecret, accessToken };
}
export function buildLinkBusinessParameters(options = {}) {
  let pageUrl = options.pageUrl || 'pages/publish/index';
  if (typeof pageUrl !== 'string' || pageUrl.startsWith('/') || /[\s#\0]/.test(pageUrl) || /^[A-Za-z][\w+.-]*:/.test(pageUrl) || pageUrl.includes('..')) fail('invalid_page_url', 'page_url须为不以/开头的小程序页面路径，不能传网页或媒体地址。');
  if (options.query !== undefined) {
    if (typeof options.query !== 'string' || options.query.startsWith('?') || pageUrl.includes('?') || /[\r\n#\0]/.test(options.query)) fail('invalid_query', '短query不带问号；页面路径与--query不能重复带参数。');
    if (options.query) pageUrl += '?' + options.query;
  }
  if (Array.from(pageUrl).length > 1024 || pageUrl.length > 1024) fail('page_url_too_long', 'page_url含query最多1024个字符；请用短批次标识，不要塞图片或长文。');
  const query = pageUrl.split('?')[1] || '';
  for (const [key, value] of new URLSearchParams(query)) {
    if (/(?:image|photo|media|content|body|title|text|secret|token|authorization|authentication|cookie|password|passwd|credential|session|api[_-]?key|access[_-]?key|private[_-]?key|bearer|^pwd$)/i.test(key) || /data:|https?:\/\/|base64,/i.test(value)) fail('media_or_copy_in_query', 'query只放短批次标识等路由参数，不放图片、标题、正文或凭据。');
  }
  const parameters = { page_url: pageUrl };
  if (options.expireDays !== undefined) {
    const days = Number(options.expireDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) fail('invalid_expire_interval', 'expire-days须为1至365的整数；不填使用平台默认365天。');
    parameters.expire_interval = days;
  }
  return parameters;
}
function rejectCredentialsInParameters(parameters, configuration) {
  const values = [JSON.stringify(parameters)];
  const add = value => {
    values.push(value);
    try { values.push(decodeURIComponent(value.replace(/\+/g, ' '))); }
    catch { /* Raw values and individually parsed query values are still checked. */ }
  };
  add(parameters.page_url);
  for (const [key, value] of new URLSearchParams(parameters.page_url.split('?')[1] || '')) {
    add(key);
    add(value);
  }
  if ([configuration.appSecret, configuration.accessToken].filter(Boolean).some(secret => values.some(value => value.includes(secret)))) {
    fail('credential_in_parameters', '参数含凭据信息，已停止；请仅传短批次标识。');
  }
}
export function buildTokenRequest(configuration) {
  if (!configuration.appId || !configuration.appSecret) fail('token_configuration_missing', '准备凭证请求需要自己的小程序AppID和AppSecret。');
  return { url: OFFICIAL.tokenUrl, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appid: configuration.appId, secret: configuration.appSecret }) };
}
export function assertPlatformSuccess(response) {
  if (!response || response.success !== true || response.code !== 0) fail('platform_business_error', '平台响应未成功，错误码：' + (Number.isSafeInteger(response && response.code) ? response.code : '未知') + '。');
  return response.data;
}
async function prepareOutput(filename) {
  if (!filename) return;
  if (!path.isAbsolute(filename)) fail('private_output_required', '--out须为项目外的绝对私有路径。');
  try {
    const parent = await realpath(path.dirname(filename));
    if (insideProject(path.join(parent, path.basename(filename)))) fail('private_output_required', '准备记录请保存在项目外私有目录。');
    await access(parent, constants.W_OK);
    try { await lstat(filename); fail('output_exists', '输出文件已存在，请另选新路径，避免覆盖旧准备记录。'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  } catch (error) {
    if (error instanceof LinkError) throw error;
    fail('private_output_unavailable', '私有输出目录不存在或无法写入；本次未联网。');
  }
}
export async function prepareUrlLinkRequest(options = {}, env = process.env) {
  const configuration = await readConfiguration(options, env);
  const parameters = buildLinkBusinessParameters(options);
  rejectCredentialsInParameters(parameters, configuration);
  await prepareOutput(options.out);
  const result = {
    status: 'request_prepared', link_generated: false, ready_to_send: false,
    request: { method: 'POST', url: OFFICIAL.linkUrl, business_parameters: parameters },
    unresolved: 'DC274658列出app_id/access_token，但未明确其query、header或body位置；未拼接鉴权请求。',
    platform_requests_made: false, wechat_verified: false, native_verified: false
  };
  if (options.out) {
    const file = await open(options.out, 'wx', 0o600);
    try { await file.chmod(0o600); await file.writeFile(JSON.stringify(result, null, 2) + '\n'); }
    finally { await file.close(); }
  }
  return result;
}
export async function main(args = process.argv.slice(2), dependencies = {}) {
  const stdout = dependencies.stdout || (value => process.stdout.write(value + '\n'));
  const stderr = dependencies.stderr || (value => process.stderr.write(value + '\n'));
  try {
    const result = await prepareUrlLinkRequest(parseArgs(args), dependencies.env || process.env);
    stdout(JSON.stringify(result));
    return 0;
  } catch (error) {
    const known = error instanceof LinkError;
    stderr(JSON.stringify({ status: 'not_prepared', code: known ? error.code : 'local_error', message: known ? error.message : '本地处理失败；未输出凭据或平台链接。', link_generated: false, wechat_verified: false, native_verified: false }));
    return 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
