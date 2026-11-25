# LPrinter — localStorage HTML → PDF

A browser-only PDF printer. The **left panel** holds the PDF configuration, and the
**right panel** shows the rendered PDF built from HTML stored in
`localStorage.HTML_TO_BE_PRINT`. No editor and no upload — the page only reads that
localStorage key. It is a clone of the QPrinter renderer with the input pane removed.

## Run

Open `index.html` directly in a modern browser — no build step or local server is
required. The scripts are plain classic scripts, so `file://` works.

If you prefer a local server:

```bash
cd LPrinter
python3 -m http.server 8080
# visit http://localhost:8080
```

An internet connection is needed on first load for the CDN libraries and the
optional embedded font files. If a CDN is blocked, the page shows an explicit
error instead of staying on the “Building PDF…” spinner.

Note: `localStorage` is per origin. Set `HTML_TO_BE_PRINT` in the same origin that
serves this page (for example from another tab on `http://localhost:8080`).

## Source

```js
localStorage.setItem('HTML_TO_BE_PRINT', '<h1>Hello</h1><p>Rendered by LPrinter.</p>');
```

- If the key is missing or contains only whitespace, the preview shows
  **No content found** and the Download/Print buttons are disabled.
- The HTML is sanitized with DOMPurify before rendering.
- A `storage` event from another tab rebuilds the preview automatically;
  **Refresh** (or Ctrl/Cmd+Enter) re-reads the key on demand.
- Automatic renders are debounced by 2 seconds: the PDF is rebuilt 2 seconds
  after typing or a configuration change stops. Manual Refresh is immediate.

## Controls

- **PDF configuration** (left): filename, theme template, page size, page numbers,
  table of contents, footer text and watermark.
- **Rendered PDF** (right): live PDF preview built with `pdfFromHtml.js`.
- **Refresh** — rebuild from the current localStorage value.
- **Print PDF** — send the rendered PDF to the browser print dialog.
- **Download PDF** — save the exact blob shown in the preview.

## How it works

1. `app.js` reads `localStorage.HTML_TO_BE_PRINT`, sanitizes it, and passes it with
   all options (filename, page size, margins, font size, page numbers, colour
   theme, font URLs) to the `pdfFromHtml` class in `pdfFromHtml.js`:
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
- `app.js` — localStorage source, configuration state, sanitation and PDF generation
- `pdfFromHtml.js` — standalone HTML → PDF class (also exposes `window.pdfFromHtml`)
- `styles.css` — panel layout, controls, empty state and preview styling
- `bs_extend.css` — shared palette and Bootstrap overrides (unchanged from QPrinter)
