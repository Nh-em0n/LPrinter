/* LPrinter — localStorage HTML -> PDF Studio
 * UI shell + HTML sanitation. All PDF layout and generation lives in
 * pdfFromHtml.js, loaded as a classic script before this file.
 *
 * The source document is read from localStorage.HTML_TO_BE_PRINT; there is no
 * editor. If that key is missing or empty the preview shows "No content found".
 */
(function () {
  'use strict';

  // UI margin presets -> PDF points. Each theme preset uses a different one.
  const MARGINS = {
    narrow:  { top: 36, right: 36, bottom: 36, left: 36 },
    compact: { top: 44, right: 44, bottom: 48, left: 44 },
    normal:  { top: 62, right: 57, bottom: 68, left: 57 },
    relaxed: { top: 68, right: 64, bottom: 72, left: 64 },
    wide:    { top: 72, right: 72, bottom: 72, left: 72 }
  };

  // Font sources. Math/Indic faces are always available; the base family is
  // chosen per theme. No monospace face is loaded — code uses the base font.
  const FONT_BASE = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/';
  const LATO = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/lato/';
  const NOTO_SERIF = FONT_BASE + 'NotoSerif/';
  const POPPINS = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/';
  const CRIMSON = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/crimsontext/';
  const KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/fonts/';
  const EMOJI = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notoemoji/';

  const COMMON_FONTS = {
    // Noto Sans Bengali triggers a fontkit GPOS crash on conjuncts such as
    // র্বা; Noto Serif Bengali shapes the same text correctly.
    bn: FONT_BASE + 'NotoSerifBengali/NotoSerifBengali-Regular.ttf',
    bnBold: FONT_BASE + 'NotoSerifBengali/NotoSerifBengali-SemiBold.ttf',
    hi: FONT_BASE + 'NotoSerifDevanagari/NotoSerifDevanagari-Regular.ttf',
    hiBold: FONT_BASE + 'NotoSerifDevanagari/NotoSerifDevanagari-Bold.ttf',
    // Math: STIX Two Math for operators/symbols, KaTeX faces for upright
    // digits/text and italic variables. All are real embedded vector fonts.
    math: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/stixtwomath/STIXTwoMath-Regular.ttf',
    mathText: KATEX + 'KaTeX_Main-Regular.ttf',
    mathTextBold: KATEX + 'KaTeX_Main-Bold.ttf',
    mathItalic: KATEX + 'KaTeX_Math-Italic.ttf',
    // Monochrome Noto Emoji: real vector glyphs that pdf-lib/fontkit can embed.
    emoji: EMOJI + 'NotoEmoji%5Bwght%5D.ttf'
  };

  // Base families available to theme presets.
  const BASE_FONTS = {
    sans: {
      sans: LATO + 'Lato-Regular.ttf',
      sansItalic: LATO + 'Lato-Italic.ttf',
      sansBold: LATO + 'Lato-Bold.ttf',
      sansBoldItalic: LATO + 'Lato-BoldItalic.ttf'
    },
    serif: {
      serif: NOTO_SERIF + 'NotoSerif-Regular.ttf',
      serifItalic: NOTO_SERIF + 'NotoSerif-Italic.ttf',
      serifBold: NOTO_SERIF + 'NotoSerif-Bold.ttf',
      serifBoldItalic: NOTO_SERIF + 'NotoSerif-BoldItalic.ttf'
    },
    geometric: {
      geometric: POPPINS + 'Poppins-Regular.ttf',
      geometricItalic: POPPINS + 'Poppins-Italic.ttf',
      geometricBold: POPPINS + 'Poppins-Bold.ttf',
      geometricBoldItalic: POPPINS + 'Poppins-BoldItalic.ttf'
    },
    classic: {
      classic: CRIMSON + 'CrimsonText-Regular.ttf',
      classicItalic: CRIMSON + 'CrimsonText-Italic.ttf',
      classicBold: CRIMSON + 'CrimsonText-Bold.ttf',
      classicBoldItalic: CRIMSON + 'CrimsonText-BoldItalic.ttf'
    }
  };

  // Modern document presets. Mint Deck is the reference look; the other five
  // are rebuilt from it with their own font, size, colour, spacing and margin.
  const THEMES = {
    mint: {
      label: 'Mint Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#0f766e', justify: false, runningHead: true
    },
    slate: {
      label: 'Slate Deck', fontFamily: 'sans', fontSize: 10.5,
      lineHeight: 1.6, paragraphGap: 10, margin: 'normal',
      primary: '#334155', justify: true, runningHead: true
    },
    navy: {
      label: 'Navy Report', fontFamily: 'serif', fontSize: 9.8,
      lineHeight: 1.55, paragraphGap: 8, margin: 'narrow',
      primary: '#1f4e79', justify: false, runningHead: true
    },
    navyblue: {
      label: 'Navy Blue', fontFamily: 'sans', fontSize: 10.4,
      lineHeight: 1.62, paragraphGap: 9, margin: 'compact',
      primary: '#0b2545', justify: false, runningHead: true
    },
    ink: {
      label: 'Ink Paper', fontFamily: 'classic', fontSize: 11.2,
      lineHeight: 1.7, paragraphGap: 12, margin: 'wide',
      primary: '#3f3f46', justify: true, runningHead: true
    },
    crimsonred: {
      label: 'Crimson Red', fontFamily: 'classic', fontSize: 10.1,
      lineHeight: 1.66, paragraphGap: 10, margin: 'normal',
      primary: '#a4161a', justify: false, runningHead: true
    }
  };

  function fontsForTheme(fontFamily) {
    return Object.assign({}, COMMON_FONTS, BASE_FONTS[fontFamily] || BASE_FONTS.sans);
  }

  function mix(a, b, t) {
    const ca = String(a).replace('#', '');
    const cb = String(b).replace('#', '');
    const part = (i) => Math.round(
      parseInt(ca.substr(i, 2), 16) * (1 - t) + parseInt(cb.substr(i, 2), 16) * t
    ).toString(16).padStart(2, '0');
    return '#' + part(0) + part(2) + part(4);
  }

  // Tint the neutral white/light-gray surfaces with the theme's primary colour.
  // Tables use a darkened shade of the theme colour for the header and light borders on white rows.
  function themeColors(primary) {
    const p = /^#[0-9a-f]{6}$/i.test(primary || '') ? primary : THEMES.mint.primary;
    return {
      background: '#ffffff',
      surface: mix(p, '#ffffff', 0.94),
      surfaceAlt: mix(p, '#ffffff', 0.88),
      text: '#1f2328',
      heading: '#1f2328',
      muted: '#656d76',
      accent: p,
      border: mix(p, '#ffffff', 0.78),
      link: p,
      quoteText: '#3a4048',
      codeBg: '#f3f6f9',
      codeBorder: '#d8dee4',
      codeFg: '#2b3440',
      inlineCodeBg: mix(p, '#ffffff', 0.90),
      mark: mix(p, '#ffffff', 0.84),
      tableHeaderBg: mix(p, '#000000', 0.35),
      tableHeaderText: '#ffffff',
      tableRowBg: '#ffffff',
      tableStripeBg: mix(p, '#ffffff', 0.965),
      tableBorder: '#c6cacf',
      tableRowBorder: '#e3e7ec'
    };
  }

  const STORAGE_KEY = 'HTML_TO_BE_PRINT';
  const OPTIONS_KEY = 'lprinter:options';
  const RENDER_DELAY_MS = 2000;

  const $ = (id) => document.getElementById(id);
  // localStorage can be unavailable for file:// pages in some browsers.
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } }
  };

  // ---------- state & DOM ----------
  const state = {
    theme: 'mint',
    fontFamily: THEMES.mint.fontFamily,
    primary: THEMES.mint.primary,
    lineHeight: THEMES.mint.lineHeight,
    paragraphGap: THEMES.mint.paragraphGap,
    justify: THEMES.mint.justify,
    runningHead: THEMES.mint.runningHead,
    fontSize: THEMES.mint.fontSize,
    pageSize: 'A4',
    margin: THEMES.mint.margin,
    pageNumbers: true,
    autoToc: false,
    footerText: '',
    watermark: ''
  };

  const frame = $('pdfFrame');
  const overlay = $('overlay');
  const statusEl = $('status');
  const emptyState = $('emptyState');
  const downloadBtn = $('downloadBtn');
  const printBtn = $('printBtn');

  let currentUrl = null;
  let busy = false;
  let pending = false;
  let lastSnapshot = null;
  let configTimer = null;

  // ---------- helpers ----------
  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.className = isError ? 'text-danger' : 'text-muted';
  }

  function showOverlay(show) {
    overlay.classList.toggle('hidden', !show);
  }

  // Apply a preset to the style state used by the renderer. Presets own the
  // font size and margin, so there is no separate custom mode.
  function applyTheme(id) {
    const theme = THEMES[id] || THEMES.mint;
    state.theme = THEMES[id] ? id : 'mint';
    state.fontFamily = theme.fontFamily;
    state.primary = theme.primary;
    state.lineHeight = theme.lineHeight;
    state.paragraphGap = theme.paragraphGap;
    state.justify = theme.justify;
    state.runningHead = theme.runningHead;
    state.fontSize = theme.fontSize;
    state.margin = theme.margin;
    $('theme').value = state.theme;
  }

  // If a CDN script failed, fail visibly instead of leaving the spinner up.
  const missing = [];
  if (typeof pdfFromHtml !== 'function') missing.push('pdfFromHtml.js');
  if (typeof PDFLib === 'undefined') missing.push('pdf-lib');
  if (typeof fontkit === 'undefined') missing.push('fontkit');
  if (typeof DOMPurify === 'undefined') missing.push('DOMPurify');
  if (missing.length) {
    showOverlay(false);
    downloadBtn.disabled = true;
    printBtn.disabled = true;
    setStatus('Error: failed to load ' + missing.join(', ') + ' (check internet connection)', true);
    return;
  }

  // ---------- source from localStorage ----------
  const SANITIZE_CONFIG = {
    ADD_ATTR: ['align', 'style', 'type', 'checked', 'disabled'],
    ADD_DATA_URI_TAGS: ['img']
  };

  function readSource() {
    const raw = store.get(STORAGE_KEY);
    lastSnapshot = raw;
    if (typeof raw !== 'string' || !raw.trim()) return '';
    return DOMPurify.sanitize(raw, SANITIZE_CONFIG);
  }

  function showNoContent() {
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
    frame.removeAttribute('src');
    frame.classList.add('hidden');
    emptyState.classList.remove('hidden');
    downloadBtn.disabled = true;
    printBtn.disabled = true;
    showOverlay(false);
    setStatus('No HTML content found in localStorage.HTML_TO_BE_PRINT');
  }

  function hideNoContent() {
    emptyState.classList.add('hidden');
    frame.classList.remove('hidden');
  }

  // ---------- PDF generation via pdfFromHtml ----------
  async function generate() {
    // An explicit Refresh/Ctrl+Enter cancels any pending debounced render.
    window.clearTimeout(configTimer);

    if (busy) {
      // Options changed while a PDF was being built: queue one more pass so
      // the preview always ends up matching the current controls.
      pending = true;
      return;
    }

    const html = readSource();
    if (!html) {
      showNoContent();
      return;
    }

    busy = true;
    showOverlay(true);

    try {
      state.pageSize = $('pageSize').value;
      state.pageNumbers = $('pageNumbers').checked;
      state.autoToc = $('autoToc').checked;
      state.footerText = $('footerText').value.trim();
      state.watermark = $('watermark').value.trim();

      // Everything about the output is passed in as options — no layout code
      // remains in this file.
      const pdfOptions = {
        name: $('filename').value || 'document',
        pageSize: state.pageSize,
        margin: MARGINS[state.margin] || MARGINS.normal,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        paragraphGap: state.paragraphGap,
        justify: state.justify,
        runningHead: state.runningHead,
        fontFamily: state.fontFamily,
        pageNumbers: state.pageNumbers,
        autoToc: state.autoToc,
        footerText: state.footerText,
        watermark: state.watermark,
        colors: themeColors(state.primary),
        fonts: fontsForTheme(state.fontFamily)
      };
      const pdf = new pdfFromHtml(pdfOptions);

      await pdf.convert(html);
      const blob = await pdf.toBlob();

      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = URL.createObjectURL(blob);
      frame.src = currentUrl + '#view=FitH&toolbar=1';
      hideNoContent();
      downloadBtn.disabled = false;
      printBtn.disabled = false;

      const sizeKB = blob.size < 1024 * 1024
        ? (blob.size / 1024).toFixed(1) + ' KB'
        : (blob.size / 1024 / 1024).toFixed(2) + ' MB';
      setStatus(sizeKB + ' · ' + pdf.pageCount + ' page(s)' + pdf.fontWarning);

      store.set(OPTIONS_KEY, JSON.stringify({
        theme: state.theme,
        fontFamily: state.fontFamily,
        primary: state.primary,
        lineHeight: state.lineHeight,
        paragraphGap: state.paragraphGap,
        justify: state.justify,
        runningHead: state.runningHead,
        fontSize: state.fontSize,
        pageSize: state.pageSize,
        margin: state.margin,
        pageNumbers: state.pageNumbers,
        autoToc: state.autoToc,
        footerText: state.footerText,
        watermark: state.watermark,
        filename: $('filename').value
      }));
    } catch (err) {
      console.error(err);
      setStatus('Error: ' + err.message, true);
    } finally {
      busy = false;
      showOverlay(false);
      if (pending) {
        pending = false;
        generate();
      }
    }
  }

  // Debounce automatic renders: wait until typing/changes stop for 2 seconds.
  function scheduleGenerate() {
    window.clearTimeout(configTimer);
    setStatus('Rendering in 2s…');
    configTimer = window.setTimeout(generate, RENDER_DELAY_MS);
  }

  // Re-check when another tab writes HTML_TO_BE_PRINT, and when this tab
  // becomes visible again (storage events do not fire in the writing tab).
  function checkSource() {
    if (store.get(STORAGE_KEY) !== lastSnapshot) scheduleGenerate();
  }

  // ---------- UI wiring ----------
  $('refreshBtn').addEventListener('click', generate);
  $('retryBtn').addEventListener('click', generate);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      generate();
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!currentUrl) return;
    const name = ($('filename').value || 'document').replace(/\.pdf$/i, '') + '.pdf';
    const a = document.createElement('a');
    a.href = currentUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  printBtn.addEventListener('click', () => {
    if (!currentUrl) return;

    // The iframe holds the PDF viewer. Prefer printing it directly; fall back
    // to a new tab when the embedded viewer does not expose print().
    try {
      const win = frame.contentWindow;
      if (win && typeof win.print === 'function') {
        win.focus();
        win.print();
        return;
      }
    } catch (e) { /* fall through to the popup */ }

    const popup = window.open(currentUrl, '_blank');
    if (!popup) {
      setStatus('Error: allow pop-ups to print this PDF.', true);
      return;
    }
    let done = false;
    const trigger = () => {
      if (done) return;
      done = true;
      try { popup.focus(); popup.print(); } catch (e) { /* browser handled it */ }
    };
    popup.addEventListener('load', trigger, { once: true });
    window.setTimeout(trigger, 1500);
  });

  $('theme').addEventListener('change', () => {
    applyTheme($('theme').value);
    scheduleGenerate();
  });

  ['pageSize', 'pageNumbers', 'autoToc', 'filename', 'footerText', 'watermark'].forEach((id) => {
    $(id).addEventListener('input', scheduleGenerate);
    $(id).addEventListener('change', scheduleGenerate);
  });

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === null) scheduleGenerate();
  });
  window.addEventListener('focus', checkSource);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkSource();
  });

  // ---------- restore ----------
  let savedOptions = {};
  try {
    savedOptions = JSON.parse(store.get(OPTIONS_KEY) || '{}') || {};
  } catch (err) {
    console.warn('Ignoring invalid saved options.', err);
  }
  applyTheme(THEMES[savedOptions.theme] ? savedOptions.theme : 'mint');
  if (savedOptions.pageSize) $('pageSize').value = savedOptions.pageSize;
  if (typeof savedOptions.pageNumbers === 'boolean') $('pageNumbers').checked = savedOptions.pageNumbers;
  if (typeof savedOptions.autoToc === 'boolean') $('autoToc').checked = savedOptions.autoToc;
  if (typeof savedOptions.footerText === 'string') $('footerText').value = savedOptions.footerText;
  if (typeof savedOptions.watermark === 'string') $('watermark').value = savedOptions.watermark;
  if (typeof savedOptions.filename === 'string' && savedOptions.filename) $('filename').value = savedOptions.filename;

  generate();
})();
