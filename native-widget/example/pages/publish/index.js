import api from '../../lib/api.js';
import publisher from '../../lib/publisher.js';
import config from '../../config.js';
const shareCover = 'https://xiaoxiao430.github.io/adog-xiaohongshu/share/brand/adog-logo.png';
const photoError = '照片暂时无法显示，请刷新本批重试';

function deadline(pack) {
  if (!pack || pack.status !== 'reserved') return 0;
  const value = Number(pack.reservedUntil || 0);
  return value < 1000000000000 ? value * 1000 : value;
}
function value(event) { return event && event.detail && typeof event.detail.value === 'string' ? event.detail.value : ''; }

Page({
  data: {
    busy: false, error: '', hint: '', pack: null, photos: [], imageError: '',
    draft: { title: '', body: '' }, variant: 1, variantCount: 0,
    nativeEnabled: false, leaseValid: false, draftError: '',
    publisher: null, sessionInfo: null, prepareBusy: false, prepareError: '',
  },
  onLoad: function () {
    this._alive = true;
    this._foreground = true;
    this._epoch = 0;
    this._photoEpoch = 0;
    this._photoErrors = {};
    this._prepareEpoch = 0;
    this._seen = [];
    this._drafts = {};
    this._copies = [];
    this._variant = 0;
    this._trace = 'xhs-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    this.update({ nativeEnabled: publisher.enabled(config) });
    this.start();
  },
  onShow: function () {
    this._foreground = true;
    if (!this._alive || this.data.busy || !this.data.pack) return;
    this.applyPublisher();
    if (deadline(this.data.pack) - Date.now() < 60000) this.refreshPublisher();
    else this.scheduleLease();
  },
  onHide: function () { this._foreground = false; this.clearLease(); this.clearPreparation(); },
  onUnload: function () {
    this._alive = false;
    this._epoch++;
    this.clearPreparation();
    this.clearLease();
    api.cancel();
  },
  update: function (patch) { if (this._alive) this.setData(patch); },
  clearPreparation: function () {
    if (this._prepareTimer) clearTimeout(this._prepareTimer);
    this._prepareTimer = null;
    this._prepareEpoch++;
    this._preparingKey = null;
    this._prepared = null;
    this.update({ publisher: null, sessionInfo: null, prepareBusy: false });
  },
  preparationKey: function () {
    const pack = this.data.pack, copy = this._copies[this._variant];
    if (!pack || !copy) return '';
    return JSON.stringify([pack.id, pack.reservedUntil, copy.id, this.data.draft.title, this.data.draft.body,
      pack.materials.map(function (photo) { return [photo.id, photo.url]; })]);
  },
  currentPreparation: function (epoch, key) {
    return this._alive && this._foreground && !this.data.busy && epoch === this._prepareEpoch && key === this.preparationKey();
  },
  clearLease: function () { if (this._leaseTimer) clearTimeout(this._leaseTimer); this._leaseTimer = null; },
  scheduleLease: function (retry) {
    this.clearLease();
    if (!this._alive || !this._foreground || !this.data.pack || this.data.pack.status !== 'reserved') return;
    const remaining = deadline(this.data.pack) - Date.now();
    if (remaining <= 0) { this.applyPublisher(); return; }
    const delay = retry ? Math.min(30000, remaining) : Math.max(1000, remaining - 60000);
    this._leaseTimer = setTimeout(() => {
      this._leaseTimer = null;
      if (deadline(this.data.pack) <= Date.now()) {
        this.applyPublisher();
        this.update({ error: '这批图片的预留已到期，请刷新本批后继续。' });
      } else this.refreshPublisher();
    }, delay);
  },
  rememberDraft: function () {
    if (!this.data.pack) return;
    this._drafts[this.data.pack.id] = {
      variant: this._variant,
      drafts: this._variantDrafts || {},
    };
    this._drafts[this.data.pack.id].drafts[this._variant] = {
      title: this.data.draft.title, body: this.data.draft.body,
    };
  },
  showPack: function (result) {
    if (!result.pack) {
      if (this.data.pack) { this.update({ hint: '暂无下一批，仍保留当前图文。' }); return; }
      this.update({ pack: null, publisher: null, sessionInfo: null, leaseValid: false });
      return;
    }
    publisher.validatePack(result.pack);
    const copies = publisher.copies(result);
    if (!copies.length) throw new Error('这批图片尚未配好文案，请联系店员。');
    this.rememberDraft();
    const pack = result.pack;
    const photoEpoch = ++this._photoEpoch;
    this._photoErrors = {};
    const saved = this._drafts[pack.id];
    this._leaseUncertain = false;
    this._copies = copies;
    this._variant = saved ? Math.min(saved.variant, copies.length - 1) : 0;
    this._variantDrafts = saved ? saved.drafts : {};
    const draft = this._variantDrafts[this._variant] || copies[this._variant];
    if (this._seen.indexOf(pack.id) < 0) this._seen.push(pack.id);
    this.update({
      pack: pack, draft: { title: draft.title, body: draft.body },
      // A fresh node for each refresh keeps late native-image events on their old epoch.
      photos: pack.materials.map(function (photo, index) {
        return { url: photo.url, batchId: pack.id, epoch: photoEpoch, renderKey: photoEpoch + '-' + index };
      }), imageError: '',
      variant: this._variant + 1, variantCount: copies.length,
      hint: result.sameAsCurrent ? '暂无下一批，仍保留当前图文。' : '',
    });
    this.applyPublisher();
  },
  applyPublisher: function () {
    const pack = this.data.pack;
    const valid = !!pack && !this._leaseUncertain && pack.reservedByMe === true && deadline(pack) > Date.now();
    let payload = null, error = '';
    try { if (pack) payload = publisher.data(pack, this.data.draft); }
    catch (reason) { error = reason.message; }
    this.update({ leaseValid: valid, draftError: error });
    if (!valid || error || !this.data.nativeEnabled || this.data.busy || !this._foreground) { this.clearPreparation(); return; }
    const key = this.preparationKey();
    if (this._prepared && this._prepared.key === key && this._prepared.validUntil > Date.now()) {
      // This ID only identifies a prepared server snapshot, never a publication receipt.
      this.update({ publisher: payload, sessionInfo: { attemptId: this._prepared.attemptId }, prepareBusy: false, prepareError: '' });
      return;
    }
    if (this._preparingKey === key) return;
    this.clearPreparation();
    const epoch = this._prepareEpoch, copy = this._copies[this._variant];
    this._preparingKey = key;
    this.update({ prepareBusy: true, prepareError: '' });
    // Wait for a brief pause in editing; keep the usual one-button customer flow.
    this._prepareTimer = setTimeout(() => {
      this._prepareTimer = null;
      if (!this.currentPreparation(epoch, key)) return;
      api.nativeAttempt(pack.id, { requestKey: this._trace + '-' + epoch, copyId: copy.id, title: payload.title, body: payload.content }).then((result) => {
        if (!this.currentPreparation(epoch, key)) return;
        if (!result || result.status !== 'prepared' || result.appId !== config.ownAppId || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(result.attemptId || '') || typeof result.validUntil !== 'number' || !Number.isFinite(result.validUntil) || result.validUntil <= Date.now()) {
          throw new Error('发布准备信息未能核对，请刷新本批重试。');
        }
        this._prepared = { key: key, attemptId: result.attemptId, validUntil: Number(result.validUntil) };
        this._preparingKey = null;
        this.applyPublisher();
      }).catch((reason) => {
        if (!this.currentPreparation(epoch, key)) return;
        this._preparingKey = null;
        this.update({ publisher: null, sessionInfo: null, prepareBusy: false, prepareError: reason.message || '发布准备暂时未完成，请刷新本批重试。' });
      });
    }, 350);
  },
  fetchPack: function (kind) {
    if (!this._alive || this.data.busy) return Promise.resolve();
    const epoch = ++this._epoch;
    this._photoEpoch++;
    this._photoErrors = {};
    const current = this.data.pack;
    this.clearLease();
    // A lost response may already have moved the server lease. Verify again before publishing.
    this._leaseUncertain = !!current;
    this.clearPreparation();
    this.update({ busy: true, error: '', hint: '', imageError: '', prepareError: '' });
    let failed = false;
    const options = current ? { currentId: current.id } : {};
    if (kind === 'next') { options.next = true; options.skip = this._seen; }
    const initialize = kind === 'start' ? api.bootstrap() : Promise.resolve();
    return initialize.then(() => {
      if (!this._alive || epoch !== this._epoch) return null;
      return api.start(options);
    }).then((result) => {
      if (!this._alive || epoch !== this._epoch) return;
      if (kind === 'refresh' && (!result.pack || !current || result.pack.id !== current.id)) {
        throw new Error('本批预留已变化，请换一批图文。当前文字仍为你保留。');
      }
      this.showPack(result);
      if (kind === 'refresh') this.update({ hint: '本批图片链接已更新，修改的文字仍保留。' });
    }).catch((error) => {
      if (!this._alive || epoch !== this._epoch) return;
      failed = true;
      this.update({ error: error.message || '暂时无法读取图库，请重试。' });
      this.applyPublisher();
    }).finally(() => {
      if (!this._alive || epoch !== this._epoch) return;
      this.update({ busy: false });
      this.applyPublisher();
      this.scheduleLease(failed);
    });
  },
  start: function () { return this.fetchPack('start'); },
  nextPack: function () { return this.fetchPack('next'); },
  refreshPublisher: function () { return this.fetchPack('refresh'); },
  anotherCopy: function () {
    if (this.data.busy || !this.data.pack || this._copies.length < 2) return;
    this.rememberDraft();
    this._variant = (this._variant + 1) % this._copies.length;
    const draft = this._variantDrafts[this._variant] || this._copies[this._variant];
    this.update({ draft: { title: draft.title, body: draft.body }, variant: this._variant + 1, error: '', hint: '' });
    this.applyPublisher();
  },
  onTitleInput: function (event) {
    this.update({ draft: { title: value(event), body: this.data.draft.body } });
    this.rememberDraft(); this.applyPublisher();
  },
  onBodyInput: function (event) {
    this.update({ draft: { title: this.data.draft.title, body: value(event) } });
    this.rememberDraft(); this.applyPublisher();
  },
  photoEventIndex: function (event) {
    if (!this._alive || !this.data.pack) return -1;
    const data = event && event.currentTarget && event.currentTarget.dataset || {};
    const index = Number(data.index), epoch = Number(data.epoch);
    if (data.batch !== this.data.pack.id || epoch !== this._photoEpoch || !Number.isInteger(index) || index < 0 || index >= this.data.photos.length) return -1;
    return this.data.photos[index].epoch === epoch ? index : -1;
  },
  onPhotoError: function (event) {
    const index = this.photoEventIndex(event);
    if (index < 0) return;
    this._photoErrors[index] = true;
    // Native errors can contain signed URLs. Show only a fixed customer message.
    this.update({ imageError: photoError });
  },
  onPhotoLoad: function (event) {
    const index = this.photoEventIndex(event);
    if (index < 0) return;
    delete this._photoErrors[index];
    this.update({ imageError: Object.keys(this._photoErrors).length ? photoError : '' });
  },
  previewPhoto: function (event) {
    if (!this.data.pack || typeof xhs.previewImage !== 'function') return;
    const urls = this.data.pack.materials.map(function (photo) { return photo.url; });
    const index = Number(event.currentTarget && event.currentTarget.dataset.index) || 0;
    xhs.previewImage({ current: urls[index] || urls[0], urls: urls });
  },
  goHome: function () {
    // This compact page is the home page; returning keeps the selected draft.
    if (typeof xhs.pageScrollTo === 'function') xhs.pageScrollTo({ scrollTop: 0, duration: 150 });
    this.update({ hint: '' });
    if (!this.data.pack && !this.data.busy) return this.start();
  },
  onPostError: function (event) {
    this.update({ error: (event.detail && event.detail.errMsg) || '暂时无法打开小红书编辑页，请刷新本批后重试。' });
  },
  // Official Page share hooks. The platform creates the actual share/short link.
  // New visitors load their own public batch; no draft, photo URL or guest credential is shared.
  onShareAppMessage: function () {
    return { title: '爱多格·小红书图文', path: '/pages/publish/index', query: '', imageUrl: shareCover };
  },
  onShareChat: function () {
    return { title: '爱多格·小红书图文', path: '/pages/publish/index', query: '', content: '选择门店图文，修改后自行发布。', imageUrl: shareCover, externalImageUrl: shareCover };
  },
  onCopyUrl: function () {
    return { path: '/pages/publish/index', query: '', externalImageUrl: shareCover };
  },
  // The documented component has binderror, not a client publish-success event.
  // Only an authenticated official server event may later confirm publication.
});
