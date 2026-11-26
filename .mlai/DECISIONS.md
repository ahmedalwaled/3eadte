# Decisions

## Patient notifications: in-app only for now (2026-11-26)
- Current scope: internal notifications only (`notifications` table, `/notifications` page).
- WhatsApp notifications are deferred to a future phase, not dropped.
- When built: add a sender module called from the same actions that create the in-app notification, store patient consent, use a WhatsApp Business API provider.

## Session cookie `secure` flag follows the request protocol
- `lib/auth.ts` sets `secure` only when `x-forwarded-proto` is `https`.
- Reason: the preview host can serve plain HTTP; a Secure cookie is dropped there and every navigation after login bounced back to `/login`.
