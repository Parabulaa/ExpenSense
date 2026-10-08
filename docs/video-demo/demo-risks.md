# Demo Risks

## Missing environment variables

**Risk:** The app throws during module initialization if either public Supabase variable is missing.  
**Location:** `src/lib/supabase.ts` lines 7–12.  
**Severity:** Critical.  
**Demo impact:** App does not launch.  
**Workaround:** Verify `.env` is loaded before the recording build; perform a cold launch.  
**Actual fix:** Add a development configuration screen or build-time validation with a clear setup error.

## Auth initialization or session expiry

**Risk:** Root navigation waits for session initialization; expired/absent sessions redirect protected routes to onboarding.  
**Location:** `src/app/_layout.tsx` lines 103–146; `src/features/auth/hooks/useAuthGuard.ts`.  
**Severity:** High.  
**Demo impact:** Blank launch wait or unexpected onboarding.  
**Workaround:** Sign in immediately before recording and verify `/home` after a cold start.  
**Actual fix:** No product defect is established; add a recording preflight command/checklist.

## OCR/network/provider variability

**Risk:** Receipt recognition calls a remote Supabase Edge Function and OCR provider.  
**Location:** `src/features/receipts/receipt-service.ts` lines 30–53; `ReceiptProvider.tsx`.  
**Severity:** Critical.  
**Demo impact:** Long processing, provider error, quota failure, or recognition-failed route.  
**Workaround:** Preflight the exact printed receipt twice, verify quota/secrets, use stable Wi-Fi, and record a disclosed manual-entry fallback.  
**Actual fix:** Add retry/backoff and a development-only deterministic fixture mode for capture work.

## Screenshot rejection

**Risk:** The parser deliberately rejects likely receipt screenshots.  
**Location:** `src/features/receipts/ReceiptProvider.tsx`, `isLikelyReceiptScreenshot`.  
**Severity:** High.  
**Demo impact:** A convenient screen-displayed sample image may route to failure.  
**Workaround:** Print the receipt and photograph the physical original.  
**Actual fix:** None recommended unless product requirements change; this is intentional behavior.

## Image quality threshold

**Risk:** Images with either optimized dimension below 500 px fail quality checks.  
**Location:** `src/features/receipts/ReceiptProvider.tsx`.  
**Severity:** High.  
**Demo impact:** Recognition failure before OCR.  
**Workaround:** Use a modern rear camera, fill the frame, keep focus sharp, and avoid digital zoom.  
**Actual fix:** Provide live framing/blur guidance before capture.

## Camera and gallery permission prompts

**Risk:** First use can display system permission UI; denial routes to a permission screen or silently cancels gallery selection.  
**Location:** `src/screens/expense-screens.tsx` lines 52–57 and 295–303.  
**Severity:** High.  
**Demo impact:** Breaks visual continuity and may expose device chrome.  
**Workaround:** Grant both permissions before recording.  
**Actual fix:** Add more explicit in-app feedback when gallery permission is denied.

## Duplicate receipt protection

**Risk:** A previously saved fingerprint is rejected and the wallet is not changed again.  
**Location:** `src/features/receipts/receipt-service.ts`, `DUPLICATE_MESSAGE`.  
**Severity:** High.  
**Demo impact:** Final save fails during repeated takes.  
**Workaround:** Reset the demo database/storage between takes or change a legitimate receipt reference; never bypass duplication in production.  
**Actual fix:** Create a safe demo reset/seed workflow.

## Storage upload or atomic RPC failure

**Risk:** Receipt save requires both a private storage upload and `save_receipt_transaction`; RPC failure removes the uploaded image.  
**Location:** `src/features/receipts/receipt-service.ts` lines 66–118.  
**Severity:** High.  
**Demo impact:** Save CTA returns a warning instead of Transactions.  
**Workaround:** Verify bucket policy, RPC migration, authentication, and connectivity before the take.  
**Actual fix:** Add richer retry diagnostics and telemetry without exposing sensitive backend errors to users.

## Processing duration is not fixed

**Risk:** The processing screen is bound to real optimization, upload, OCR, and parsing time.  
**Location:** `src/screens/expense-screens.tsx` lines 306–312.  
**Severity:** Medium.  
**Demo impact:** A one-take recording can exceed 60 seconds or stall on one step.  
**Workaround:** Record uncut for truth, then trim idle frames while retaining the actual step order.  
**Actual fix:** Show a real progress timeout/retry affordance if production telemetry supports a threshold.

## Seed dates must match the recording month

**Risk:** Home and analytics derive the current month from the device date; old reference dates produce empty states.  
**Location:** `home-screen.tsx`, `main-screens.tsx`, analytics helpers.  
**Severity:** High.  
**Demo impact:** Totals, donut, insights, and budget cards do not match the script.  
**Workaround:** Seed September 2026 data for the stated recording date, or regenerate every documented date for the actual recording month.  
**Actual fix:** Build a relative-date demo seeder.

## Insights are conditional

**Risk:** Recurring requires duplicate normalized merchant names; unusual spending requires at least three previous-month expenses; recommendations depend on budget presence.  
**Location:** `src/features/analytics/analytics.ts` lines 72–121.  
**Severity:** Medium.  
**Demo impact:** Expected insight cards may not appear.  
**Workaround:** Use `demo-data.json` exactly and verify cards before recording.  
**Actual fix:** Include an automated seed assertion for expected insights.

## Reference screenshots are stale relative to code

**Risk:** Recreating reference PNGs can introduce outdated tab names, layouts, totals, and receipt states.  
**Location:** `references/` compared with current `src/screens/` and navigation code.  
**Severity:** Medium.  
**Demo impact:** Video misrepresents the shipping app.  
**Workaround:** Capture the running application; use references only for mood.  
**Actual fix:** Regenerate reference images from the current build or label them by version.

## Long scrollable review screen

**Risk:** Receipt review contains more fields than fit on one phone frame.  
**Location:** `src/screens/expense-screens.tsx` lines 407–450.  
**Severity:** Medium.  
**Demo impact:** Rushed or jerky scrolling; CTA may be below the fold.  
**Workaround:** Use two deliberate scroll positions and edit between them; return to 100% scale before tapping save.  
**Actual fix:** No redesign is recommended for this task.

## Root tab gestures and vertical scrolling can conflict in a hurried take

**Risk:** Horizontal panel navigation activates after a clear horizontal movement; diagonal swipes may fail or navigate.  
**Location:** `src/app/(app)/_layout.tsx` lines 69–153.  
**Severity:** Low.  
**Demo impact:** Accidental tab change.  
**Workaround:** Make scroll gestures decisively vertical, or use bottom tabs for deterministic navigation.  
**Actual fix:** Current thresholds already mitigate the issue.

## Organic background compression shimmer

**Risk:** Many independently drifting translucent shapes can shimmer after aggressive social-video compression.  
**Location:** `src/components/common/organic-background.tsx`; `motion.tsx`.  
**Severity:** Low.  
**Demo impact:** Background looks noisy at low bitrates.  
**Workaround:** Record at high bitrate, export with adequate bitrate, and avoid extra editor sharpening.  
**Actual fix:** Only if field evidence warrants it, simplify or slow specific decorative layers in a future product change.

## Manual attachments are not queued offline

**Risk:** A manual expense can save offline, but its photo is skipped with a warning. Receipt OCR/save is fully online-only.  
**Location:** `src/screens/expense-screens.tsx` lines 136–159; attachment and receipt services.  
**Severity:** Low for the primary online demo.  
**Demo impact:** An offline fallback take may lose the photo.  
**Workaround:** Stay online or omit the optional attachment in manual fallback.  
**Actual fix:** Add an attachment outbox if offline photo persistence becomes a requirement.

## Development/runtime overlays

**Risk:** Metro, Expo, React warnings, or a dev menu can cover the UI.  
**Location:** Development environment rather than a specific screen.  
**Severity:** Medium.  
**Demo impact:** Unprofessional footage.  
**Workaround:** Use a preview/release build, run lint first, and do a clean cold launch.  
**Actual fix:** Maintain a repeatable EAS preview build profile for demos.

## Validation result

`cmd /c npm run lint` completed successfully with no reported lint errors on 2026-09-29. This reduces—but does not eliminate—runtime risk. No end-to-end backend or device-camera test was performed by this documentation task.
