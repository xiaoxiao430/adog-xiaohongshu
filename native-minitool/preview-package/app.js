(function () {
  'use strict';
  var data = window.AIDOG_MINITOOL_DATA;
  var title = document.getElementById('title');
  var content = document.getElementById('content');
  var notice = document.getElementById('notice');
  var counts = document.getElementById('counts');
  var publish = document.getElementById('publish');
  var save = document.getElementById('save');
  var next = document.getElementById('next');
  var home = document.getElementById('home');
  var recovery = document.getElementById('recovery');
  var recoveryText = document.getElementById('recovery-text');
  var resume = document.getElementById('resume');
  var savedYes = document.getElementById('saved-yes');
  var savedNo = document.getElementById('saved-no');
  var busy = false;
  var variant = 0;
  var saved = {};
  var photoElements = [];
  var clientVersion = 0;
  var layoutTimer = null;
  var operation = null;
  var operationId = 0;
  var unknownSave = null;

  function nativeApi() {
    return window.xhs && window.xhs.miniTool;
  }
  function notify(message, isError) {
    var api = nativeApi();
    if ((!api || typeof api.postNote !== 'function') && message.indexOf('当前仅可预览') < 0) {
      message += ' 请在小红书官方小工具中打开，当前仅可预览图文。';
    }
    notice.textContent = message;
    notice.className = isError ? 'notice error' : 'notice';
  }
  function count() {
    counts.textContent = '标题 ' + title.value.length + '/20 · 正文 ' + content.value.length + '/1000';
  }
  function chooseCopy(index) {
    variant = index;
    title.value = data.copies[index].title;
    content.value = data.copies[index].body;
    count();
  }
  function setBusy(value) {
    busy = value;
    title.disabled = value;
    content.disabled = value;
    next.disabled = value;
    home.disabled = value;
    var api = nativeApi();
    publish.disabled = value || !api || typeof api.postNote !== 'function';
    save.disabled = value || unknownSave !== null || !api || typeof api.saveImageToPhotosAlbum !== 'function' || clientVersion < 9420;
    publish.textContent = value ? '正在处理…' : '去小红书发布';
  }
  function renderRecovery() {
    var pending = operation && operation.kind === 'publish' && operation.stage === 'editor' && operation.canResume;
    recovery.hidden = !pending && unknownSave === null;
    resume.hidden = !pending;
    savedYes.hidden = unknownSave === null || busy;
    savedNo.hidden = unknownSave === null || busy;
    recoveryText.textContent = pending ? '已回到本页？可以继续修改。再次发布前，请先检查小红书是否已发出笔记。' :
      (unknownSave !== null ? '第' + (unknownSave + 1) + '张是否保存还未确认。请先查看相册，再选择。' : '');
  }
  function beginOperation(kind) {
    operation = { id: ++operationId, kind: kind, stage: 'prepare', hidden: false, timer: null };
    setBusy(true);
    renderRecovery();
    return operation;
  }
  function isCurrent(current) { return operation === current; }
  function endOperation(current) {
    if (!isCurrent(current)) return;
    clearTimeout(current.timer);
    operation = null;
    setBusy(false);
    renderRecovery();
  }
  function recoverOperation() {
    var current = operation;
    if (!current) return;
    if (current.kind === 'save' && current.stage === 'album') unknownSave = current.index;
    endOperation(current);
    notify(current.kind === 'publish' ? '已恢复本页，图文已保留。再次发布前，请先检查小红书是否已发出笔记。' : '已恢复本页，图文已保留。请先查看手机相册。');
  }
  function failure(error, fallback) {
    var message = error && (error.errMsg || error.message);
    return fallback + (typeof message === 'string' ? '（' + message.slice(0, 160) + '）' : '');
  }
  function bounded(promise, milliseconds, message) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error(message)); }, milliseconds);
      Promise.resolve(promise).then(function (result) {
        clearTimeout(timer);
        resolve(result);
      }, function (error) {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
  function imageReady(image) {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var timer;
      var reloadTimer;
      function cleanup() {
        clearTimeout(timer);
        clearTimeout(reloadTimer);
        image.removeEventListener('load', loaded);
        image.removeEventListener('error', failed);
      }
      function loaded() {
        cleanup();
        image.needsReload = false;
        resolve();
      }
      function failed() {
        cleanup();
        image.needsReload = true;
        reject(new Error('图片未能加载，请再次点击重试'));
      }
      var reload = image.needsReload || image.complete;
      if (reload) image.removeAttribute('src');
      image.addEventListener('load', loaded);
      image.addEventListener('error', failed);
      timer = setTimeout(function () {
        cleanup();
        image.needsReload = true;
        reject(new Error('图片加载超时，请再次点击重试'));
      }, 10000);
      if (reload) {
        reloadTimer = setTimeout(function () { image.src = image.getAttribute('data-package-src'); }, 0);
      }
    });
  }
  function saveReceipt(api, filePath) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        var error = new Error('相册暂未返回保存结果');
        error.unknownSave = true;
        reject(error);
      }, 30000);
      Promise.resolve(api.saveImageToPhotosAlbum({ filePath: filePath })).then(function (result) {
        clearTimeout(timer);
        resolve(result);
      }, function (error) {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
  async function immediatePath(index, api) {
    if (typeof api.writeTempFile !== 'function') throw new Error('当前版本无法准备原生图片，请更新小红书后重试');
    var image = photoElements[index];
    await imageReady(image);
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 4000000) {
      throw new Error('图片尺寸超出本机准备范围');
    }
    if (image.naturalWidth !== data.images[index].width || image.naturalHeight !== data.images[index].height) {
      throw new Error('图片尺寸与原图不一致');
    }
    var canvas = document.createElement('canvas');
    var encoded = null;
    var result;
    try {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      var context = canvas.getContext('2d');
      if (!context) throw new Error('本机暂时无法准备图片，请稍后重试');
      context.drawImage(image, 0, 0);
      encoded = canvas.toDataURL('image/png');
      if (typeof encoded !== 'string' || encoded.indexOf('data:image/png;base64,') !== 0) {
        throw new Error('图片转码未完成');
      }
      result = await bounded(api.writeTempFile({ data: encoded }), 20000, '图片准备超时，原图和文案已保留');
    } finally {
      encoded = null;
      canvas.width = 0;
      canvas.height = 0;
    }
    if (!result || typeof result.filePath !== 'string' || !result.filePath) {
      throw new Error('图片临时文件未就绪');
    }
    return result.filePath;
  }
  async function publishNote() {
    if (busy) return;
    var api = nativeApi();
    if (!api || typeof api.postNote !== 'function') {
      notify('请在小红书官方小工具中打开，当前仅可预览图文。', true);
      return;
    }
    var noteTitle = title.value.trim();
    var noteContent = content.value.trim();
    if (!noteTitle || !noteContent || noteTitle.length > 20 || noteContent.length > 1000) {
      notify('请填写标题和正文，标题最多20字，正文最多1000字。', true);
      return;
    }
    var current = beginOperation('publish');
    notify('正在准备3张图片…');
    try {
      var images = [];
      for (var i = 0; i < data.images.length; i += 1) {
        var filePath = await immediatePath(i, api);
        if (!isCurrent(current)) return;
        images.push({ url: filePath });
      }
      current.stage = 'editor';
      notify('请在小红书编辑页核对图文，并自行决定是否发布。返回本页后，当前图文仍会保留。');
      current.timer = setTimeout(function () {
        if (!isCurrent(current)) return;
        current.canResume = true;
        renderRecovery();
      }, 30000);
      await api.postNote({
        title: noteTitle,
        content: noteContent,
        mediaInfo: { image_resources: images }
      });
      if (!isCurrent(current)) return;
      notify('请到小红书查看笔记，当前图文已保留。');
    } catch (error) {
      if (!isCurrent(current)) return;
      notify(failure(error, '未能完成发布操作，图文已保留，可重试。'), true);
    } finally {
      endOperation(current);
    }
  }
  async function savePhotos() {
    if (busy || unknownSave !== null) return;
    var api = nativeApi();
    if (!api || typeof api.saveImageToPhotosAlbum !== 'function' || clientVersion < 9420) return;
    var current = beginOperation('save');
    try {
      for (var i = 0; i < data.images.length; i += 1) {
        if (saved[i]) continue;
        notify('正在保存第' + (i + 1) + '张…');
        var filePath = await immediatePath(i, api);
        if (!isCurrent(current)) return;
        current.stage = 'album';
        current.index = i;
        await saveReceipt(api, filePath);
        if (!isCurrent(current)) return;
        saved[i] = true;
        current.stage = 'prepare';
      }
      notify('3张图片已保存到相册。');
    } catch (error) {
      if (!isCurrent(current)) return;
      var total = Object.keys(saved).length;
      if (error && error.unknownSave) {
        unknownSave = current.index;
        notify('已确认保存' + total + '/3张；本张还未确认。请先查看相册，再在下方选择。图文已保留。', true);
      } else {
        notify(failure(error, '已保存' + total + '/3张；再次点击会继续保存剩余图片。'), true);
      }
    } finally {
      endOperation(current);
    }
  }
  if (!data || !data.images || data.images.length !== 3 || !data.copies || !data.copies.length) {
    notify('图文资料尚未就绪，请返回后重试。', true);
    [publish, save, next, home].forEach(function (button) { button.disabled = true; });
    return;
  }
  var photos = document.getElementById('photos');
  data.images.forEach(function (item, index) {
    var holder = document.createElement('div');
    holder.className = 'photo';
    var image = document.createElement('img');
    image.setAttribute('data-package-src', item.src);
    image.src = item.src;
    image.alt = 'AI示意图' + (index + 1);
    holder.appendChild(image);
    photos.appendChild(holder);
    photoElements.push(image);
  });
  function readClientVersion(options) {
    var environment = options && options.miniToolEnv;
    var buildVersion = Number(environment && environment.buildVersion) || 0;
    return Math.floor(buildVersion / 1000);
  }
  async function updateLayout() {
    var api = nativeApi();
    if (clientVersion < 9490 || !api || typeof api.getWindowInfo !== 'function') return;
    try {
      var info = await bounded(api.getWindowInfo(), 3000, '窗口信息暂时不可用');
      var area = info && info.safeArea;
      var top = area && Number.isFinite(area.top) ? Math.max(0, area.top) : 0;
      var bottom = area && Number.isFinite(area.bottom) && Number.isFinite(info.windowHeight) ? Math.max(0, info.windowHeight - area.bottom) : 0;
      var buttons = info && info.menuButtons;
      ['back', 'me', 'share'].forEach(function (name) {
        var button = buttons && buttons[name];
        if (button && Number.isFinite(button.bottom)) top = Math.max(top, button.bottom);
      });
      document.documentElement.style.setProperty('--safe-area-inset-top', top + 'px');
      document.documentElement.style.setProperty('--safe-area-inset-bottom', bottom + 'px');
    } catch (error) {
      // The CSS safe-area fallback stays active when this optional read fails.
    }
  }
  async function initializeEnvironment() {
    var api = nativeApi();
    clientVersion = readClientVersion(window.xhs && window.xhs.launchOptions);
    if (!clientVersion && api && typeof api.getLaunchOptions === 'function') {
      try {
        clientVersion = readClientVersion(await bounded(api.getLaunchOptions(), 3000, '客户端版本暂时不可用'));
      } catch (error) { clientVersion = 0; }
    }
    if (api && typeof api.postNote === 'function' && clientVersion < 9420) {
      notify('相册保存需小红书9.42及以上；可继续尝试带图文发布。');
    }
    setBusy(busy);
    await updateLayout();
  }
  chooseCopy(0);
  title.addEventListener('input', count);
  content.addEventListener('input', count);
  next.addEventListener('click', function () {
    if (busy) return;
    chooseCopy((variant + 1) % data.copies.length);
    notify('已更换文案，图片保持不变。');
  });
  home.addEventListener('click', function () {
    if (busy) return;
    window.scrollTo(0, 0);
    notify('已回到页面顶部，当前图文已保留。');
  });
  resume.addEventListener('click', function () {
    if (operation && operation.kind === 'publish' && operation.canResume) recoverOperation();
  });
  savedYes.addEventListener('click', function () {
    if (busy || unknownSave === null) return;
    saved[unknownSave] = true;
    unknownSave = null;
    setBusy(false);
    renderRecovery();
    notify(Object.keys(saved).length === 3 ? '3张图片已确认保存到相册。' : '已记录这张已保存；可点击保存照片，继续剩余图片。');
  });
  savedNo.addEventListener('click', function () {
    if (busy || unknownSave === null) return;
    unknownSave = null;
    setBusy(false);
    renderRecovery();
    notify('已按你的核对恢复保存按钮；再次点击后才会继续保存。');
  });
  function markHidden() {
    if (operation && (operation.stage === 'editor' || operation.stage === 'album')) operation.hidden = true;
  }
  function returnedToPage() {
    if (operation && operation.hidden) recoverOperation();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) markHidden();
    else returnedToPage();
  });
  window.addEventListener('pagehide', markHidden);
  window.addEventListener('pageshow', returnedToPage);
  publish.addEventListener('click', publishNote);
  save.addEventListener('click', savePhotos);
  window.addEventListener('resize', function () {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(updateLayout, 120);
  });
  setBusy(false);
  if (!nativeApi() || typeof nativeApi().postNote !== 'function') {
    notify('请在小红书官方小工具中打开，当前仅可预览图文。');
  }
  initializeEnvironment();
}());
