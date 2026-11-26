### LPrinter

URL base64 HTML → PDF

A browser-only PDF printer. The **left panel** holds the PDF configuration, and the
**right panel** shows the rendered PDF built from HTML passed in the page URL as
UTF-8 base64. No editor, no upload, no localStorage for the document — it is a clone
of the QPrinter renderer with the input pane removed.

## Run

Open `index.html` directly in a modern browser — no build step or local server is
required. The scripts are plain classic scripts, so `file://` works.

If you prefer a local server:

```bash
cd LocalPrinter
python3 -m http.server 8080
# visit http://localhost:8080/LocalPrinter/index.html?html=<base64>
```

An internet connection is needed on first load for the CDN libraries and the
optional embedded font files. If a CDN is blocked, the page shows an explicit
error instead of staying on the “Building PDF…” spinner.

## Source

Pass the HTML in the query string as UTF-8 base64:

```
http://localhost:8080/LocalPrinter/index.html?html=PGgxPkhlbGxvPC9oMT4...
```

You can build that URL from the browser console with the helper exposed by `app.js`:

```js
const html = '<h1>Hello</h1>\n<p>Rendered by LocalPrinter.</p>';
location.href = 'index.html?html=' + encodeURIComponent(LPrinterCodec.utf8ToBase64(html));
```

Notes:

- The normal parameter is `html`. `data`, `content`, `b64`, `base64` and
  `htmlBase64` are also accepted (case-insensitive). A bare base64 payload in
  the URL hash (`#<base64>`) works too.
- Raw `+` characters are restored if the query value was not URL-encoded, URL-safe
  base64 (`-` / `_`) and omitted `=` padding are accepted.
- If the parameter is missing, or the value is not valid base64, the preview shows
  **No content found** / an explicit base64 error, and Download/Print are disabled.
- The HTML is sanitized with DOMPurify before rendering.
- The URL is polled every second, so changing it with `history.replaceState()` from
  the console is detected too. **Refresh** (or Ctrl/Cmd+Enter) re-reads it immediately.
- Automatic renders are debounced by 2 seconds: the PDF is rebuilt 2 seconds after
  typing or a configuration change stops. Manual Refresh is immediate.
- Only PDF configuration choices are persisted in `localStorage` (`lprinter:options`);
  the document itself always comes from the URL.

Very large HTML documents produce very long URLs; some browsers, proxies and web
servers limit URL length. For big documents, prefer a local server over `file://`
and keep the payload reasonably small.

## Controls

- **PDF configuration** (left): filename, theme template, page size, page numbers,
  table of contents, footer text and watermark.
- **Rendered PDF** (right): live PDF preview built with `pdfFromHtml.js`.
- **Refresh** — rebuild from the current URL payload.
- **Print PDF** — send the rendered PDF to the browser print dialog.
- **Download PDF** — save the exact blob shown in the preview.

## How it works

1. `app.js` reads the base64 value from the URL, decodes it to UTF-8 with
   `atob()` + `TextDecoder`, sanitizes it, and passes it with all options
   (filename, page size, margins, font size, page numbers, colour theme, font URLs)
   to the `pdfFromHtml` class in `pdfFromHtml.js`:
   ```js
   const pdf = new pdfFromHtml({ name: 'document', colors: {...}, fonts: {...} });
   await pdf.convert(html);
   const blob = await pdf.toBlob();
   ```
2. `pdfFromHtml.js` parses the HTML into blocks (headings, paragraphs, lists,
   quotes, code, tables, images, page breaks, sub/sup, inline and display math)
   and lays it out with `pdf-lib` — real, selectable text and vector shapes.
3. Theme presets define the base font family, size, primary colour, spacing and
   margin. Fonts are subset and embedded; built-in standard fonts are used if a
   font download fails.
4. The resulting `Blob` is shown in the iframe preview, downloaded, or printed.

## Files

- `index.html` — two-panel layout, CDN scripts, classic `<script src="app.js">`
- `app.js` — base64 URL source, codec, configuration state, sanitation and PDF generation
- `pdfFromHtml.js` — standalone HTML → PDF class (also exposes `window.pdfFromHtml`)
- `styles.css` — panel layout, controls, empty state and preview styling
- `bs_extend.css` — shared palette and Bootstrap overrides (unchanged from QPrinter)
