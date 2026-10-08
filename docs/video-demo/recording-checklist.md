# Recording Checklist

## Account and Data

- [ ] Use a dedicated non-personal Supabase account: `demo.expensense@example.com`.
- [ ] Verify the account email in advance and sign in before recording.
- [ ] Confirm the session will not expire during the recording window.
- [ ] Seed exactly the records in `demo-data.json`; use September 2026 as the selected/current demo month.
- [ ] Confirm Home shows `Mika`, PHP 1,800.00 spent before capture, and the expected budgets.
- [ ] Confirm Daily Wallet is PHP 12,500.00 and Savings is PHP 20,000.00 before capture.
- [ ] Confirm Transactions is set to Newest with all filters/search cleared.
- [ ] Confirm balances are visible on Wallet.
- [ ] Remove any earlier Coffee Project PHP 372.00 receipt and its stored image to avoid duplicate detection.

## Receipt and OCR

- [ ] Print a physical receipt containing Coffee Project, 2026-09-29 14:30, the three documented items, subtotal PHP 330.00, tax PHP 42.00, and total PHP 372.00.
- [ ] Do not scan a screenshot; the implementation rejects likely screenshots.
- [ ] Use high contrast, flat paper, even light, and a full unobstructed receipt.
- [ ] Preflight the exact receipt and camera/device at least twice before the final take.
- [ ] Verify the Supabase `process-receipt` function is deployed and its OCR provider secret/quota is valid.
- [ ] Verify the `receipts` storage bucket and `save_receipt_transaction` RPC are present.
- [ ] Confirm recognition produces usable merchant, date, items, and total. Do not require an exact confidence percentage.

## Permissions and Device

- [ ] Grant camera and photo-library permissions before capture; never show the permission dialog in the hero cut.
- [ ] Disable notifications, calls, screen-dimming, rotation lock changes, battery-saver prompts, and OS overlays.
- [ ] Lock portrait orientation (the app is configured portrait-only).
- [ ] Set light theme and do not switch theme mid-video.
- [ ] Use a device/emulator width that keeps the app below its 480px canvas maximum.
- [ ] Use a stable status-bar time if the capture method allows it; otherwise crop consistently.
- [ ] Keep keyboard autocorrect/personal suggestions from displaying private text.
- [ ] Ensure enough free storage for high-bitrate recording.

## Network and Backend

- [ ] Use stable low-latency Wi-Fi; disable VPN handoffs and mobile/Wi-Fi switching.
- [ ] Run one signed-in read and one disposable OCR call shortly before filming.
- [ ] Confirm no Supabase migration, storage, RLS, quota, or Edge Function deployment is pending.
- [ ] Keep the app foregrounded during processing, as the UI instructs.
- [ ] Do not rely on offline mode for the receipt path; only manual expense writes queue offline.

## App State and Motion

- [ ] Cold-open once so fonts/assets are cached, then return to Home.
- [ ] Allow Home entry and progress animations to settle before the first take.
- [ ] Keep OS Reduce Motion off for the main capture; record a reduced-motion variant only if required for accessibility deliverables.
- [ ] Start every root-panel take from a known tab; root-tab navigation uses replace and directional transitions.
- [ ] Close the radial quick menu and every sheet/dialog before each scene.
- [ ] Use one smooth scroll per long screen; avoid small corrective swipes.
- [ ] Record a clean Home-before and Home-after state.

## Capture Takes

- [ ] Take A: Home opening and Scan-sheet open.
- [ ] Take B: Scanner with receipt and capture.
- [ ] Take C: complete uncut processing state for truth/reference.
- [ ] Take D: receipt review from top through `After you confirm`, then save.
- [ ] Take E: success toast plus newest Transactions row.
- [ ] Take F: Wallet total, Daily Wallet and Food budget.
- [ ] Take G: Analytics donut and Spending Insights.
- [ ] Take H: updated Home ending.
- [ ] Capture 2 seconds of handles before and after every take.
- [ ] Record an alternate manual-entry path in case OCR fails during the production session.

## Post-Capture Verification

- [ ] Coffee Project appears once as PHP 372.00 and shows receipt/verified source.
- [ ] Current-month spending is PHP 2,172.00.
- [ ] Food spending is PHP 887.00; Food budget left is PHP 613.00.
- [ ] Daily Wallet is PHP 12,128.00; combined wallet balance is PHP 32,128.00.
- [ ] Analytics total equals PHP 2,172.00 and Food is the top slice.
- [ ] Insights include Top Category and one recurring merchant (Coffee Project).
- [ ] No personal emails, push banners, dev menus, Metro overlays, warnings, or console artifacts appear.
- [ ] The final edit is at most 60 seconds and narration aligns with visible actions.
