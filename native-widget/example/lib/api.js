import config from '../config.js';
let guestToken = '';
const active = [];

function validateApi() {
  if (typeof config.apiBase !== 'string' || !/^https:\/\/[^/?#]+(?:\/[^?#]*)?$/.test(config.apiBase) || /YOUR_|\.example(?:\/|$)|localhost|127\.0\.0\.1/i.test(config.apiBase)) {
    throw new Error('门店图库地址尚未配置，请联系门店。');
  }
}

function request(path, data, authenticated) {
  return new Promise(function (resolve, reject) {
    validateApi();
    if (typeof xhs === 'undefined' || typeof xhs.request !== 'function') return reject(new Error('请在小红书小组件中打开。'));
    const header = { 'content-type': 'application/json' };
    const sentToken = authenticated ? guestToken : '';
    if (authenticated) {
      if (!sentToken) return reject(new Error('顾客会话已失效，请重新进入页面。'));
      header.Authorization = 'Bearer ' + sentToken;
    }
    let task, completed = false;
    function remove() { const index = active.indexOf(task); if (index >= 0) active.splice(index, 1); }
    task = xhs.request({
      url: config.apiBase.replace(/\/$/, '') + path,
      method: data === undefined ? 'GET' : 'POST', header: header,
      data: data, dataType: 'json', timeout: 15000,
      success: function (res) {
        completed = true; remove();
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.ok === true) return resolve(res.data);
        if (res.statusCode === 401 && guestToken === sentToken) guestToken = '';
        reject(new Error((res.data && res.data.error) || '请求未完成，请稍后重试。'));
      },
      fail: function () { completed = true; remove(); reject(new Error('暂时无法连接图库，当前图文已保留。')); },
    });
    if (!completed && task && typeof task.abort === 'function') active.push(task);
  });
}

function bootstrap() {
  // This is the existing server's native-client protocol name, not an AppID or widget type.
  return request('/api/bootstrap?client=miniapp', undefined, !!guestToken).then(function (data) {
    if (typeof data.guestToken !== 'string' || !/^[a-f0-9]{64}$/.test(data.guestToken) || !data.capabilities || !data.capabilities.packages) {
      throw new Error('门店图库尚未开放，请联系店员。');
    }
    guestToken = data.guestToken;
    return data;
  });
}

export default {
  bootstrap: bootstrap,
  start: function (options) {
    options = options || {};
    const data = { channel: 'xhs', platform: 'xhs' };
    if (options.currentId) data.currentId = options.currentId;
    if (options.next === true) { data.next = true; data.skip = (options.skip || []).slice(-50); }
    // A previous 401 clears memory. The next explicit retry obtains a new guest session.
    return (guestToken ? Promise.resolve() : bootstrap()).then(function () {
      return request('/api/quick-share/start', data, true);
    });
  },
  nativeAttempt: function (packageId, data) {
    return request('/api/packages/' + encodeURIComponent(packageId) + '/native-attempt', data, true);
  },
  cancel: function () { active.splice(0).forEach(function (task) { task.abort(); }); },
};
