# ExpenSense 1-Minute Demo Package

This folder is a source-traced recording and editing specification for the current ExpenSense implementation. The recommended cut is 58 seconds, uses nine short scenes, and follows one receipt from capture to a verified transaction, wallet/budget impact, and analytics.

The application code—not the PNGs in `references/`—is the source of truth. Those images are useful mood and composition references, but some are older than the live implementation. In particular, the current fifth root tab is **Wallet**, the active shell has five tabs with a raised **Scan** action, and the current receipt-review screen includes transaction type, wallet, item editing, and a before/after impact preview.

## Deliverables

- `app-audit.md`: architecture, routes, dependencies, state handling, and findings.
- `brand-system.json`: exact tokens, typography, navigation, components, and motion.
- `screens.json`: route-by-route inventory with readiness classification.
- `features.json`: confirmed product features and demo priority.
- `demo-flow.json`: narrative, opening, ending, fallback, and exclusions.
- `demo-timeline.json`: 58-second edit plan.
- `interaction-script.json`: deterministic recording actions.
- `demo-data.json`: mathematically consistent demo seed.
- `camera-plan.json`: stable framing and restrained zooms.
- `captions.json`: timed on-screen benefit copy.
- `voiceover.md`: 115-word narration.
- `recording-checklist.md`: preparation and take procedure.
- `demo-risks.md`: recording failure modes, workarounds, and real fixes.
- `video-style-guide.md`: edit, audio, export, and framing guidance.

## Feature Priority Matrix

### MUST SHOW

- **Home Dashboard** — immediately explains the product through spending, budgets, categories, and the mascot insight.
- **Receipt capture** — the most differentiated, visually legible action in the app.
- **Receipt processing** — demonstrates real image preparation, OCR, structural checks, parsing, and total checks. Shorten only in editing.
- **Receipt review and impact preview** — proves that recognition is user-verified and shows what changes before save.
- **New transaction result** — establishes that the flow creates a real ledger record rather than a visual mock.
- **Analytics/Insights** — delivers the promised understanding after data capture.

### SHOULD SHOW

- **Add Expense sheet** — communicates camera, gallery, and manual paths in one shot.
- **Wallet/budget result** — connects the transaction to a real balance and category limit.
- **Updated closing dashboard** — completes the action-to-overview loop.

### OPTIONAL

- **Transaction detail** — adds a `Verified` source proof if the edit has one spare second.
- **Offline budget assistant** — genuinely works from local selected-month data, but creates a second intelligence story.
- **Manual expense entry** — use as the disclosed fallback if OCR cannot be stabilized.
- **Onboarding** — accurate brand introduction, but too expensive in a one-minute signed-in walkthrough.

### DO NOT SHOW

- **Recognition Failed** in the main cut — complete and honest recovery UI, but it interrupts the hero narrative.
- **Authentication, password reset, and verification** — mature flows, but they expose credentials and depend on email/network timing.
- **Destructive delete/archive/revert dialogs** — useful controls with no promotional value.
- **Empty, loading-error, expired-session, or permission-request states** — record them only for documentation, not the hero cut.
- **Settings, privacy, FAQ, appearance, category editing, wallet editing, and savings-goal forms** — all are usable, but repetitive or outside the receipt-to-insight story.
- **Reference-only layouts** — do not present labels or arrangements that differ from the running code.

## Recommended Recording Method

Record clean source takes at normal interaction speed, then assemble the 58-second timeline. Do not try to perform every gesture in a single 58-second take. Receipt processing is network/provider dependent, and the review form is scrollable; separate takes preserve accuracy and readable pacing.

Preferred hero path:

`/home → /add-expense → /scanner → /processing → /receipt-review → /transactions → /wallet → /analytics → /insights → /home`

If OCR is unreliable after preflight, use the explicit fallback:

`/home → /add-expense → /manual-expense → /transactions → /wallet → /analytics → /insights → /home`

Caption that fallback as manual entry. Never cut from the processing screen into manually seeded OCR results in a way that implies the app produced them.

## Validation

- All JSON files parse successfully.
- Timeline duration is 58 seconds and does not exceed 60.
- Every shown route and interaction exists in the current source.
- `npm run lint` completes with no reported errors (invoked through `cmd /c` because PowerShell script execution is disabled on this machine).
- No application source or visual design was changed.

## App Demo Summary

- **Strongest feature:** receipt capture, recognition, review, and atomic save into the ledger/wallet system.
- **Strongest visual screen:** Home Dashboard for brand; Receipt Review for product proof.
- **Recommended opening:** seeded signed-in Home Dashboard with a one-second wordmark dissolve.
- **Recommended ending:** updated Home Dashboard plus real wordmark and `TRACK SMARTER. LIVE BETTER.`
- **Recommended demo path:** Home → Add Expense → Scanner → Processing → Review → Transactions → Wallet → Analytics/Insights → Home.
- **Total duration:** 58 seconds.
- **Number of scenes:** 9.
- **Features included:** dashboard, capture choices, scanner, OCR pipeline, review, ledger, wallet/budget effect, analytics, insights.
- **Features excluded:** auth, failure path, manual entry in the primary cut, settings, categories, goals, destructive actions, offline assistant.

## Recommended Demo Sequence

Home Dashboard → Add Expense → Receipt Scanner → Receipt Processing → Receipt Review → Transactions → Wallet → Analytics & Insights → Updated Home / Ending

## One-Sentence Demo Concept

One receipt moves from camera capture to a reviewed financial record, then becomes a clearer view of balances, budgets, and spending patterns.

## Recording Readiness

| Part | Status | Note |
|---|---|---|
| Branding and dashboard | Ready | Exact assets and tokens are in source. |
| Navigation and motion | Ready | Root tabs, sheets, stack motion, and reduced-motion handling are implemented. |
| Manual expense path | Ready | Supports offline queueing, with an attachment caveat. |
| Receipt scanner | Needs setup | Grant camera permission and print the sample receipt. |
| OCR processing | Needs setup | Requires working Supabase Edge Function/provider quota and stable network. |
| Receipt review/save | Needs setup | Requires at least one wallet and a successful/preflighted read. |
| Transactions | Ready | Clear filters and ensure newest sort before the take. |
| Wallet/budgets | Needs setup | Seed wallets and current-month category budgets. |
| Analytics/insights | Needs setup | Seed both months exactly as documented. |
| Final edit and audio | Ready | Timeline, copy, framing, and audio direction are specified. |

## Source Traceability

Primary implementation sources are `src/app/`, `src/screens/`, `src/features/`, `src/components/common/`, `src/components/navigation/`, `src/constants/theme.ts`, `src/lib/`, `app.json`, `package.json`, and `supabase/`. Individual JSON records contain file and approximate line references. Expo behavior was interpreted against the repository-mandated Expo SDK 57 documentation: <https://docs.expo.dev/versions/v57.0.0/>.
