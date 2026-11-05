(function () {
  'use strict';

  function init() {
    const data = window.AIDOG_DATA || {};
    const notes = Array.isArray(data.notes)
      ? data.notes.filter(function (note) {
          return note && Number.isInteger(note.day) && note.day > 0;
        }).sort(function (a, b) { return a.day - b.day; })
      : [];
    const refs = Array.isArray(data.refs) ? data.refs : [];
    const referenceMap = data.referenceMap && typeof data.referenceMap === 'object'
      ? data.referenceMap : {};
    const days = document.getElementById('days');
    const detail = document.getElementById('detail');
    const empty = document.getElementById('empty');
    const formatFilter = document.getElementById('format-filter');
    const copyButton = document.getElementById('copy-button');
    const resultCount = document.getElementById('result-count');
    const toast = document.getElementById('toast');
    const prevButton = document.getElementById('prev-day');
    const nextButton = document.getElementById('next-day');
    const dayPosition = document.getElementById('day-position');
    const filterButtons = Array.from(document.querySelectorAll('.filter-button[data-filter]'));
    const state = { business: 'all', format: 'all', day: null };
    let toastTimer;
    let copying = false;

    if (!days || !detail) return;

    function string(value) {
      return value === null || value === undefined ? '' : String(value);
    }

    function escape(value) {
      return string(value).replace(/[&<>"']/g, function (character) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
      });
    }

    function list(value) {
      return Array.isArray(value) ? value : [];
    }

    function httpsUrl(value) {
      if (typeof value !== 'string') return '';
      try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
      } catch (error) {
        return '';
      }
    }

    function assetPath(value) {
      if (typeof value !== 'string' || value.split('/').includes('..')) return '';
      return /^assets\/[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp|gif)$/i.test(value) ? value : '';
    }

    function sourceLink(url, label) {
      const safeUrl = httpsUrl(url);
      return safeUrl
        ? '<a href="' + escape(safeUrl) + '" target="_blank" rel="noopener noreferrer">' + escape(label) + '</a>'
        : '';
    }

    function tagsFor(note) {
      return list(note.tags).map(function (tag) {
        return string(tag).trim().replace(/^#+/, '');
      }).filter(Boolean).map(function (tag) { return '#' + tag; });
    }

    function businessClass(note) {
      return note.business === '医院' ? 'hospital' : note.business === '洗护' ? 'grooming' : '';
    }

    function dayLabel(day) {
      return 'D' + String(day).padStart(2, '0');
    }

    function currentNotes() {
      return notes.filter(function (note) {
        return (state.business === 'all' || note.business === state.business)
          && (state.format === 'all' || note.format === state.format);
      });
    }

    function currentNote() {
      return notes.find(function (note) { return note.day === state.day; });
    }

    function paragraphMarkup(value) {
      return string(value).split(/\n\s*\n/).filter(function (paragraph) {
        return paragraph.trim();
      }).map(function (paragraph) {
        return '<p>' + escape(paragraph).replace(/\r?\n/g, '<br>') + '</p>';
      }).join('');
    }

    function stringListMarkup(items) {
      return '<ul>' + list(items).map(function (item) {
        return '<li>' + escape(item) + '</li>';
      }).join('') + '</ul>';
    }

    function referenceMarkup(note) {
      const mapping = referenceMap[note.day];
      const referenceId = mapping && typeof mapping === 'object' ? mapping.id : mapping;
      const ref = refs.find(function (item) { return item && item.id === referenceId; });
      if (!ref) {
        return '<aside class="reference-panel"><h3>拍摄参考</h3><p>本篇按下方清单准备本店实拍。</p></aside>';
      }
      const path = assetPath(ref.web_path);
      const point = mapping && typeof mapping === 'object' ? mapping.point : '';
      const links = [
        sourceLink(ref.original_note_url, '小红书原笔记'),
        sourceLink(ref.index_url, '公开来源页'),
        sourceLink(ref.image_url, '来源原图')
      ].filter(Boolean).join('<span aria-hidden="true"> · </span>');
      const image = path
        ? '<a class="reference-image-link" href="' + escape(path) + '" target="_blank" rel="noopener noreferrer" aria-label="' + escape('打开参考原图：' + string(ref.source_title)) + '">'
          + '<img class="reference-image" src="' + escape(path) + '" alt="' + escape(ref.description || ref.source_title || '拍摄构图参考') + '" loading="lazy" decoding="async"></a>'
        : '<p>参考图暂不可用，请按本篇清单实拍。</p>';
      return '<aside class="reference-panel"><h3>本篇参考图</h3><figure>' + image
        + '<figcaption>'
        + (point ? '<p class="reference-point">' + escape(point) + '</p>' : '')
        + '<p class="reference-title">' + escape(ref.id) + ' · ' + escape(ref.source_title) + '</p>'
        + (links ? '<p class="reference-links">' + links + '</p>' : '')
        + (ref.access_note ? '<p class="source-note">' + escape(ref.access_note) + '</p>' : '')
        + '</figcaption></figure></aside>';
    }

    function shootingMarkup(note) {
      let content;
      if (note.format === '视频') {
        content = '<div class="table-wrap"><table class="storyboard"><caption class="sr-only">'
          + escape(dayLabel(note.day) + ' 视频分镜')
          + '</caption><thead><tr><th scope="col">秒数</th><th scope="col">画面</th><th scope="col">口播或原声</th><th scope="col">字幕</th></tr></thead><tbody>'
          + list(note.shots).map(function (shot) {
            return '<tr><th scope="row">' + escape(string(shot.time).replace(/秒$/, '')) + '</th><td>' + escape(shot.frame)
              + '</td><td>' + escape(shot.audio) + '</td><td>' + escape(shot.subtitle) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        content = '<ol class="shot-list">' + list(note.images).map(function (shot) {
          return '<li><p class="frame">' + escape(shot.frame) + '</p><p class="composition">'
            + escape(shot.composition) + '</p><p class="image-copy"><span>图上配字</span> '
            + escape(shot.text) + '</p></li>';
        }).join('') + '</ol>';
      }
      const sources = list(note.clinical_sources).map(function (source) {
        if (!source || typeof source !== 'object') return '';
        const link = sourceLink(source.url, source.title || '查看相关资料');
        return link ? '<li>' + link + '</li>' : '';
      }).filter(Boolean).join('');
      return '<details class="shooting" open><summary>'
        + (note.format === '视频' ? '本篇视频分镜' : '本篇拍摄清单')
        + '</summary><div class="shooting-content">'
        + '<h3>封面文字</h3><p class="cover-copy">' + escape(note.cover) + '</p>'
        + content
        + '<div class="note-columns"><section><h3>拍摄时注意</h3>' + stringListMarkup(note.shoot_tips)
        + '</section><section><h3>开拍前准备</h3>' + stringListMarkup(note.prep) + '</section></div>'
        + (sources ? '<section class="clinical-sources"><h3>相关资料</h3><ul>' + sources + '</ul></section>' : '')
        + '</div></details>';
    }

    function noteMarkup(note) {
      const tags = tagsFor(note).map(function (tag) {
        return '<span>' + escape(tag) + '</span>';
      }).join(' ');
      return '<header class="note-header"><div class="note-kicker note-meta"><span class="business-badge '
        + businessClass(note) + '">' + escape(note.business) + '</span><span>' + escape(note.format)
        + '</span><span>' + escape(dayLabel(note.day)) + '</span></div>'
        + '<h2 id="note-title">' + escape(note.title) + '</h2>'
        + (note.alt_title ? '<p class="alt-title">备选标题：' + escape(note.alt_title) + '</p>' : '')
        + (note.voice ? '<p class="note-voice">发文口吻：' + escape(note.voice) + '</p>' : '')
        + '</header><section class="post-grid" aria-label="正文与拍摄参考"><article class="copy-panel">'
        + '<h3>发布正文</h3><div class="post-body">' + paragraphMarkup(note.body) + '</div>'
        + (note.cta ? '<p class="post-cta">' + escape(note.cta) + '</p>' : '')
        + (tags ? '<section class="hashtag-section" aria-label="发布话题"><h3>发布话题</h3><p class="tags" aria-label="话题标签">' + tags + '</p></section>' : '')
        + '</article>' + referenceMarkup(note) + '</section>' + shootingMarkup(note);
    }

    function updateHash(day) {
      const hash = day === null ? '' : '#day-' + day;
      if (window.location.hash === hash) return;
      try {
        const url = new URL(window.location.href);
        url.hash = hash;
        window.history.replaceState(null, '', url.href);
      } catch (error) {
        // Reading local files may restrict history changes in older browsers.
        // The article remains usable even when its URL cannot be updated.
      }
    }

    function render() {
      const visibleNotes = currentNotes();
      if (!visibleNotes.some(function (note) { return note.day === state.day; })) {
        state.day = visibleNotes.length ? visibleNotes[0].day : null;
      }
      filterButtons.forEach(function (button) {
        const active = button.dataset.filter === state.business;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      if (formatFilter) formatFilter.value = state.format;
      if (resultCount) resultCount.textContent = '共 ' + visibleNotes.length + ' 篇';
      days.innerHTML = visibleNotes.map(function (note) {
        const active = note.day === state.day;
        return '<button type="button" class="day-card ' + businessClass(note) + (active ? ' active' : '')
          + '" data-day="' + note.day + '" aria-pressed="' + String(active) + '" aria-controls="detail">'
          + '<span class="day-label">' + escape(dayLabel(note.day)) + '</span>'
          + '<span class="day-meta">' + escape(note.business) + ' · ' + escape(note.format) + '</span>'
          + '<span class="day-title">' + escape(note.title) + '</span></button>';
      }).join('');
      const note = currentNote();
      const hasNote = Boolean(note);
      detail.hidden = !hasNote;
      if (empty) empty.hidden = hasNote;
      detail.innerHTML = note ? noteMarkup(note) : '';
      if (copyButton) copyButton.disabled = !hasNote || copying;
      const index = visibleNotes.findIndex(function (item) { return item.day === state.day; });
      if (prevButton) prevButton.disabled = !hasNote || index <= 0;
      if (nextButton) nextButton.disabled = !hasNote || index >= visibleNotes.length - 1;
      if (dayPosition) dayPosition.textContent = hasNote ? (index + 1) + ' / ' + visibleNotes.length : '0 / 0';
      updateHash(state.day);
    }

    function selectDay(day, scroll) {
      if (!currentNotes().some(function (note) { return note.day === day; })) return;
      state.day = day;
      render();
      if (scroll && typeof detail.scrollIntoView === 'function') {
        const reduceMotion = typeof window.matchMedia === 'function'
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        detail.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    }

    function alignHash() {
      const match = /^#day-([1-9]\d*)$/.exec(window.location.hash);
      const day = match ? Number(match[1]) : null;
      if (notes.some(function (note) { return note.day === day; })) {
        if (!currentNotes().some(function (note) { return note.day === day; })) {
          state.business = 'all';
          state.format = 'all';
        }
        state.day = day;
      }
      render();
    }

    function showToast(message) {
      if (!toast) return;
      window.clearTimeout(toastTimer);
      toast.textContent = message;
      toast.hidden = false;
      toast.classList.add('show');
      toastTimer = window.setTimeout(function () {
        toast.classList.remove('show');
        toast.hidden = true;
        toast.textContent = '';
      }, 2000);
    }

    function fallbackCopy(text) {
      const textarea = document.createElement('textarea');
      const previousFocus = document.activeElement;
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.setAttribute('aria-label', '待复制的发布正文');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      let success = false;
      try {
        success = Boolean(document.execCommand && document.execCommand('copy'));
      } catch (error) {
        success = false;
      } finally {
        textarea.remove();
        if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected) {
          try { previousFocus.focus({ preventScroll: true }); } catch (error) { previousFocus.focus(); }
        }
      }
      return success;
    }

    days.addEventListener('click', function (event) {
      const button = event.target.closest('button.day-card[data-day]');
      if (button && days.contains(button)) selectDay(Number(button.dataset.day), true);
    });
    filterButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        const value = button.dataset.filter;
        state.business = value === '医院' || value === '洗护' ? value : 'all';
        render();
      });
    });
    if (formatFilter) formatFilter.addEventListener('change', function () {
      state.format = formatFilter.value === '图文' || formatFilter.value === '视频' ? formatFilter.value : 'all';
      render();
    });
    if (prevButton) prevButton.addEventListener('click', function () {
      const visibleNotes = currentNotes();
      const index = visibleNotes.findIndex(function (note) { return note.day === state.day; });
      if (index > 0) selectDay(visibleNotes[index - 1].day, true);
    });
    if (nextButton) nextButton.addEventListener('click', function () {
      const visibleNotes = currentNotes();
      const index = visibleNotes.findIndex(function (note) { return note.day === state.day; });
      if (index >= 0 && index < visibleNotes.length - 1) selectDay(visibleNotes[index + 1].day, true);
    });
    if (copyButton) copyButton.addEventListener('click', async function () {
      const note = currentNote();
      if (!note || copying) return;
      const text = [string(note.title), string(note.body), string(note.cta), tagsFor(note).join(' ')]
        .filter(function (part) { return part.trim(); }).join('\n\n');
      copying = true;
      copyButton.disabled = true;
      let success = false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          try {
            await navigator.clipboard.writeText(text);
            success = true;
          } catch (error) {
            success = fallbackCopy(text);
          }
        } else {
          success = fallbackCopy(text);
        }
      } catch (error) {
        success = false;
      } finally {
        copying = false;
        copyButton.disabled = !currentNote();
      }
      showToast(success ? '已复制标题、正文和话题' : '复制未成功，请选中正文手动复制');
    });
    window.addEventListener('hashchange', alignHash);
    if (toast) toast.hidden = true;
    alignHash();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
