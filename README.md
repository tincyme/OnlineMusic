# Voxtunes Academy

First P0 implementation for an online Carnatic vocal academy. React + TypeScript + Vite, with Supabase authentication and database authorization. This directory is the repository root; the earlier private prototype in `../voxtunes` is not part of this application.

## Implemented in this increment

- Student/parent signup and sign-in; separate teacher and administrator entry points.
- Role assignment comes from a protected database record, never the portal selector or signup metadata.
- Guardian-owned learner profiles, experience and IANA time zones.
- Assessment requests; administrator follow-up status.
- Administrator batch creation and enrollment with capacity enforcement (4–6 learners).
- 60-minute class scheduling, validated Zoom join links and local-time display.
- Attendance for teachers on assigned batches and academy administrators.
- $35 USD per student per group class displayed publicly. Enrollment does not charge money.
- GitHub Actions tests and a disconnected GitHub Pages development preview.

## Local development

Requires Node 22.13+ (CI uses Node 24).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Populate `.env.local` with a dedicated Supabase project's URL and **publishable** key. No secret/service-role keys belong in browser code, GitHub Pages or repository files. Without configuration, account entry points explain that the academy is not connected.

```sh
npm test
npm run build
npm run build:preview
```

Tests execute the schema in local PostgreSQL via PGlite, including role escalation, family isolation, teacher scope, attendance and batch capacity checks. These do not replace a hosted Supabase integration test.

## Database provisioning (not yet executed)

Use a **new dedicated academy project**, not an existing unrelated application database. `database/schema.sql` is a bootstrap schema, not an applied migration. Apply through the Supabase migration tool to the confirmed project, run security advisors and verify with real test accounts before opening registration.

Enable email confirmation, configure a production email sender, set the production Site URL and exact redirect allowlist, and require passwords of at least 12 characters. Registration creates only `student` accounts. A trusted project operator must provision staff and assign the first administrator in the dashboard; the frontend cannot elevate roles. For an existing confirmed user, the operator can assign `teacher` or `admin` in `public.profiles`. Do not make role assignments from user-supplied metadata.

## GitHub Pages

Publish this directory's contents at the chosen repository root. Select **Settings → Pages → Source → GitHub Actions**, then push `main` or run the Pages workflow. It builds with the repository subpath supplied by GitHub. Hash routes (`#/student`, `#/teacher`, `#/admin`) survive direct navigation and reloads on Pages.

The Pages build is deliberately a **development preview**, with a visible banner and no backend connection, signup or personal-data collection. GitHub's [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) exclude operating an online business and sensitive password transactions. Host the real academy on a production host that supports this use; the production build is `npm run build`, output `dist`. The source can stay in GitHub.

## Zoom in this increment

An administrator manually creates the meeting in Zoom and adds its join URL. Only enrolled families, the assigned teacher and administrators can read the class row. Zoom still controls admission, waiting rooms and recording permissions. Do not put host start URLs in student-visible rows.

Automated meeting creation, recording webhooks and permission-aware replay delivery require a backend integration; none is claimed here. Zoom credentials must stay in backend secrets. Cloud recording needs eligible licensed hosts, configured recording settings, consent, retention and storage management.

## Remaining P0 work / launch gates

- Hosted database deployment and real-account end-to-end checks.
- Password reset, staff invitation/management and account lifecycle.
- Secure practice-audio uploads, assignments, timestamped feedback and progress notebook.
- Recording consent, Zoom automation and protected replays.
- Payment checkout, verified payment webhooks, receipts/refunds and ledger reconciliation.
- Rescheduling/cancellation, teacher conflicts, reminders and DST recurrence rules.
- Recording retention, parent consent, privacy/terms and support operations.
- Recruitment, referrals and simple showcases from the PRD.

This is working application source for the first P0 increment, **not a launch-ready complete P0**. No live deployment or backend provisioning is implied by these files.
