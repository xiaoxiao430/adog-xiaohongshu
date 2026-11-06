const api = require('../../lib/api');
const publisher = require('../../lib/publisher');
const config = require('../../config');

function deadline(pack) {
  if (!pack || pack.status !== 'reserved') return 0;
  const value = Number(pack.reservedUntil || 0);
  return value < 1000000000000 ? value * 1000 : value;
}
function value(event) { return event && event.detail && typeof event.detail.value === 'string' ? event.detail.value : ''; }

Page({
  data: {
    busy: false, error: '', hint: '', pack: null,
    draft: { title: '', body: '' }, variant: 1, variantCount: 0,
    nativeEnabled: false, leaseValid: false, draftError: '',
    publisher: null, sessionInfo: null,
  },
  onLoad: function () {
    this._alive = true;
    this._foreground = true;
    this._epoch = 0;
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
  onHide: function () { this._foreground = false; this.clearLease(); },
  onUnload: function () {
    this._alive = false;
    this._epoch++;
    this.clearLease();
    api.cancel();
  },
  update: function (patch) { if (this._alive) this.setData(patch); },
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
    const saved = this._drafts[pack.id];
    this._leaseUncertain = false;
    this._copies = copies;
    this._variant = saved ? Math.min(saved.variant, copies.length - 1) : 0;
    this._variantDrafts = saved ? saved.drafts : {};
    const draft = this._variantDrafts[this._variant] || copies[this._variant];
    if (this._seen.indexOf(pack.id) < 0) this._seen.push(pack.id);
    this.update({
      pack: pack, draft: { title: draft.title, body: draft.body },
      variant: this._variant + 1, variantCount: copies.length,
      hint: result.sameAsCurrent ? '暂无下一批，仍保留当前图文。' : '',
    });
    this.applyPublisher();
  },
  applyPublisher: function () {
    const pack = this.data.pack;
    const valid = !!pack && !this._leaseUncertain && (pack.usedByMe === true || deadline(pack) > Date.now());
    let payload = null, error = '';
    try { if (pack) payload = publisher.data(pack, this.data.draft); }
    catch (reason) { error = reason.message; }
    const copy = this._copies[this._variant];
    this.update({
      leaseValid: valid, draftError: error,
      publisher: valid && !error ? payload : null,
      // Correlation hints only. The server must authenticate the official event.
      // No bearer, reservation key, private grant or invented success claim.
      sessionInfo: pack ? { packageId: pack.id, copyId: copy ? copy.id : '', clientTraceId: this._trace } : null,
    });
  },
  fetchPack: function (kind) {
    if (!this._alive || this.data.busy) return Promise.resolve();
    const epoch = ++this._epoch;
    const current = this.data.pack;
    this.clearLease();
    // A lost response may already have moved the server lease. Verify again before publishing.
    this._leaseUncertain = !!current;
    this.update({ busy: true, error: '', hint: '' });
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
  // The documented component has binderror, not a client publish-success event.
  // Only an authenticated official server event may later confirm publication.
});
