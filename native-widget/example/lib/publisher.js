function validatePack(pack) {
  if (!pack || pack.channel !== 'xhs' || pack.serviceType !== 'general') throw new Error('当前资料不属于小红书图文库。');
  if (!Array.isArray(pack.materials) || pack.materials.length < 3 || pack.materials.length > 5) throw new Error('这批资料需要3—5张照片，请联系店员。');
  const ids = [];
  pack.materials.forEach(function (photo) {
    if (!photo || typeof photo.id !== 'string' || ids.indexOf(photo.id) >= 0) throw new Error('图片信息不完整，请刷新本批。');
    ids.push(photo.id);
    if (typeof photo.url !== 'string' || !/^https:\/\//.test(photo.url) || /[?&]download=/.test(photo.url)) throw new Error('原生发布需要有效的HTTPS图片，请刷新本批。');
  });
  if (!pack.reservedByMe && !pack.usedByMe) throw new Error('这批图片暂不可用，请换一批。');
}

function copies(result) {
  const pack = result.pack;
  if (!pack) return [];
  const source = result.platformCopies || pack.platformCopies || {};
  if (Array.isArray(source.xhs) && source.xhs.length) return source.xhs.map(function (copy, index) {
    return { id: copy.id || 'xhs-' + index, title: String(copy.title || ''), body: String(copy.body || '') };
  });
  return [{ id: 'xhs-default', title: String(pack.title || ''), body: String(pack.body || '') }];
}

function data(pack, draft) {
  validatePack(pack);
  if (!draft || typeof draft.title !== 'string' || typeof draft.body !== 'string') throw new Error('请检查标题和正文。');
  // Match the existing API's UTF-16 length limits. Do not silently trim edits.
  if (draft.title.length > 20 || draft.body.length > 1000) throw new Error('标题最多20字，正文最多1000字。');
  return {
    title: draft.title,
    content: draft.body,
    mediaInfo: JSON.stringify({ image_resources: pack.materials.map(function (photo) { return { url: photo.url }; }) }),
  };
}

function enabled(config) {
  return !!config && typeof config.ownAppId === 'string' && !!config.ownAppId.trim() && !/YOUR_|PLACEHOLDER|EXAMPLE/i.test(config.ownAppId) && config.enablePostNoteButton === true;
}

export default { validatePack: validatePack, copies: copies, data: data, enabled: enabled };
