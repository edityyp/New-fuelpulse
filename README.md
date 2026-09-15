# FuelPulse Customer V2

Production customer-facing FuelPulse PWA. This repository is intentionally separate from the legacy `fuelpulse-app` project.

## Production services
- GitHub: `edityyp/New-fuelpulse`
- Supabase: `customer-fuelpulse` / `zdmpcvlmjmsapydaljms` / `ap-south-1`
- Edge Functions: `customer-redeem`, `customer-claim-offer` (JWT required)
- Private Storage: `receipt-images-private` (5 MB; JPEG/PNG/WebP/HEIC)
- Vercel: dedicated Customer V2 project

## Security
The browser uses only the Supabase publishable key. Service-role credentials remain server-side in Supabase Edge Functions. Customer data is isolated with RLS. Receipt verification is authoritative in the database; OCR only assists extraction. Redemption uses a service-role-only atomic database function and idempotency. Receipt images are private and scoped to the authenticated user's UUID.

## Build and test
```bash
npm install
npm run build
npm run typecheck
npm run lint
npm test
```

The build copies the current production root assets (`index.html`, `app.js`, `styles.css`, `manifest.webmanifest`) into `dist/`; no stale `src/` demo assets are used.
