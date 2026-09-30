// Shared helpers for the public page and the editor.
const Site = {
  DRAFT_KEY: 'poster-site-draft-v1',

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // Tiny markdown: paragraphs, **bold**, *italic*, [text](url), line breaks.
  inline(s) {
    return Site.esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
  },
  md(s) {
    return String(s ?? '').trim().split(/\n\s*\n/).filter(Boolean)
      .map(p => `<p>${Site.inline(p.trim())}</p>`).join('');
  },

  isVideo(src) {
    return /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(src || '');
  },
  mediaType(m) {
    if (m?.type === 'video' || m?.type === 'image') return m.type;
    return Site.isVideo(m?.src) ? 'video' : 'image';
  },

  get(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  },
  set(obj, path, val) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
    target[last] = val;
  },

  ACCENTS: { gfp: 'GFP green', magenta: 'Magenta', farred: 'Far-red' },

  slug(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  },
  expId(exp, i) {
    return Site.slug(exp.nav || exp.title) || `experiment-${i + 1}`;
  },

  newExperiment(nav = 'New experiment', accent = 'farred') {
    return {
      nav, title: nav, accent, intro: '',
      methods: [], galleryHeading: 'From the microscope', galleryIntro: '', media: [],
      codeIntro: '', code: []
    };
  },

  // Older content.json had one top-level methods/results block; move it into experiments[].
  normalize(c) {
    if (!c || Array.isArray(c.experiments)) return c;
    const crispr = Site.newExperiment('CRISPR', 'gfp');
    crispr.title = 'CRISPR-Cas experiment';
    crispr.methods = c.methods || [];
    crispr.galleryHeading = c.results?.heading || crispr.galleryHeading;
    crispr.galleryIntro = c.results?.intro || '';
    crispr.media = c.results?.media || [];
    c.experiments = [crispr, Site.newExperiment('Optogenetics', 'magenta')];
    delete c.methods;
    delete c.results;
    return c;
  },

  // Calls fn(obj, key) for every place a media path is stored.
  forEachMediaSlot(c, fn) {
    if (c.hero) fn(c.hero, 'src');
    c.experiments?.forEach(e => {
      e.methods?.forEach(m => m.media?.forEach(x => fn(x, 'src')));
      e.media?.forEach(x => fn(x, 'src'));
    });
    c.authors?.forEach(a => fn(a, 'photo'));
  },

  readDraft() {
    try { const s = localStorage.getItem(Site.DRAFT_KEY); return s ? Site.normalize(JSON.parse(s)) : null; } catch { return null; }
  },
  writeDraft(content) {
    try { localStorage.setItem(Site.DRAFT_KEY, JSON.stringify(content)); return true; } catch { return false; }
  },
  clearDraft() {
    try { localStorage.removeItem(Site.DRAFT_KEY); } catch {}
  },

  async loadPublished() {
    const r = await fetch('content.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`content.json: HTTP ${r.status}`);
    return Site.normalize(await r.json());
  }
};
