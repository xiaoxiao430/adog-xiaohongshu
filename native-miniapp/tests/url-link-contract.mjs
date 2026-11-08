import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat, chmod, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { OFFICIAL, assertPlatformSuccess, buildLinkBusinessParameters, buildTokenRequest, main, prepareUrlLinkRequest } from '../scripts/prepare-url-link-request.mjs';
const checks = [], secret = 'isolated-private-secret', token = 'isolated-private-token';
const env = { XHS_MINIAPP_APP_ID: 'owned-app-fixture-123', XHS_MINIAPP_APP_SECRET: secret };
let calls = 0;
const oldFetch = globalThis.fetch;
globalThis.fetch = () => { calls++; throw Error('No network permitted'); };
const temporary = await mkdtemp(path.join(os.tmpdir(), 'aidog-url-link-contract-'));
try {
  const tokenRequest = buildTokenRequest({ appId: env.XHS_MINIAPP_APP_ID, appSecret: secret });
  assert.equal(tokenRequest.url, 'https://miniapp.xiaohongshu.com/api/rmp/token');
  assert.equal(tokenRequest.method, 'POST');
  assert.equal(tokenRequest.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(tokenRequest.body), { appid: env.XHS_MINIAPP_APP_ID, secret });
  const prepared = await prepareUrlLinkRequest({}, env);
  assert.equal(prepared.request.url, 'https://miniapp.xiaohongshu.com/api/rmp/url');
  assert.equal(prepared.request.method, 'POST');
  assert.equal(OFFICIAL.linkAuthTransport, null);
  assert.equal(prepared.link_generated, false);
  assert.equal(prepared.ready_to_send, false);
  assert(!JSON.stringify(prepared).includes(secret));
  checks.push('exact official endpoints and token fields; unresolved link authentication is not guessed or reported as generated');
  assert.deepEqual(buildLinkBusinessParameters(), { page_url: 'pages/publish/index' });
  assert.deepEqual(buildLinkBusinessParameters({ query: 'batch=group-3', expireDays: '14' }), { page_url: 'pages/publish/index?batch=group-3', expire_interval: 14 });
  const prefix = 'pages/publish/index?id=';
  assert.equal(buildLinkBusinessParameters({ pageUrl: prefix + 'a'.repeat(1024-prefix.length) }).page_url.length, 1024);
  assert.throws(() => buildLinkBusinessParameters({ pageUrl: prefix + 'a'.repeat(1025-prefix.length) }), { code: 'page_url_too_long' });
  for(const o of [{pageUrl:'/pages/publish/index'},{query:'images=https%3A%2F%2Fexample.invalid%2F1.png'},{query:'body=note'},{expireDays:0},{expireDays:366}]) assert.throws(() => buildLinkBusinessParameters(o));
  checks.push('default page, short query, exact 1024-character limit, expiry range and rejection of media/copy parameters');
  await assert.rejects(prepareUrlLinkRequest({}, {}), { code: 'configuration_missing' });
  for(const response of [{success:false,code:4001,msg:secret},{success:true,code:5},null]) assert.throws(() => assertPlatformSuccess(response), e => e.code === 'platform_business_error' && !e.message.includes(secret));
  checks.push('missing configuration stops; business failure remains an error without logging provider messages or secrets');
  const config = path.join(temporary,'private.json'), out = path.join(temporary,'prepared.json');
  await writeFile(config,JSON.stringify({app_id:env.XHS_MINIAPP_APP_ID,access_token:token}),{mode:0o600});
  const stdout=[],stderr=[];
  assert.equal(await main(['--config',config,'--out',out],{env:{},stdout:s=>stdout.push(s),stderr:s=>stderr.push(s)}),0);
  const saved=JSON.parse(await readFile(out,'utf8'));
  assert.equal(saved.status,'request_prepared');
  assert.equal(saved.link_generated,false);
  assert.equal(saved.platform_requests_made,false);
  assert.equal((await stat(out)).mode&0o777,0o600);
  assert(!JSON.stringify({stdout,stderr,saved}).includes(token));
  await chmod(config,0o644);
  await assert.rejects(prepareUrlLinkRequest({config},{}),{code:'private_config_required'});
  checks.push('0600 private configuration and output; preparation contains no credentials, generated URL or device-verification claim');
  for (const key of ['authorization', 'cookie', 'password', 'credential', 'session', 'api_key', 'api-key']) {
    const leaked = 'isolated-sensitive-' + key, unsafeOut = path.join(temporary, key + '.json');
    const capturedOut = [], capturedError = [];
    assert.equal(await main(['--query', key + '=' + leaked, '--out', unsafeOut], { env, stdout: value => capturedOut.push(value), stderr: value => capturedError.push(value) }), 1);
    assert.equal(capturedOut.length, 0);
    assert(!capturedError.join('').includes(leaked));
    assert.equal(JSON.parse(capturedError[0]).message, 'query只放短批次标识等路由参数，不放图片、标题、正文或凭据。');
    await assert.rejects(readFile(unsafeOut), { code: 'ENOENT' });
  }
  checks.push('common sensitive query keys fail with a fixed message, empty stdout and no output file');
  const reservedSecret = 'isolated/S+e=c%ret', reservedToken = 'isolated/T+o=k%en';
  const privateEnv = { XHS_MINIAPP_APP_ID: env.XHS_MINIAPP_APP_ID, XHS_MINIAPP_APP_SECRET: reservedSecret, XHS_MINIAPP_ACCESS_TOKEN: reservedToken };
  for (const [index, args] of [
    ['--query', 'batch=' + reservedSecret],
    ['--query', 'batch=' + encodeURIComponent(reservedSecret)],
    ['--query', 'batch=' + encodeURIComponent(reservedToken)],
    ['--query', 'batch=' + encodeURIComponent(encodeURIComponent(reservedToken))],
    ['--page-url', 'pages/' + encodeURIComponent(reservedSecret) + '/index']
  ].entries()) {
    const unsafeOut = path.join(temporary, 'misplaced-' + index + '.json'), capturedOut = [], capturedError = [];
    assert.equal(await main([...args, '--out', unsafeOut], { env: privateEnv, stdout: value => capturedOut.push(value), stderr: value => capturedError.push(value) }), 1);
    assert.equal(capturedOut.length, 0);
    for (const value of [reservedSecret, reservedToken, encodeURIComponent(reservedSecret), encodeURIComponent(reservedToken)]) assert(!capturedError.join('').includes(value));
    assert.equal(JSON.parse(capturedError[0]).message, '参数含凭据信息，已停止；请仅传短批次标识。');
    await assert.rejects(readFile(unsafeOut), { code: 'ENOENT' });
  }
  checks.push('actual configured secret/token in innocent keys or encoded paths are rejected before stdout/output, including raw and URL-decoded forms');
  const child=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/prepare-url-link-request.mjs',import.meta.url))],{encoding:'utf8',env:{PATH:process.env.PATH||''}});
  assert.equal(child.status,1);assert.equal(child.stdout,'');assert.equal(JSON.parse(child.stderr).code,'configuration_missing');assert.equal(calls,0);
  checks.push('real CLI with missing configuration stops; all preparation paths make zero network calls');
  console.log(JSON.stringify({passed:checks.length,checks,platformRequestsMade:false,linkGenerated:false,officialReadyChanged:false},null,2));
} finally { globalThis.fetch=oldFetch;await rm(temporary,{recursive:true,force:true}); }
