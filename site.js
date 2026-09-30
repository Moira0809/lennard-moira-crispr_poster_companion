// Renders content.json (or the editor's draft in preview mode) into index.html.
(function () {
  const $ = s => document.querySelector(s);
  const { esc, md, inline, mediaType } = Site;
  const isPreview = new URLSearchParams(location.search).has('preview');

  function mediaHTML(m, { eager = false } = {}) {
    const type = mediaType(m);
    const cap = m.caption ? `<figcaption>${inline(m.caption)}</figcaption>` : '';
    if (!m.src) {
      const label = type === 'video' ? 'Video coming soon' : 'Image coming soon';
      const icon = type === 'video'
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 17l4-5 3 4 2-2 3 3z"/><circle cx="16" cy="9" r="1.6"/></svg>';
      return `<figure class="media"><div class="placeholder">${icon}<span>${label}</span></div>${cap}</figure>`;
    }
    const alt = esc(m.alt || m.caption || '');
    if (type === 'video') {
      // "#t=0.1" makes iPhones show the first frame instead of a black box
      const vsrc = m.src.includes('#') ? m.src : `${m.src}#t=0.1`;
      return `<figure class="media"><video src="${esc(vsrc)}" controls playsinline preload="metadata" muted></video>${cap}</figure>`;
    }
    return `<figure class="media"><button class="zoom" data-src="${esc(m.src)}" data-cap="${esc(m.caption || '')}" aria-label="Enlarge image"><img src="${esc(m.src)}" alt="${alt}" ${eager ? '' : 'loading="lazy"'}></button>${cap}</figure>`;
  }

  function initials(name) {
    return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  function render(c) {
    document.querySelectorAll('[data-bind]').forEach(el => { el.textContent = Site.get(c, el.dataset.bind) ?? ''; });
    document.title = c.meta?.title || document.title;

    const hero = c.hero || {};
    $('#hero-media').outerHTML = `<div id="hero-media">${hero.src ? mediaHTML(hero, { eager: true }) : ''}</div>`;

    $('#overview-body').innerHTML = md(c.overview?.body);

    const exps = c.experiments || [];
    const accent = e => (e.accent in Site.ACCENTS ? e.accent : 'gfp');

    $('#toc').innerHTML = [
      '<a href="#overview">Overview</a>',
      ...exps.map((e, i) => `<a class="toc-exp accent-${accent(e)}" href="#${Site.expId(e, i)}">${esc(e.nav || e.title)}</a>`),
      '<a href="#team">Team</a>',
      '<a href="#references">References</a>'
    ].join('');

    $('#exp-cards').innerHTML = exps.length > 1 ? exps.map((e, i) => `
      <a class="exp-card accent-${accent(e)}" href="#${Site.expId(e, i)}">
        <span class="exp-kicker">Experiment ${i + 1}</span>
        <strong>${esc(e.title || e.nav)}</strong>
        ${(e.methods || []).length ? `<ul class="exp-methods">${e.methods.map(m => `<li>${esc(m.title)}</li>`).join('')}</ul>` : ''}
        <span class="exp-go">Explore this experiment →</span>
      </a>`).join('') : '';

    $('#experiments').innerHTML = exps.map((e, i) => `
      <section id="${Site.expId(e, i)}" class="section experiment accent-${accent(e)}">
        <div class="wrap">
          <span class="exp-kicker">Experiment ${i + 1}</span>
          <h2>${esc(e.title || e.nav)}</h2>
          <div class="prose">${md(e.intro)}</div>

          ${(e.methods || []).length ? `
          <h3 class="sub">Methods, and why we used them</h3>
          <ol class="methods">${e.methods.map((m, j) => `
            <li class="method">
              <div class="method-num">${String(j + 1).padStart(2, '0')}</div>
              <div class="method-body">
                <h3>${esc(m.title)}</h3>
                <div class="prose">${md(m.what)}</div>
                ${m.why ? `<div class="why"><span class="why-label">Why this method?</span>${md(m.why)}</div>` : ''}
                ${(m.media || []).length ? `<div class="method-media">${m.media.map(x => mediaHTML(x)).join('')}</div>` : ''}
              </div>
            </li>`).join('')}
          </ol>` : ''}

          ${(e.media || []).length || e.galleryIntro ? `
          <h3 class="sub">${esc(e.galleryHeading || 'From the microscope')}</h3>
          <div class="prose">${md(e.galleryIntro)}</div>
          <div class="gallery">${(e.media || []).map(x => mediaHTML(x)).join('')}</div>` : ''}

          ${(e.code || []).length ? `
          <h3 class="sub">Data analysis in R</h3>
          <div class="prose">${md(e.codeIntro)}</div>
          <div class="code-list">${e.code.map(c => `
            <details class="code-block">
              <summary><span class="code-lang">R</span><span class="code-title">${esc(c.title || 'R script')}</span></summary>
              ${c.description ? `<div class="prose code-desc">${md(c.description)}</div>` : ''}
              <div class="code-tools">
                <button type="button" data-copy>Copy code</button>
                <button type="button" data-download="${esc(Site.slug(c.title) || 'script')}.R">Download .R</button>
              </div>
              <pre><code class="language-r">${esc(c.code || '# (code coming soon)')}</code></pre>
            </details>`).join('')}
          </div>` : ''}

          <nav class="exp-next" aria-label="Continue">
            ${exps[i + 1] ? `<a class="next accent-${accent(exps[i + 1])}" href="#${Site.expId(exps[i + 1], i + 1)}">Next: ${esc(exps[i + 1].title || exps[i + 1].nav)} →</a>` : ''}
            <a href="#top">↑ Back to top</a>
          </nav>
        </div>
      </section>`).join('');

    $('#authors').innerHTML = (c.authors || []).map(a => `
      <article class="author">
        ${a.photo ? `<img class="avatar" src="${esc(a.photo)}" alt="${esc(a.name)}" loading="lazy">` : `<div class="avatar initials" aria-hidden="true">${esc(initials(a.name))}</div>`}
        <div>
          <h3>${esc(a.name)}</h3>
          ${a.role ? `<p class="role">${esc(a.role)}</p>` : ''}
          ${a.affiliation ? `<p class="aff">${esc(a.affiliation)}</p>` : ''}
          ${a.bio ? `<div class="bio">${md(a.bio)}</div>` : ''}
          ${a.email ? `<a class="mail" href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : ''}
        </div>
      </article>`).join('');

    $('#ack').innerHTML = c.acknowledgements ? `<h3>Acknowledgements</h3>${md(c.acknowledgements)}` : '';

    $('#refs').innerHTML = (c.references || []).map(r => `
      <li>${inline(r.text)}${r.url ? ` <a class="ref-link" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url.replace(/^https?:\/\/(dx\.)?/, ''))}</a>` : ''}</li>`).join('');

    if (window.Prism) Prism.highlightAllUnder($('#experiments'));
    watchSections();
  }

  // Highlight the menu chip of the section currently on screen, and keep it visible in the menu.
  let observer;
  function watchSections() {
    observer?.disconnect();
    const links = [...document.querySelectorAll('#toc a')];
    const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const visible = new Map();
    observer = new IntersectionObserver(entries => {
      entries.forEach(en => visible.set(en.target.id, en.isIntersecting));
      const current = sections.find(s => visible.get(s.id));
      links.forEach(a => {
        const on = !!current && a.getAttribute('href') === `#${current.id}`;
        if (on && !a.classList.contains('active')) {
          const toc = $('#toc');
          toc.scrollTo({ left: a.offsetLeft - (toc.clientWidth - a.offsetWidth) / 2 });
        }
        a.classList.toggle('active', on);
      });
    }, { rootMargin: '-80px 0px -60% 0px' });
    sections.forEach(s => observer.observe(s));
  }

  // Lightbox for images
  const lb = $('#lightbox');
  document.addEventListener('click', e => {
    const z = e.target.closest('.zoom');
    if (z) {
      lb.querySelector('img').src = z.dataset.src;
      lb.querySelector('.lb-cap').textContent = z.dataset.cap;
      lb.showModal();
    } else if (e.target === lb || e.target.closest('.lb-close')) {
      lb.close();
    }
  });

  // R code: copy to clipboard / download as .R file
  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-copy], [data-download]');
    if (!btn) return;
    const code = btn.closest('.code-block').querySelector('code').textContent;
    if (btn.hasAttribute('data-copy')) {
      let ok = false;
      try { await navigator.clipboard.writeText(code); ok = true; }
      catch {
        // fallback for older phones / browsers without clipboard access
        const t = Object.assign(document.createElement('textarea'), { value: code });
        t.style.cssText = 'position:fixed;opacity:0';
        document.body.append(t); t.select();
        try { ok = document.execCommand('copy'); } catch {}
        t.remove();
      }
      btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
      setTimeout(() => { btn.textContent = 'Copy code'; }, 1800);
    } else {
      const url = URL.createObjectURL(new Blob([code + '\n'], { type: 'text/plain' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: btn.dataset.download });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });

  // Live updates from the editor's preview iframe
  window.addEventListener('message', e => {
    if (e.origin === location.origin && e.data?.type === 'preview-content') render(Site.normalize(e.data.content));
  });

  (async () => {
    let content = null;
    if (isPreview) {
      content = Site.readDraft();
      $('#preview-banner').hidden = !content || window.self !== window.top;
    }
    if (!content) {
      try { content = await Site.loadPublished(); }
      catch (err) {
        document.querySelector('main').innerHTML = `<p class="wrap section">Could not load content (${esc(err.message)}). If you opened this file directly, start a local server instead (see README).</p>`;
        return;
      }
    }
    render(content);
  })();
})();
