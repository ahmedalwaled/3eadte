# Conventions

## Guards (added after a mistake repeated)
- Fix overflow, clipped text, overlap and low contrast that the browser check reports before calling UI work done.
- Report a test, build or fix as passing only after running it in the same task; quote the command and its result, and write "Not verified:" otherwise.

## Arabic PDF generation with pdfkit (added after debugging)
- Replace every space in the text with two spaces before `doc.text()` (single spaces are dropped at Arabic/Latin segment boundaries in pdfkit).
- Use `align: "right"` only; `left` reverses Arabic word order.
- Do not pass the text through arabic-reshaper or a bidi library: pdfkit shapes and orders Arabic itself, and reshaping produces mirrored text.

## Permission checks go in three places
- A new section must be gated in the nav (`components/AppShell.tsx`), in the page (`requirePerm(user, perm)` from `lib/auth.ts`), and in any API route that returns its data.
- The dashboard hides the cards and lists of sections the user cannot open, so it never shows numbers that the section page would refuse.

## Every Arabic text search folds letters first (2026-11-27)
- `lib/arabic.ts` owns `normalizeArabic()`: أ/إ/آ/ٱ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي, diacritics and tatweel removed.
- SQL must fold the column with `arabicNormSql(column)` and the term with `normalizeArabic()`; never compare a raw column with ILIKE on Arabic text, or "احمد" will miss "أحمد".
- UI highlighting uses `foldWithMap()` so the `<mark>` still lands on the original letters when the query has no hamza.
