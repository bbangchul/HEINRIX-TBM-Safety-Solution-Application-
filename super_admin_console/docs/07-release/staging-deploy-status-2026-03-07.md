# Staging Deploy Status (Step 25)

- Date: `2026-03-07`
- Step: `25`
- Status: `done`
- Target environment: `stg`
- Firebase project: `heinrix-super-admin-stg`

## Completed

- Created staging Firebase project: `heinrix-super-admin-stg`
- Created staging Web App: `1:918489893347:web:dd6565ef3bd649de49f8d6`
- Added dedicated admin deploy config: `super_admin_console/firebase.json`
- Added Firebase alias/hosting target mapping: `super_admin_console/.firebaserc`
- Added runtime env files for Functions:
  - `firebase/functions/.env.dev`
  - `firebase/functions/.env.stg`
  - `firebase/functions/.env.prod`
- Added deploy helper: `scripts/deploy_admin.sh`
- Added staging UAT checklist: `docs/07-release/staging-uat-checklist.md`
- Filled `super_admin_console/web/.env` with staging Firebase Web App values
- Static validation passed:
  - `npm --prefix super_admin_console/firebase/functions run verify:admin-api-layer`
  - `npm --prefix super_admin_console/firebase/functions run verify:security-controls`
  - `npm --prefix super_admin_console/web run verify:callable-only`
- Build validation passed:
  - `npm --prefix super_admin_console/firebase/functions run build`
  - `npm --prefix super_admin_console/web run build`
- Firestore API enabled automatically during deploy
- Firestore default database created and rules/indexes deployed
- Hosting deployed successfully
  - URL: `https://heinrix-super-admin-stg.web.app`
  - Release: `projects/918489893347/sites/heinrix-super-admin-stg/channels/live/releases/1772878987858000`
- Cloud Functions deployed successfully to `asia-northeast3`
- Artifact Registry cleanup policy configured for `gcf-artifacts`
- Firebase Authentication initialized for `heinrix-super-admin-stg`
- Email/password sign-in enabled for automated staging verification
- UI smoke test passed after fixing the staging auth bypass
  - Command: `npm --prefix super_admin_console/web run test:smoke:ui`
  - Result: `8 passed`
- Security E2E passed
  - Command: `FIREBASE_API_KEY=... SECURITY_TEST_PROJECT_ID=heinrix-super-admin-stg SECURITY_TEST_REGION=asia-northeast3 SECURITY_TEST_RUNTIME_ENV=stg npm --prefix super_admin_console/firebase/functions run test:security:e2e`
  - Result: `pass`
- Regression E2E passed
  - Command: `FIREBASE_API_KEY=... REGRESSION_TEST_PROJECT_ID=heinrix-super-admin-stg REGRESSION_TEST_REGION=asia-northeast3 REGRESSION_TEST_RUNTIME_ENV=stg npm --prefix super_admin_console/firebase/functions run test:regression:e2e`
  - Result: `pass`

## Completion

- Step 25 exit criteria satisfied on `2026-03-07`
- Functions, Firestore rules/indexes, and Hosting deployed to `heinrix-super-admin-stg`
- Automated UAT evidence captured via security E2E, regression E2E, and UI smoke
- Active blocking issue: `0`

## Deployment Notes

The current authenticated account can access and deploy to the staging project after reauthentication.

Deployment evidence captured on `2026-03-07`:

- Hosting URL: `https://heinrix-super-admin-stg.web.app`
- Functions region: `asia-northeast3`
- Functions deployed: `23`
- Final retry deployment fixed `adminListUsers`
- Security E2E summary: `pass`
- Regression E2E summary: `pass`
- UI smoke summary: `8/8 pass`

The Firestore default database was auto-created by Firebase CLI at:

- Create time: `2026-03-07T10:20:41.181719Z`
- Location: `nam5`

This location is immutable for the `(default)` database. If the team requires a Seoul-region Firestore database instead, recreate the staging project or delete/recreate the database before real test data is accumulated.

Per Firebase documentation, deployment access typically requires:
- Cloud Functions: project `Owner`, or `roles/cloudfunctions.admin` + `roles/iam.serviceAccountUser`
- Firebase Hosting: `roles/firebasehosting.admin` and `roles/serviceusage.apiKeysViewer`
- Firestore rules deployment: a role including `firebaserules.*` permissions
