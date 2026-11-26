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
    }
  };

  // Every preset is an exact Mint Deck clone (same Poppins font, size, spacing
  // and margins) with its own palette. Presets with colouredHeadings also tint
  // H1-H3 and the blockquote bar with their palette colour.
  const THEMES = {
    mint: {
      label: 'Mint Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#0f766e', justify: false, runningHead: true
    },
    navydeck: {
      label: 'Navy Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#0b2545', justify: false, runningHead: true
    },
    olivedeck: {
      label: 'Olive Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#6a5e44', justify: false, runningHead: true, coloredHeadings: true
    },
    pinkdeck: {
      label: 'Pink Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#be185d', justify: false, runningHead: true, coloredHeadings: true
    },
    violetdeck: {
      label: 'Violet Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#6d28d9', justify: false, runningHead: true, coloredHeadings: true
    },
    indigodeck: {
      label: 'Indigo Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#4338ca', justify: false, runningHead: true, coloredHeadings: true
    },
    tealdeck: {
      label: 'Teal Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#115e59', justify: false, runningHead: true, coloredHeadings: true
    },
    lightgraydeck: {
      label: 'Light Gray Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#6b7280', justify: false, runningHead: true, coloredHeadings: true
    },
    lightblackdeck: {
      label: 'Light Black Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#27272a', justify: false, runningHead: true, coloredHeadings: true
    }
  };

  function fontsForTheme(fontFamily) {
    return Object.assign({}, COMMON_FONTS, BASE_FONTS[fontFamily] || BASE_FONTS.sans);
  }

  // Accept either a family name ("Inter", "Roboto Slab") or a link copied from
  // Google Fonts. The CSS2 API accepts the plain family name, so strip links
  // and any weight/subset suffix before requesting the font faces.
  function normalizeGoogleFont(value) {
    let family = String(value || '').trim().replace(/^['"]|['"]$/g, '');
    if (!family) return '';
    try {
      const url = new URL(family);
      if (/(^|\.)fonts\.google(apis)?\.com$/.test(url.hostname)) {
        family = url.searchParams.get('family') ||
          decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
      }
    } catch (e) { /* not a URL: treat the input as a family name */ }
    return family.split(':')[0].replace(/\+/g, ' ').trim();
  }

  // Google's CSS groups faces by unicode subset. PDFs use the latin subset;
  // other scripts remain available through COMMON_FONTS (Bengali, Devanagari).
  function parseGoogleFontCss(css) {
    const faces = {};
    const block = /\/\*\s*([^*]+?)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;
    let m;
    while ((m = block.exec(css))) {
      const subset = m[1].trim();
      const body = m[2];
      const range = (/unicode-range:\s*([^;]+)/i.exec(body) || [])[1] || '';
      if (subset !== 'latin' && !/U\+0000-00FF/i.test(range)) continue;
      const style = (/font-style:\s*([^;]+)/i.exec(body) || [])[1] || 'normal';
      const weight = (/font-weight:\s*([^;]+)/i.exec(body) || [])[1] || '400';
      const src = (/url\(([^)]+)\)/i.exec(body) || [])[1];
      if (!src) continue;
      if (style.trim() === 'italic') {
        if (weight.trim() === '400') faces.customItalic = src;
        else faces.customBoldItalic = src;
      } else {
        if (weight.trim() === '400') faces.custom = src;
        else faces.customBold = src;
      }
    }
    return faces;
  }

  const googleFontUrlCache = new Map();

  // Cache only the resolved URLs. Font bytes are fetched fresh per render so
  // one failed PDF attempt can never poison a later render.
  async function googleFontUrls(family) {
    const name = normalizeGoogleFont(family);
    if (!name) throw new Error('empty font family');
    const cacheKey = name.toLowerCase();
    if (googleFontUrlCache.has(cacheKey)) return googleFontUrlCache.get(cacheKey);

    const loading = (async () => {
      const cssUrl = 'https://fonts.googleapis.com/css2?family=' +
        encodeURIComponent(name).replace(/%20/g, '+') +
        ':ital,wght@0,400;0,700;1,400;1,700&display=swap';
      const res = await fetch(cssUrl);
      if (!res.ok) throw new Error('font list request failed');
      const faces = parseGoogleFontCss(await res.text());
      if (!faces.custom) throw new Error('no latin font face was returned');
      // Fonts without dedicated italic/bold cuts still render: reuse the
      // closest available face instead of failing the whole document.
      faces.customItalic = faces.customItalic || faces.custom;
      faces.customBold = faces.customBold || faces.custom;
      faces.customBoldItalic = faces.customBoldItalic || faces.customItalic || faces.custom;
      return faces;
    })();

    googleFontUrlCache.set(cacheKey, loading);
    loading.catch(() => googleFontUrlCache.delete(cacheKey));
    return loading;
  }

  async function loadGoogleFont(family) {
    const faces = await googleFontUrls(family);
    // Variable Google fonts often use one file for 400 and 700. Embed each
    // distinct face once; fontFor() falls back to the regular face for any
    // style we did not embed.
    const keys = ['custom', 'customItalic', 'customBold', 'customBoldItalic'];
    const seen = new Set();
    const fonts = {};
    for (const key of keys) {
      const url = faces[key];
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const fontRes = await fetch(url);
      if (!fontRes.ok) throw new Error('font download failed');
      fonts[key] = await fontRes.arrayBuffer();
    }
    return fonts;
  }

  function mix(a, b, t) {
    const ca = String(a).replace('#', '');
    const cb = String(b).replace('#', '');
    const part = (i) => Math.round(
      parseInt(ca.substr(i, 2), 16) * (1 - t) + parseInt(cb.substr(i, 2), 16) * t
    ).toString(16).padStart(2, '0');
    return '#' + part(0) + part(2) + part(4);
  }

  // Links are the same GitHub-style light blue in every theme; the font and all
  // other typography stay exactly as they are.
  const LINK_COLOR = '#58a6ff';

  // Tint the neutral white/light-gray surfaces with the theme's primary colour.
  // Tables use a darkened shade of the theme colour for the header and light borders on white rows.
  function themeColors(primary, themeKey) {
    const p = /^#[0-9a-f]{6}$/i.test(primary || '') ? primary : THEMES.mint.primary;
    // Presets marked colouredHeadings tint H1-H3 with their palette colour;
    // Mint and Navy keep the neutral heading colour. The quote bar always
    // follows the active theme colour.
    const colorHeadings = !!(THEMES[themeKey] && THEMES[themeKey].coloredHeadings);
    return {
      background: '#ffffff',
      surface: mix(p, '#ffffff', 0.94),
      surfaceAlt: mix(p, '#ffffff', 0.88),
      text: '#1f2328',
      heading: '#1f2328',
      headingEmphasis: colorHeadings ? p : '#1f2328',
      muted: '#656d76',
      accent: p,
      quoteBar: p,
      border: mix(p, '#ffffff', 0.78),
      link: LINK_COLOR,
      quoteText: '#3a4048',
      codeBg: '#f3f6f9',
      codeBorder: '#d8dee4',
      codeFg: '#2b3440',
      inlineCodeFg: '#db2777',
      mark: mix(p, '#ffffff', 0.84),
      tableHeaderBg: mix(p, '#000000', 0.35),
      tableHeaderText: '#ffffff',
      tableRowBg: '#ffffff',
      tableStripeBg: mix(p, '#ffffff', 0.965),
      tableBorder: '#c6cacf',
      tableRowBorder: '#e3e7ec'
    };
  }

  const OPTIONS_KEY = 'lprinter:options';
  const RENDER_DELAY_MS = 2000;
  const POLL_INTERVAL_MS = 1000;
  // The HTML is passed as base64 in the URL fragment, e.g. #<base64>.
  // ?html=<base64> links are still accepted as a fallback.
  const URL_KEYS = ['html', 'data', 'content', 'b64', 'base64', 'htmlbase64'];

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
    googleFont: '',
    primary: THEMES.mint.primary,
    lineHeight: THEMES.mint.lineHeight,
    paragraphGap: THEMES.mint.paragraphGap,
    justify: THEMES.mint.justify,
    runningHead: THEMES.mint.runningHead,
    fontSize: THEMES.mint.fontSize,
    pageSize: 'A4',
    margin: THEMES.mint.margin,
    filenameAsHeader: true,
    pageNumbers: true,
    autoToc: false,
    tocIndex: true,
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

  // ---------- base64 codec (UTF-8 safe) ----------
  function utf8ToBase64(str) {
    const utf8Bytes = new TextEncoder().encode(String(str));
    let binaryString = '';
    const chunkSize = 0x8000; // Process chunks of 32KB to avoid memory issues
    for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
      const chunk = utf8Bytes.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binaryString);
  }

  function base64ToUtf8(str) {
    const binaryString = atob(str);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  // Expose the codec so a URL can also be built from the browser console:
  // LPrinterCodec.utf8ToBase64('<h1>Hi</h1>')
  window.LPrinterCodec = { utf8ToBase64: utf8ToBase64, base64ToUtf8: base64ToUtf8 };

  // ---------- source from URL ----------
  const SANITIZE_CONFIG = {
    ADD_ATTR: ['align', 'style', 'type', 'checked', 'disabled'],
    ADD_DATA_URI_TAGS: ['img']
  };

  let sourceProblem = '';

  function normalizeBase64(value) {
    // URLSearchParams turns a raw "+" into a space. Base64 never contains a
    // space, so restore it; also accept URL-safe base64 and missing padding.
    let s = String(value || '').replace(/ /g, '+').replace(/[\r\n\t]+/g, '');
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return s;
  }

  function base64FromLocation() {
    const fragment = location.hash.replace(/^#/, '');
    if (fragment) {
      // Also allow #html=<base64> (and the aliases) inside the fragment.
      if (/^\s*(?:html|data|content|b64|base64|htmlbase64)\s*=/i.test(fragment)) {
        const hashParams = new URLSearchParams(fragment);
        for (const [key, value] of hashParams.entries()) {
          if (URL_KEYS.indexOf(key.toLowerCase()) >= 0 && value) return value;
        }
      }
      // Canonical form: the fragment itself is the base64 payload.
      if (/^[A-Za-z0-9+/\-_=\s]+$/.test(fragment)) return fragment;
    }
    // Backwards-compatible fallback for older ?html=<base64> links.
    const params = new URLSearchParams(location.search);
    for (const [key, value] of params.entries()) {
      if (URL_KEYS.indexOf(key.toLowerCase()) >= 0 && value) return value;
    }
    return '';
  }

  function readSource() {
    lastSnapshot = location.href;
    sourceProblem = '';
    const payload = base64FromLocation();
    if (!payload) return '';

    let html;
    try {
      html = base64ToUtf8(normalizeBase64(payload));
    } catch (err) {
      sourceProblem = 'invalid';
      return '';
    }
    if (!html.trim()) return '';

    const clean = DOMPurify.sanitize(html, SANITIZE_CONFIG);
    // Markup made only of comments/styles sanitizes to nothing — treat it
    // the same as a missing payload instead of rendering a blank document.
    return clean.trim() ? clean : '';
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
    $('sourceOrigin').textContent = 'Looking in: ' + location.href;
    if (sourceProblem === 'invalid') {
      setStatus('Error: invalid base64 in URL. Use #<base64>.', true);
    } else {
      setStatus('No HTML content found in URL. Use #<base64>.');
    }
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
      state.tocIndex = $('tocIndex').checked;
      state.footerText = $('footerText').value.trim();
      state.watermark = $('watermark').value.trim();
      state.filenameAsHeader = $('filenameHeader').checked;
      state.googleFont = $('googleFont').value.trim();

      // Optionally use the filename as the document's first heading. Escape
      // it through textContent so names like "a <b>" stay literal text.
      let sourceHtml = html;
      const documentName = ($('filename').value || '').trim();
      if (state.filenameAsHeader && documentName) {
        const holder = document.createElement('div');
        holder.textContent = documentName;
        sourceHtml = '<h1>' + holder.innerHTML + '</h1>' + sourceHtml;
      }

      // A custom Google Font overrides the theme family. If it cannot be
      // fetched, keep rendering with the theme font and say so in the status.
      let renderFontFamily = state.fontFamily;
      let fonts = fontsForTheme(renderFontFamily);
      let fontWarning = '';
      if (state.googleFont) {
        try {
          fonts = Object.assign(fonts, await loadGoogleFont(state.googleFont));
          renderFontFamily = 'custom';
        } catch (err) {
          console.warn('Google Font import failed; using theme font.', err);
          fontWarning = ' (Google Font unavailable; using theme font)';
        }
      }

      // Everything about the output is passed in as options — no layout code
      // remains in this file.
      const pdfOptions = {
        name: documentName || 'document',
        pageSize: state.pageSize,
        margin: MARGINS[state.margin] || MARGINS.normal,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        paragraphGap: state.paragraphGap,
        justify: state.justify,
        runningHead: state.runningHead,
        fontFamily: renderFontFamily,
        pageNumbers: state.pageNumbers,
        autoToc: state.autoToc,
        tocIndex: state.tocIndex,
        footerText: state.footerText,
        watermark: state.watermark,
        colors: themeColors(state.primary, state.theme),
        fonts: fonts
      };
      const pdf = new pdfFromHtml(pdfOptions);

      await pdf.convert(sourceHtml);
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
      setStatus(sizeKB + ' · ' + pdf.pageCount + ' page(s)' + fontWarning + pdf.fontWarning);

      store.set(OPTIONS_KEY, JSON.stringify({
        theme: state.theme,
        fontFamily: state.fontFamily,
        googleFont: state.googleFont,
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
        tocIndex: state.tocIndex,
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

  // ---------- options from URL query parameters ----------
  // The HTML stays in the fragment; these control the PDF configuration.
  // Example: ?filename=report&theme=navydeck&toc=true&page_number=false
  //          &footer=Confidential&watermark=DRAFT#<base64>
  function paramValue(params, names) {
    for (const name of names) {
      if (params.has(name)) return params.get(name);
    }
    return null;
  }

  function parseBool(value, fallback) {
    if (value === null) return fallback;
    const v = value.trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
    if (v === '0' || v === 'false' || v === 'no' || v === 'off' || v === '') return false;
    return fallback;
  }

  function applyUrlOptions() {
    const params = new URLSearchParams(location.search);

    const filename = paramValue(params, ['filename', 'name']);
    if (filename !== null && filename.trim()) $('filename').value = filename.trim();

    const asHeader = parseBool(
      paramValue(params, ['filename_as_header', 'filename_as_h1', 'use_filename_as_header', 'header']),
      $('filenameHeader').checked
    );
    $('filenameHeader').checked = asHeader;

    const theme = paramValue(params, ['theme']);
    if (theme && THEMES[theme.trim().toLowerCase()]) applyTheme(theme.trim().toLowerCase());

    const font = paramValue(params, ['font', 'font_family', 'fontfamily', 'google_font', 'googlefont']);
    if (font !== null) $('googleFont').value = font;

    const pageSize = paramValue(params, ['page_size', 'pagesize', 'size']);
    if (pageSize) {
      const v = pageSize.trim().toLowerCase();
      if (v === 'a4') $('pageSize').value = 'A4';
      else if (v === 'letter') $('pageSize').value = 'Letter';
    }

    const numbers = parseBool(
      paramValue(params, ['page_number', 'page_numbers', 'pagenumber', 'pagenumbers']),
      $('pageNumbers').checked
    );
    $('pageNumbers').checked = numbers;

    const toc = parseBool(
      paramValue(params, ['toc', 'auto_toc', 'autotoc', 'table_of_contents']),
      $('autoToc').checked
    );
    $('autoToc').checked = toc;

    const tocIndex = parseBool(
      paramValue(params, ['toc_index', 'tocindex', 'index_toc', 'indextoc', 'toc_numbers', 'tocnumber']),
      $('tocIndex').checked
    );
    $('tocIndex').checked = tocIndex;

    const footer = paramValue(params, ['footer', 'footer_text', 'footertext']);
    if (footer !== null) $('footerText').value = footer;

    const watermark = paramValue(params, ['watermark']);
    if (watermark !== null) $('watermark').value = watermark;
  }

  // Re-check the URL periodically. A history.replaceState() or hash change
  // made from the console does not always fire an event, and the snapshot
  // guard prevents repeated polls from resetting the debounce timer.
  function checkSource() {
    if (location.href === lastSnapshot) return;
    lastSnapshot = location.href;
    applyUrlOptions();
    scheduleGenerate();
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

  ['pageSize', 'pageNumbers', 'autoToc', 'tocIndex', 'googleFont', 'filename', 'filenameHeader', 'footerText', 'watermark'].forEach((id) => {
    $(id).addEventListener('input', scheduleGenerate);
    $(id).addEventListener('change', scheduleGenerate);
  });

  window.addEventListener('popstate', checkSource);
  window.addEventListener('hashchange', checkSource);
  window.addEventListener('focus', checkSource);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkSource();
  });
  window.setInterval(checkSource, POLL_INTERVAL_MS);

  // ---------- restore ----------
  let savedOptions = {};
  try {
    savedOptions = JSON.parse(store.get(OPTIONS_KEY) || '{}') || {};
  } catch (err) {
    console.warn('Ignoring invalid saved options.', err);
  }
  applyTheme(THEMES[savedOptions.theme] ? savedOptions.theme : 'mint');
  if (typeof savedOptions.googleFont === 'string') $('googleFont').value = savedOptions.googleFont;
  if (savedOptions.pageSize) $('pageSize').value = savedOptions.pageSize;
  if (typeof savedOptions.pageNumbers === 'boolean') $('pageNumbers').checked = savedOptions.pageNumbers;
  if (typeof savedOptions.autoToc === 'boolean') $('autoToc').checked = savedOptions.autoToc;
  if (typeof savedOptions.tocIndex === 'boolean') $('tocIndex').checked = savedOptions.tocIndex;
  if (typeof savedOptions.footerText === 'string') $('footerText').value = savedOptions.footerText;
  if (typeof savedOptions.watermark === 'string') $('watermark').value = savedOptions.watermark;
  if (typeof savedOptions.filename === 'string' && savedOptions.filename) $('filename').value = savedOptions.filename;

  // URL parameters override saved configuration; the document itself comes
  // from the fragment.
  applyUrlOptions();

  generate();
})();
