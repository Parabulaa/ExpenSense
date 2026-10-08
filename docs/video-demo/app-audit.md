# Application Audit

## Architecture

ExpenSense is an Expo SDK 57 / React Native 0.86 application using Expo Router's file-based routing. `src/app/` contains thin route modules that re-export screen implementations from `src/screens/` and `src/features/onboarding/`.

The root layout loads five Plus Jakarta Sans weights, blocks the splash until fonts, auth, and theme state are ready, applies a 260ms `simple_push` stack transition, and installs providers for authentication, profile, settings/theme, expenses, finance, receipts, categories, budgets, dashboard category selection, notifications, toasts, and offline synchronization.

Authenticated root panels share one persistent shell (`src/app/(app)/_layout.tsx`) containing:

- one animated organic background;
- a clipped panel viewport;
- horizontal swiping between Home, Transactions, Analytics, and Wallet;
- a persistent floating quick menu;
- a five-item bottom navigation with a raised center Scan action.

Root-panel swipes commit after 24% width or 620 px/s. The camera is deliberately excluded from swipe navigation.

## Dependencies and Confirmed Capabilities

| Area | Implementation |
|---|---|
| Routing | `expo-router ~57.0.22`, typed routes, stack and route groups |
| Camera | `expo-camera ~57.0.5`; rear-camera still capture and torch |
| Gallery | `expo-image-picker ~57.0.19` |
| Image preparation | `expo-image-manipulator ~57.0.19`; JPEG resize/compression under a 950 KB target |
| OCR | Supabase Edge Function `process-receipt`; base64 JPEG request |
| Storage/data | Supabase Auth, Postgres RPCs/tables and private `receipts` storage bucket |
| Motion | `react-native-reanimated 4.5.1`; gesture-handler 2.32 |
| Charts | Custom SVG donut plus React Native bar/progress views; no chart package |
| Offline | AsyncStorage caches and an expense/finance outbox with optimistic application |
| Haptics | `expo-haptics`; selection and warning feedback |
| Fonts | `@expo-google-fonts/plus-jakarta-sans` |
| Icons | MaterialCommunityIcons from `@expo/vector-icons` |

No separate OCR library runs on-device. Receipt recognition is a remote call. The local parser validates structure, rejects likely screenshots, extracts transaction type/merchant/date/items/totals, and builds a confidence/issues model.

## Route Map

Public routes: `/`, `/onboarding`, `/sign-in`, `/create-account`, `/forgot-password`, `/create-new-password`.

Protected root panels: `/home`, `/transactions`, `/analytics`, `/wallet`.

Protected workflow routes: `/add-expense`, `/scanner`, `/processing`, `/receipt-review`, `/recognition-failed`, `/manual-expense`, `/transaction/[id]`, `/transaction/[id]/edit`, `/wallets`, `/wallet-detail/[id]`, `/goals`, `/categories`, `/category/[id]`, `/insights`, `/notifications`, `/profile`, and seven `/settings/*` routes.

`screens.json` holds the full per-route inventory, entry/exit mapping, actions, states, animation notes, and demo classification.

## Functional Assessment

### Receipt path

The receipt flow is functional, not a visual prototype:

1. Camera or gallery sets a real image source.
2. Image is resized/compressed.
3. Edge Function OCR returns text and confidence.
4. Local logic rejects low-resolution images and likely screenshots.
5. Receipt structure and totals are parsed and checked.
6. The user chooses expense, cash-in, or transfer and can edit every important value.
7. `save_receipt_transaction` performs the database write, wallet effect, duplicate check, and receipt metadata save together.
8. The private image is uploaded before the RPC; failed RPC attempts remove the uploaded image.

This is the strongest feature. Its main demo limitation is network/provider timing, not missing implementation.

### Manual entry and offline behavior

Manual expenses validate amounts, merchant, category, local date/time, notes, and wallet selection. Expense create/update/delete operations can queue offline and are applied optimistically. A manually attached photo is not queued; if offline, the expense saves without the photo and the user receives a warning. Receipt OCR/save does not have an offline fallback.

### Ledger

Transactions is a unified ledger across expense, income, cash-in, and transfer records. It supports text search, type/date/category filters, sorting, a monthly spending calendar, grouped rows, details, editing, deletion, and transfer reversion.

### Wallets and budgets

Wallets support multiple types, default selection, add income/cash-in, transfers with optional fee, archive/delete protections, detailed history, and per-wallet analytics. The main Wallet panel also shows total balance, privacy hiding, savings goals, and current/past month category budgets.

### Analytics and intelligence

Analytics is derived from saved records rather than static mock data. It computes monthly totals, category shares, daily totals, average, high-spend day, and month-over-month change. Insight cards are conditionally produced for top category, recurring merchants, unusual spending (only with at least three prior-month expenses), and budget recommendations. Detail sheets provide factual stats and actions.

The Home assistant is local and deterministic. It answers a limited supported set of questions using the selected month's analytics and carries small conversational memory. It should be described as an offline budget assistant, not as a general-purpose AI chatbot.

## UI States

Implemented across relevant screens:

- initial and refresh loading indicators/skeletons;
- empty ledgers, analytics, insights, wallets, goals, budgets, notifications and categories;
- network/load error cards with retries;
- field-level validation and disabled submits;
- success/warning toasts;
- confirmation/error dialogs;
- camera permission fallback and settings link;
- receipt recognition quality/network/provider/not-receipt failures;
- duplicate-receipt handling;
- missing/deleted transaction, wallet and category records;
- queued offline expense indication in provider data;
- light, dark, and system themes;
- reduced-motion paths.

## Visual and Motion Findings

The live product is consistently cream and forest green, with rounded semi-opaque surface cards, light shadows, organic landscape assets, and a friendly pig mascot. Plus Jakarta Sans creates a modern but soft fintech feel. The motion system is restrained at the control level—press scale, fade-slide entry, short stack transitions—but the persistent organic background contains many independently drifting elements. For the demo, retain that native ambiance and avoid adding editor motion on top of every scene.

## Reference Artwork Versus Live Code

The screenshots in `references/` should not be recreated literally. Differences found during audit include:

- Screenshot labels such as `Budget` and some old category names differ from current `Wallet` and category library labels.
- The current dashboard has Week/Month/Year segments, income/budget-left/expense metrics, dynamic current dates, and an offline assistant entry.
- The current transaction filters are consolidated into a filter pill and bottom sheet, with a spending calendar.
- The current analytics card combines income, expense, net total, donut structure, and a separate Trends segment.
- The current receipt review supports expense/cash-in/transfer, wallet selection, editable line items, VAT, and explicit before/after impacts.
- Current processing has six exact steps: Preparing image, Checking image quality, Reading receipt, Checking receipt structure, Extracting details, Checking totals.

Use actual device captures for the video.

## Source Files Audited

- All route modules and layouts under `src/app/`.
- Screen implementations under `src/screens/`.
- Common UI, motion, sheets, calendar, attachments, toast, skeleton, organic background, and screen shell.
- Navigation components.
- Theme, fonts, spacing, radii, shadows, asset registry.
- Auth, expenses, finance, receipts, budgets, categories, analytics, profile, settings, notifications, dashboard, and assistant features.
- Supabase client, offline cache/outbox/sync, formatting and haptics.
- Package/app/EAS/TypeScript/ESLint configuration.
- Supabase migrations and `process-receipt` Edge Function presence.
- Branding, mascot, receipt, scanner, status and organic-shape assets.
- Supplied visual reference PNGs and user guide presence.

## Demo Recommendations (No App Changes Performed)

- Add a dedicated non-production demo seed script or Supabase seed fixture later; the current repo has schema migrations but no one-command deterministic demo seed.
- Consider a development-only receipt provider stub for future repeatable marketing capture. It must be visibly restricted to development and never presented as real OCR output.
- Capture the live UI instead of animating the older reference PNGs.
- If the organic background appears too busy after video compression, reduce it in the editor with a subtle background blur/noise reduction; do not change the app's animation system for the recording.
