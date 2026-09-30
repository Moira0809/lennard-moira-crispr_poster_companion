// Editor for content.json. Edits are kept as a local draft; "Publish" commits
// new media files and content.json to the GitHub repo that serves the site.
(function () {
  const $ = s => document.querySelector(s);
  const { esc } = Site;
  const GH_KEY = 'poster-site-github-v1';

  let content = null;
  let dirty = false;
  let currentTab = 'intro';
  const pending = new Map(); // "media/foo.mp4" -> { file, url } — chosen locally, not yet uploaded

  // ---------- Form schema ----------
  const T = (key, label, extra = {}) => ({ key, label, type: 'text', ...extra });
  const A = (key, label, extra = {}) => ({ key, label, type: 'textarea', ...extra });
  const MD_HINT = 'Empty line = new paragraph. **bold**, *italic*, [link text](https://…)';
  const newMedia = () => ({ type: 'image', src: '', caption: '', alt: '' });

  const METHOD_FIELDS = [
    T('title', 'Method name'),
    A('what', 'What we did', { rows: 5, hint: MD_HINT }),
    A('why', 'Why we used this method', { rows: 4, hint: 'Shown as a highlighted box.' }),
    { key: 'media', type: 'list', label: 'Images / videos for this method', itemLabel: 'Media', titleKey: 'caption', itemType: 'media', newItem: newMedia }
  ];
  const EXP_FIELDS = [
    T('title', 'Experiment title', { hint: 'Large heading of this section, e.g. "CRISPR-Cas experiment".' }),
    T('nav', 'Short name', { hint: 'Used in the menu at the top and in this editor tab.', onInput: () => renderTabs() }),
    { key: 'accent', label: 'Colour of this experiment', type: 'select', options: Site.ACCENTS },
    A('intro', 'Intro: goal of this experiment', { rows: 4, hint: MD_HINT }),
    { key: 'methods', type: 'list', label: 'Methods', itemLabel: 'Method', titleKey: 'title',
      newItem: () => ({ title: 'New method', what: '', why: '', media: [] }), fields: METHOD_FIELDS },
    T('galleryHeading', 'Gallery heading'),
    A('galleryIntro', 'Gallery intro text', { rows: 2, hint: MD_HINT }),
    { key: 'media', type: 'list', label: 'Gallery: images / videos', itemLabel: 'Media', titleKey: 'caption', itemType: 'media', newItem: newMedia },
    A('codeIntro', 'Intro text for the R code (optional)', { rows: 2, hint: MD_HINT }),
    { key: 'code', type: 'list', label: 'R code', itemLabel: 'Script', titleKey: 'title',
      newItem: () => ({ title: 'New R script', description: '', code: '' }),
      fields: [
        T('title', 'Script name', { hint: 'e.g. "Quantification of GFP intensity"' }),
        A('description', 'What does this script do? (optional)', { rows: 2, hint: MD_HINT }),
        { key: 'code', label: 'R code', type: 'code' }
      ] }
  ];

  const TABS_BEFORE = [
    { id: 'intro', label: 'Title & header', lead: 'The first thing people see after scanning the QR code.', fields: [
      T('meta.title', 'Project title'),
      A('meta.subtitle', 'Subtitle / one-sentence summary', { rows: 2 }),
      T('meta.badge', 'Small label above the title'),
      T('meta.course', 'Course, lab or institution'),
      T('meta.date', 'Year / date'),
      { key: 'hero', label: 'Header image or video (optional)', type: 'media' }
    ] },
    { id: 'overview', label: 'Overview', lead: 'Context and motivation that did not fit on the poster.', fields: [
      T('overview.heading', 'Heading'),
      A('overview.body', 'Text', { rows: 10, hint: MD_HINT })
    ] }
  ];
  const TABS_AFTER = [
    { id: 'team', label: 'About us', lead: 'The authors.', fields: [
      { key: 'authors', type: 'list', itemLabel: 'Author', titleKey: 'name',
        newItem: () => ({ name: 'New author', role: '', affiliation: '', email: '', photo: '', bio: '' }),
        fields: [
          T('name', 'Name'), T('role', 'Role in the project'), T('affiliation', 'Affiliation'),
          T('email', 'Email (optional, shown publicly)'),
          { key: 'photo', label: 'Photo (optional; initials are shown otherwise)', type: 'photo' },
          A('bio', 'Short bio (optional)', { rows: 3 })
        ] },
      A('acknowledgements', 'Acknowledgements', { rows: 3, hint: MD_HINT })
    ] },
    { id: 'refs', label: 'References', lead: 'Numbered in the order shown.', fields: [
      { key: 'references', type: 'list', itemLabel: 'Reference', titleKey: 'text',
        newItem: () => ({ text: '', url: '' }),
        fields: [A('text', 'Citation', { rows: 3 }), T('url', 'Link / DOI URL (optional)')] }
    ] },
    { id: 'publish', label: 'Publish & QR' }
  ];

  // One tab per experiment, between the general tabs and the team/references tabs.
  function allTabs() {
    const exps = (content.experiments || []).map((e, i) => ({
      id: `exp-${i}`, exp: i, accent: e.accent, label: e.nav || e.title || `Experiment ${i + 1}`
    }));
    return [...TABS_BEFORE, ...exps, { id: 'add-exp', label: '+ Experiment' }, ...TABS_AFTER];
  }

  // ---------- Rendering ----------
  function renderTabs() {
    $('#tabs').innerHTML = allTabs().map(t =>
      `<button role="tab" data-tab="${t.id}" aria-selected="${t.id === currentTab}"${t.accent ? ` class="tab-exp tab-${esc(t.accent)}"` : ''}>${esc(t.label)}</button>`).join('');
  }
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    if (b.dataset.tab === 'add-exp') {
      content.experiments.push(Site.newExperiment());
      currentTab = `exp-${content.experiments.length - 1}`;
      changed();
    } else {
      currentTab = b.dataset.tab;
    }
    renderTabs(); renderPanel();
  });

  function renderPanel() {
    const tab = allTabs().find(t => t.id === currentTab) || (currentTab = 'intro', TABS_BEFORE[0]);
    const panel = $('#panel');
    const y = window.scrollY;
    panel.innerHTML = '';
    if (tab.id === 'publish') { renderPublish(panel); return; }
    if (tab.exp != null) { renderExperiment(panel, tab.exp); window.scrollTo(0, y); return; }
    panel.insertAdjacentHTML('beforeend', `<h2>${tab.label}</h2><p class="lead">${tab.lead}</p>`);
    renderFields(panel, content, tab.fields);
    window.scrollTo(0, y);
  }

  function renderExperiment(panel, i) {
    const exps = content.experiments;
    const exp = exps[i];
    panel.insertAdjacentHTML('beforeend', `
      <div class="card-head"><h2>Experiment ${i + 1}</h2><div class="card-tools">
        <button class="btn small" data-act="left" ${i === 0 ? 'disabled' : ''}>← Move earlier</button>
        <button class="btn small" data-act="right" ${i === exps.length - 1 ? 'disabled' : ''}>Move later →</button>
        <button class="btn small danger" data-act="del">Remove experiment</button></div></div>
      <p class="lead">This experiment has its own section on the site, with its own methods and microscopy gallery.</p>`);
    panel.querySelector('.card-tools').addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'del') {
        if (!confirm(`Remove the whole "${exp.nav || exp.title}" experiment, including all its methods and media?`)) return;
        exps.splice(i, 1);
        currentTab = exps.length ? `exp-${Math.max(0, i - 1)}` : 'intro';
      } else {
        const j = act === 'left' ? i - 1 : i + 1;
        [exps[i], exps[j]] = [exps[j], exps[i]];
        currentTab = `exp-${j}`;
      }
      changed(); renderTabs(); renderPanel();
    });
    renderFields(panel, exp, EXP_FIELDS);
  }

  function renderFields(root, obj, fields) {
    for (const f of fields) {
      if (f.type === 'list') renderList(root, obj, f);
      else if (f.type === 'media') root.append(mediaEditor(Site.get(obj, f.key) ?? (Site.set(obj, f.key, newMedia()), Site.get(obj, f.key)), f.label));
      else if (f.type === 'photo') root.append(photoEditor(obj, f));
      else if (f.type === 'select') root.append(selectField(obj, f));
      else root.append(textField(obj, f));
    }
  }

  // Monospace code box: Tab inserts spaces, and code can be loaded from a .R file.
  function codeField(obj, f) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const id = 'f' + Math.random().toString(36).slice(2);
    wrap.innerHTML = `<div class="inline" style="justify-content:space-between"><label for="${id}">${f.label}</label>
        <label class="btn small upload-label">Load from .R file…<input type="file" accept=".R,.r,.Rmd,.txt,text/plain"></label></div>
      <textarea id="${id}" class="code" rows="14" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="# paste your R code here"></textarea>
      <span class="hint">Paste the code exactly as you used it. Visitors can copy it or download it as a .R file.</span>`;
    const ta = wrap.querySelector('textarea');
    ta.value = obj[f.key] ?? '';
    const set = v => { obj[f.key] = v; changed(); };
    ta.addEventListener('input', () => set(ta.value));
    ta.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || e.shiftKey) return;
      e.preventDefault();
      ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
      set(ta.value);
    });
    wrap.querySelector('input[type=file]').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      ta.value = (await file.text()).replace(/\r\n/g, '\n');
      set(ta.value);
      toast(`Loaded ${file.name}`);
    });
    return wrap;
  }

  function selectField(obj, f) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const id = 'f' + Math.random().toString(36).slice(2);
    const val = Site.get(obj, f.key);
    wrap.innerHTML = `<label for="${id}">${f.label}</label><select id="${id}">` +
      Object.entries(f.options).map(([v, l]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${l}</option>`).join('') +
      '</select>';
    wrap.querySelector('select').addEventListener('change', e => {
      Site.set(obj, f.key, e.target.value);
      changed(); renderTabs();
    });
    return wrap;
  }

  function textField(obj, f, onInput) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const id = 'f' + Math.random().toString(36).slice(2);
    const val = Site.get(obj, f.key) ?? '';
    wrap.innerHTML = `<label for="${id}">${f.label}</label>` +
      (f.type === 'textarea'
        ? `<textarea id="${id}" rows="${f.rows || 4}">${esc(val)}</textarea>`
        : `<input id="${id}" type="text" value="${esc(val)}">`) +
      (f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '');
    wrap.querySelector('input,textarea').addEventListener('input', e => {
      Site.set(obj, f.key, e.target.value);
      onInput?.();
      f.onInput?.();
      changed();
    });
    return wrap;
  }

  function renderList(root, obj, f) {
    let arr = Site.get(obj, f.key);
    if (!Array.isArray(arr)) { arr = []; Site.set(obj, f.key, arr); }
    if (f.label) root.insertAdjacentHTML('beforeend', `<div class="list-label">${f.label}</div>`);

    arr.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      const title = () => {
        const t = f.titleKey ? String(item[f.titleKey] || '').trim() : '';
        return `${f.itemLabel} ${i + 1}${t ? ' · ' + t.slice(0, 60) : ''}`;
      };
      card.innerHTML = `<div class="card-head"><strong></strong><div class="card-tools">
        <button class="btn small" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button class="btn small" data-act="down" ${i === arr.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
        <button class="btn small danger" data-act="del">Remove</button></div></div>`;
      const head = card.querySelector('strong');
      head.textContent = title();
      card.querySelector('.card-tools').addEventListener('click', e => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        if (act === 'del' && !confirm(`Remove ${title()}?`)) return;
        if (act === 'del') arr.splice(i, 1);
        if (act === 'up') [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        if (act === 'down') [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
        changed(); renderPanel();
      });

      if (f.itemType === 'media') {
        card.append(mediaEditor(item, null, () => { head.textContent = title(); }));
      } else {
        for (const sub of f.fields) {
          if (sub.type === 'list') renderList(card, item, sub);
          else if (sub.type === 'photo') card.append(photoEditor(item, sub));
          else if (sub.type === 'code') card.append(codeField(item, sub));
          else card.append(textField(item, sub, () => { head.textContent = title(); }));
        }
      }
      root.append(card);
    });

    const add = document.createElement('button');
    add.className = 'btn';
    add.textContent = `+ Add ${f.itemLabel.toLowerCase()}`;
    add.addEventListener('click', () => { arr.push(f.newItem()); changed(); renderPanel(); });
    const addWrap = document.createElement('div');
    addWrap.style.marginBottom = '18px';
    addWrap.append(add);
    root.append(addWrap);
  }

  function resolveSrc(src) {
    return pending.get(src)?.url || src;
  }

  function thumbHTML(type, src) {
    if (!src) return `<div class="thumb">No file yet</div>`;
    const s = esc(resolveSrc(src));
    return `<div class="thumb">${type === 'video' ? `<video src="${s}#t=0.1" muted playsinline preload="metadata"></video>` : `<img src="${s}" alt="">`}</div>`;
  }

  function mediaEditor(m, label, onTitle) {
    const box = document.createElement('div');
    box.className = label ? 'field' : '';
    const render = () => {
      box.innerHTML = `${label ? `<label>${label}</label>` : ''}
        <div class="media-row">
          ${thumbHTML(Site.mediaType(m), m.src)}
          <div>
            <div class="inline" style="margin-bottom:8px">
              <select data-k="type" aria-label="Media type">
                <option value="image" ${m.type !== 'video' ? 'selected' : ''}>Image</option>
                <option value="video" ${m.type === 'video' ? 'selected' : ''}>Video</option>
              </select>
              <label class="btn small upload-label">Choose file…<input type="file" accept="image/*,video/mp4,video/webm,video/quicktime,video/x-msvideo,.avi"></label>
              ${m.src ? '<button class="btn small danger" data-clear>Clear</button>' : ''}
            </div>
            <div class="field"><input type="text" data-k="src" value="${esc(m.src)}" placeholder="media/filename.mp4 (empty = placeholder)" aria-label="File path"></div>
            <div class="field"><input type="text" data-k="caption" value="${esc(m.caption)}" placeholder="Caption" aria-label="Caption"></div>
            <div class="field"><input type="text" data-k="alt" value="${esc(m.alt)}" placeholder="Short description for screen readers (optional)" aria-label="Alt text"></div>
            ${pending.has(m.src) ? '<span class="hint">⏳ New file. It will upload when you publish.</span>' : ''}
          </div>
        </div>`;
      box.querySelectorAll('[data-k]').forEach(el => el.addEventListener(el.tagName === 'SELECT' || el.dataset.k === 'src' ? 'change' : 'input', () => {
        m[el.dataset.k] = el.value;
        if (el.dataset.k === 'caption') onTitle?.();
        if (el.dataset.k !== 'caption' && el.dataset.k !== 'alt') { changed(); render(); } else changed();
      }));
      box.querySelector('[data-clear]')?.addEventListener('click', () => { m.src = ''; changed(); render(); });
      box.querySelector('input[type=file]').addEventListener('change', async e => {
        let file = e.target.files[0];
        if (!file) return;
        if (needsConversion(file)) {
          try {
            file = await convertToMp4(file);
            toast(`Converted ✓ ${file.name} (${(file.size / 1048576).toFixed(1)} MB)`);
          } catch (err) {
            toast(`${err?.message || err} You can also convert it yourself with HandBrake (see README).`, true);
            return;
          }
        }
        m.src = addPendingFile(file);
        m.type = file.type.startsWith('video') || Site.isVideo(file.name) ? 'video' : 'image';
        changed(); render();
      });
    };
    render();
    return box;
  }

  function photoEditor(obj, f) {
    const box = document.createElement('div');
    box.className = 'field';
    const render = () => {
      const src = obj[f.key] || '';
      box.innerHTML = `<label>${f.label}</label><div class="media-row">${thumbHTML('image', src)}
        <div><div class="inline" style="margin-bottom:8px">
          <label class="btn small upload-label">Choose photo…<input type="file" accept="image/*"></label>
          ${src ? '<button class="btn small danger" data-clear>Clear</button>' : ''}</div>
          <input type="text" value="${esc(src)}" placeholder="media/photo.jpg" aria-label="Photo path"></div></div>`;
      box.querySelector('input[type=text]').addEventListener('change', e => { obj[f.key] = e.target.value; changed(); render(); });
      box.querySelector('[data-clear]')?.addEventListener('click', () => { obj[f.key] = ''; changed(); render(); });
      box.querySelector('input[type=file]').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) { obj[f.key] = addPendingFile(file); changed(); render(); }
      });
    };
    render();
    return box;
  }

  // ---------- AVI → MP4 (browsers can't play AVI) ----------
  // Converted inside the browser with ffmpeg.wasm, loaded from the CDN the first time it is needed.
  // The library starts its worker as an ES module, so the worker and core use the ESM builds.
  const FF_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist';
  const CORE_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
  let ffmpegPromise = null;

  function needsConversion(file) {
    return /\.avi$/i.test(file.name) || /x-msvideo|\/avi/.test(file.type);
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = () => rej(new Error('Could not load the video converter. Check your internet connection.'));
      document.head.append(s);
    });
  }

  function getFFmpeg() {
    ffmpegPromise ??= (async () => {
      if (!window.FFmpegWASM) await loadScript(`${FF_CDN}/umd/ffmpeg.js`);
      const ff = new FFmpegWASM.FFmpeg();
      // A same-origin worker is required; this tiny module just imports the real worker from the CDN.
      const worker = URL.createObjectURL(new Blob([`import "${FF_CDN}/esm/worker.js";`], { type: 'text/javascript' }));
      await ff.load({ classWorkerURL: worker, coreURL: `${CORE_CDN}/ffmpeg-core.js`, wasmURL: `${CORE_CDN}/ffmpeg-core.wasm` });
      return ff;
    })().catch(err => { ffmpegPromise = null; throw err; });
    return ffmpegPromise;
  }

  async function convertToMp4(file) {
    if (file.size > 1.5 * 1024 ** 3) throw new Error(`${file.name} is too large to convert in the browser (over 1.5 GB).`);
    let ff, onProgress;
    try {
      busy(`Converting ${file.name} to MP4`, ffmpegPromise ? 'Starting…' : 'Loading the converter (about 30 MB, only the first time)…', null);
      try { ff = await getFFmpeg(); }
      catch (err) { throw new Error(`Could not start the video converter (${err?.message || err}).`); }
      onProgress = ({ progress }) =>
        busy(null, 'Converting… please keep this tab open.', Math.min(Math.max(progress, 0), 1));
      ff.on('progress', onProgress);
      busy(null, 'Reading the file…', null);
      await ff.writeFile('in.avi', new Uint8Array(await file.arrayBuffer()));
      const code = await ff.exec([
        '-i', 'in.avi',
        '-an',                                              // time-lapses have no sound
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-pix_fmt', 'yuv420p',                              // plays on every phone
        '-vf', 'scale=trunc(min(1920\\,iw)/2)*2:-2',        // max 1920 px wide, even dimensions
        '-movflags', '+faststart',                          // starts playing before fully loaded
        'out.mp4'
      ]);
      if (code !== 0) throw new Error(`Could not convert ${file.name}.`);
      const data = await ff.readFile('out.mp4');
      return new File([data], file.name.replace(/\.avi$/i, '') + '.mp4', { type: 'video/mp4' });
    } finally {
      if (ff) {
        if (onProgress) ff.off('progress', onProgress);
        await ff.deleteFile('in.avi').catch(() => {});
        await ff.deleteFile('out.mp4').catch(() => {});
      }
      busy(false);
    }
  }

  // Blocking progress overlay: busy(title, note, progress 0..1 | null) or busy(false) to hide.
  function busy(title, note, progress) {
    const el = $('#busy');
    if (title === false) { el.hidden = true; return; }
    el.hidden = false;
    if (title) $('#busy-title').textContent = title;
    if (note) $('#busy-note').textContent = note;
    const bar = $('#busy-bar');
    if (progress == null) bar.removeAttribute('value');
    else bar.value = progress;
  }

  function addPendingFile(file) {
    const isVid = file.type.startsWith('video');
    const mb = file.size / 1048576;
    if (isVid && mb > 25) toast(`That video is ${mb.toFixed(0)} MB. Consider compressing it to under ~20 MB so it loads on mobile data.`, true);
    else if (!isVid && mb > 3) toast(`That image is ${mb.toFixed(1)} MB. Consider resizing it (≈2000 px wide is plenty).`, true);
    if (/\.(mov)$/i.test(file.name)) toast('.mov files often do not play on Android. Export as .mp4 (H.264) if possible.', true);
    const clean = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-');
    let path = `media/${clean}`;
    if (pending.has(path)) path = `media/${Date.now()}-${clean}`;
    pending.set(path, { file, url: URL.createObjectURL(file) });
    return path;
  }

  // ---------- Draft, status, preview ----------
  let saveTimer, previewTimer;
  function changed() {
    dirty = true;
    updateStatus();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => Site.writeDraft(content), 300);
    clearTimeout(previewTimer);
    previewTimer = setTimeout(pushPreview, 250);
  }

  function updateStatus() {
    const el = $('#status');
    const n = pending.size;
    el.textContent = dirty
      ? `Unpublished changes${n ? ` · ${n} file${n > 1 ? 's' : ''} to upload` : ''} (saved as a draft in this browser)`
      : 'Up to date with the published site';
    el.classList.toggle('dirty', dirty);
  }

  function previewContent() {
    const c = structuredClone(content);
    Site.forEachMediaSlot(c, (o, k) => { if (o[k]) o[k] = resolveSrc(o[k]); });
    return c;
  }
  function pushPreview() {
    if (!content) return;
    $('#preview').contentWindow?.postMessage({ type: 'preview-content', content: previewContent() }, location.origin);
  }
  $('#preview').addEventListener('load', pushPreview);

  window.addEventListener('beforeunload', e => {
    if (pending.size) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- GitHub ----------
  function ghSettings() {
    try { return JSON.parse(localStorage.getItem(GH_KEY)) || {}; } catch { return {}; }
  }
  function saveGhSettings(s) {
    try { localStorage.setItem(GH_KEY, JSON.stringify(s)); } catch {}
  }
  function ghReady(s = ghSettings()) { return s.owner && s.repo && s.token; }

  async function gh(method, path, body) {
    const s = ghSettings();
    const branch = s.branch || 'main';
    const url = `https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${path}` +
      (method === 'GET' ? `?ref=${encodeURIComponent(branch)}` : '');
    const r = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${s.token}`, Accept: 'application/vnd.github+json' },
      body: body ? JSON.stringify({ ...body, branch }) : undefined
    });
    if (method === 'GET' && r.status === 404) return null;
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`GitHub ${r.status}: ${data.message || r.statusText}`);
    return data;
  }

  async function ghPut(path, base64, message) {
    const existing = await gh('GET', path);
    return gh('PUT', path, { message, content: base64, sha: existing?.sha });
  }

  function textToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function fileToBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  }

  function referencedPaths() {
    const set = new Set();
    Site.forEachMediaSlot(content, (o, k) => { if (o[k]) set.add(o[k]); });
    return set;
  }

  async function publish() {
    if (!ghReady()) {
      currentTab = 'publish'; renderTabs(); renderPanel();
      toast('Connect your GitHub repository first (see below).', true);
      return;
    }
    const btn = $('#btn-publish');
    btn.disabled = true;
    try {
      const used = referencedPaths();
      const files = [...pending].filter(([p]) => used.has(p));
      let i = 0;
      for (const [path, { file }] of files) {
        toast(`Uploading ${++i}/${files.length}: ${path}…`);
        await ghPut(path, await fileToBase64(file), `Add ${path}`);
      }
      toast('Saving text…');
      await ghPut('content.json', textToBase64(JSON.stringify(content, null, 2) + '\n'), 'Update site content');
      pending.forEach(p => URL.revokeObjectURL(p.url));
      pending.clear();
      Site.clearDraft();
      dirty = false;
      updateStatus();
      renderPanel();
      toast('Published ✓. The live site updates in about 1 minute.');
    } catch (err) {
      toast(`Publishing failed: ${err.message}`, true);
    } finally {
      btn.disabled = false;
    }
  }
  $('#btn-publish').addEventListener('click', publish);

  // ---------- Publish tab ----------
  function siteUrl(s) {
    if (s.siteUrl) return s.siteUrl;
    if (location.hostname.endsWith('github.io')) return location.href.replace(/admin\.html.*$/, '');
    if (s.owner && s.repo) {
      const o = s.owner.toLowerCase();
      return s.repo.toLowerCase() === `${o}.github.io` ? `https://${o}.github.io/` : `https://${o}.github.io/${s.repo}/`;
    }
    return '';
  }

  function renderPublish(panel) {
    const s = ghSettings();
    panel.innerHTML = `
      <h2>Publish &amp; QR code</h2>
      <p class="lead">Your edits are saved as a draft in this browser only. Click <b>Publish</b> to put them online for everyone.</p>
      ${pending.size ? `<div class="note warn">${pending.size} new file(s) are waiting to upload. They are only kept while this tab is open, so publish before closing it.</div>` : ''}

      <div class="card">
        <div class="card-head"><strong>GitHub connection</strong><span class="hint">${ghReady(s) ? '✓ configured' : 'not configured'}</span></div>
        <div class="field"><label for="gh-owner">GitHub user or organisation</label><input id="gh-owner" type="text" value="${esc(s.owner || '')}" placeholder="e.g. crispr-team"></div>
        <div class="field"><label for="gh-repo">Repository name</label><input id="gh-repo" type="text" value="${esc(s.repo || '')}" placeholder="e.g. poster-site"></div>
        <div class="field"><label for="gh-branch">Branch</label><input id="gh-branch" type="text" value="${esc(s.branch || 'main')}"></div>
        <div class="field"><label for="gh-token">Access token</label><input id="gh-token" type="password" value="${esc(s.token || '')}" autocomplete="off">
          <span class="hint">A fine-grained token with <b>Contents: read &amp; write</b> access to this one repository. Each editor creates their own. It's stored only in this browser. Don't use this on a shared computer.</span></div>
        <div class="inline">
          <button class="btn primary" id="gh-save">Save connection</button>
          <button class="btn" id="gh-test">Test connection</button>
          <button class="btn" id="gh-pull">Load latest from GitHub</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><strong>QR code for the poster</strong></div>
        <div class="field"><label for="site-url">Public site URL</label><input id="site-url" type="text" value="${esc(siteUrl(s))}" placeholder="https://user.github.io/repo/"></div>
        <div class="qr"><div class="qr-box" id="qr-box"><span class="hint">Enter URL</span></div>
          <div><p class="hint" style="margin-top:0">Print it at least 2.5 cm wide. Test it with a few phones before printing the poster.</p>
          <button class="btn" id="qr-dl">Download QR (PNG)</button></div></div>
      </div>

      <div class="card">
        <div class="card-head"><strong>Backup &amp; manual mode</strong></div>
        <p class="hint" style="margin-top:0">If you don't use the GitHub connection, download <code>content.json</code> and put it (plus your files in <code>media/</code>) into the site folder yourself.</p>
        <div class="inline">
          <button class="btn" id="dl-json">Download content.json</button>
          <label class="btn upload-label">Import content.json…<input type="file" id="import-json" accept="application/json,.json"></label>
          <button class="btn danger" id="discard">Discard draft</button>
        </div>
      </div>`;

    const readForm = () => ({
      owner: $('#gh-owner').value.trim(), repo: $('#gh-repo').value.trim(),
      branch: $('#gh-branch').value.trim() || 'main', token: $('#gh-token').value.trim(),
      siteUrl: ghSettings().siteUrl
    });
    $('#gh-save').onclick = () => { saveGhSettings(readForm()); toast('Connection saved in this browser.'); renderPanel(); };
    $('#gh-test').onclick = async () => {
      saveGhSettings(readForm());
      try { const f = await gh('GET', 'content.json'); toast(f ? '✓ Connected. content.json found.' : 'Connected, but content.json is not in the repo yet.'); }
      catch (err) { toast(err.message, true); }
    };
    $('#gh-pull').onclick = async () => {
      if (dirty && !confirm('Replace your unpublished draft with the latest version from GitHub?')) return;
      try {
        saveGhSettings(readForm());
        const f = await gh('GET', 'content.json');
        if (!f) throw new Error('content.json not found in repo');
        const bin = atob(f.content.replace(/\n/g, ''));
        content = Site.normalize(JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))));
        Site.clearDraft(); dirty = false; updateStatus(); pushPreview(); renderTabs(); toast('Loaded latest content from GitHub.');
      } catch (err) { toast(err.message, true); }
    };

    const drawQR = () => {
      const url = $('#site-url').value.trim();
      const box = $('#qr-box');
      if (!url || typeof qrcode === 'undefined') { box.innerHTML = '<span class="hint">Enter URL</span>'; return null; }
      const qr = qrcode(0, 'M');
      qr.addData(url); qr.make();
      const data = qr.createDataURL(10, 4);
      box.innerHTML = `<img src="${data}" alt="QR code for ${esc(url)}">`;
      return data;
    };
    $('#site-url').addEventListener('input', () => { saveGhSettings({ ...ghSettings(), siteUrl: $('#site-url').value.trim() }); drawQR(); });
    drawQR();
    $('#qr-dl').onclick = () => { const d = drawQR(); if (d) download('poster-qr.png', d); };

    $('#dl-json').onclick = () => {
      const blob = new Blob([JSON.stringify(content, null, 2) + '\n'], { type: 'application/json' });
      const u = URL.createObjectURL(blob); download('content.json', u); setTimeout(() => URL.revokeObjectURL(u), 1000);
    };
    $('#import-json').onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try { content = Site.normalize(JSON.parse(await file.text())); changed(); renderTabs(); renderPanel(); toast('Imported.'); }
      catch { toast('That file is not valid JSON.', true); }
    };
    $('#discard').onclick = async () => {
      if (!confirm('Throw away all unpublished changes and reload the published version?')) return;
      Site.clearDraft(); pending.clear(); content = await Site.loadPublished(); dirty = false; updateStatus(); pushPreview(); renderTabs(); renderPanel();
    };
  }

  function download(name, href) {
    const a = document.createElement('a');
    a.href = href; a.download = name; document.body.append(a); a.click(); a.remove();
  }

  let toastTimer;
  function toast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show${isError ? ' error' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, isError ? 6000 : 3500);
  }

  // ---------- Boot ----------
  (async () => {
    const draft = Site.readDraft();
    try {
      content = draft || await Site.loadPublished();
      dirty = !!draft;
    } catch (err) {
      $('#panel').innerHTML = `<p>Could not load content.json (${esc(err.message)}). Serve the folder with a local web server (see README).</p>`;
      return;
    }
    renderTabs(); renderPanel(); updateStatus(); pushPreview();
  })();
})();
