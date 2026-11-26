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
# visit http://localhost:8080/LocalPrinter/index.html#<base64>
```

An internet connection is needed on first load for the CDN libraries and the
optional embedded font files. If a CDN is blocked, the page shows an explicit
error instead of staying on the “Building PDF…” spinner.

## Source

Pass the HTML in the URL fragment as UTF-8 base64:

```
http://localhost:8080/LocalPrinter/index.html#PGgxPkhlbGxvPC9oMT4...
```

You can build that URL from the browser console with the helper exposed by `app.js`:

```js
const html = '<h1>Hello</h1>\n<p>Rendered by LocalPrinter.</p>';
location.hash = LPrinterCodec.utf8ToBase64(html);
```

Notes:

- The canonical form is a bare `#<base64>`. `#html=<base64>` is also accepted,
  along with `data`, `content`, `b64`, `base64` and `htmlBase64` keys.
  Older `?html=<base64>` links still work as a fallback.
- The fragment is not sent to the server, so long documents do not trigger a
  GitHub Pages "URI Too Long" error.
- Raw `+` characters are restored if the value was not URL-encoded, URL-safe
  base64 (`-` / `_`) and omitted `=` padding are accepted.
- If the payload is missing, or the value is not valid base64, the preview shows
  **No content found** / an explicit base64 error, and Download/Print are disabled.
- The HTML is sanitized with DOMPurify before rendering.
- The URL is polled every second, so changing it with `history.replaceState()` from
  the console is detected too. **Refresh** (or Ctrl/Cmd+Enter) re-reads it immediately.
- Automatic renders are debounced by 2 seconds: the PDF is rebuilt 2 seconds after
  typing or a configuration change stops. Manual Refresh is immediate.
- Only PDF configuration choices are persisted in `localStorage` (`lprinter:options`);
  the document itself always comes from the URL.

## URL options

PDF configuration can also be passed as query parameters. The HTML payload stays in
the fragment, so the URL looks like:

```
http://localhost:8080/LocalPrinter/index.html?filename=report&theme=navydeck&page_size=A4&page_number=true&toc=true&footer=Confidential&watermark=DRAFT#PGgxPkhlbGxvPC9oMT4...
```

| Parameter | Aliases | Effect |
| --- | --- | --- |
| `filename` | `name` | Download filename (without `.pdf`) |
| `filename_as_header` | `filename_as_h1`, `use_filename_as_header`, `header` | Prepend `<h1>` with the filename (default `true`) |
| `theme` | — | `mint`, `navydeck` (dark navy), `olivedeck` (`#6a5e44`); all share the Mint layout |
| `font` | `font_family`, `google_font`, `googlefont` | Google Font family to use instead of the theme font, e.g. `Inter` |
| `page_size` | `pagesize`, `size` | `A4` or `Letter` |
| `page_number` | `page_numbers`, `pagenumbers` | Show page numbers |
| `toc` | `auto_toc`, `table_of_contents` | Insert a table of contents |
| `toc_index` | `tocindex`, `index_toc`, `toc_numbers` | Number TOC entries and show page indices (default `true`) |
| `footer` | `footer_text`, `footerText` | Footer text on every page |
| `watermark` | — | Faint diagonal watermark |

Booleans accept `true` / `1` / `yes` / `on` and `false` / `0` / `no` / `off`.
`filename_as_header` is not persisted: it starts enabled on every load unless the
current URL disables it, or you uncheck it in the sidebar.
URL-encode text values with `encodeURIComponent()` when they contain spaces or
special characters. Extra `&` separators (e.g. `&&`) are ignored.

URL options override saved configuration when the page loads and whenever the URL
changes. Manual edits in the left panel still apply until the URL changes again.

Very large HTML documents produce very long URLs; some browsers, proxies and web
servers limit URL length. For big documents, prefer a local server over `file://`
and keep the payload reasonably small.

## Controls

- **PDF configuration** (left): filename, **Use filename as header** (on by
  default — prepends an `<h1>` with the filename), theme template (`Mint Deck`,
  `Navy Deck` or `Olive Deck`; all share the same Poppins font, size, spacing
  and layout, with different colours; Olive Deck colours H1-H3 and the
  blockquote bar with `#6a5e44`), **Google Font family** (paste a family
  name or a Google Fonts link to override the theme font), page size,
  page numbers, table of contents, **Index table of contents** (on by default —
  numbers entries `1.`, `1.1.` … with page indices), footer text and watermark.
- **Rendered PDF** (right): live PDF preview built with `pdfFromHtml.js`.
- **Refresh** — rebuild from the current URL payload.
- **Print PDF** — send the rendered PDF to the browser print dialog.
- **Download PDF** — save the exact blob shown in the preview.

## How it works

1. `app.js` reads the base64 value from the URL, decodes it to UTF-8 with
   `atob()` + `TextDecoder`, sanitizes it, and passes it with all options
   (filename, page size, margins, font size, page numbers, colour theme, font URLs)
   to the `pdfFromHtml` class in `pdfFromHtml.js`. With **Use filename as header**
   enabled (the default), an escaped `<h1>` containing the filename is prepended
   before conversion:
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
   font download fails. A custom **Google Font family** fetches its Latin faces
   from Google Fonts and embeds them in place of the theme font (weights that
   share one file are embedded once); if the import fails, the theme font is used
   instead.
4. The resulting `Blob` is shown in the iframe preview, downloaded, or printed.

## Files

- `index.html` — two-panel layout, CDN scripts, classic `<script src="app.js">`
- `app.js` — base64 URL source, codec, configuration state, sanitation and PDF generation
- `pdfFromHtml.js` — standalone HTML → PDF class (also exposes `window.pdfFromHtml`)
- `styles.css` — panel layout, controls, empty state and preview styling
- `bs_extend.css` — shared palette and Bootstrap overrides (unchanged from QPrinter)
