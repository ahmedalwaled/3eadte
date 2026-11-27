# Decisions

## Dev script uses webpack, not Turbopack (2026-11-27)
- `package.json`: `"dev": "next dev --webpack"`.
- Reason: on Next 16.4.6, Turbopack dev mode breaks server actions (POST to a server action returns 500 with `TypeError: Cannot read properties of undefined (reading 'apply')`, action receives empty FormData) while the same code works in `next start` production. Verify server-action bugs against `npm run build && npm start` before blaming app code.

## Patient notifications: in-app only for now (2026-11-26)
- Current scope: internal notifications only (`notifications` table, `/notifications` page).
- WhatsApp notifications are deferred to a future phase, not dropped.
- When built: add a sender module called from the same actions that create the in-app notification, store patient consent, use a WhatsApp Business API provider.

## Session cookie `secure` flag follows the request protocol
- `lib/auth.ts` sets `secure` only when `x-forwarded-proto` is `https`.
- Reason: the preview host can serve plain HTTP; a Secure cookie is dropped there and every navigation after login bounced back to `/login`.

## Patient attachments live in Postgres bytea, not on disk (2026-11-27)
- `attachments.content BYTEA` holds the file; `stored_name` stays for legacy disk rows (read falls back to disk when it is set).
- Reason: Netlify functions have an ephemeral filesystem, so disk uploads vanished between deploys; Supabase Storage keys are not in the Vault (only `$SUPABASE_TOKEN` and `$SUPABASE_DB_PASSWORD`), so bytea needs no new secret and works identically on Netlify and locally.

## Arabic PDFs via pdfkit, font shipped in repo (2026-11-27)
- `lib/pdf.ts` uses pdfkit with `assets/fonts/NotoNaskhArabic.ttf` (committed), included in the Netlify bundle via `outputFileTracingIncludes` in `next.config.ts` — verified working on the live site (deploy `4cab1ee`).
- Verified end to end on https://3eadte.netlify.app: prescription, receipt and statement PDFs return 200 `application/pdf` with correct Arabic content.
