# Staging Deploy And UAT Checklist (Step 25)

- Target environment: `stg`
- Firebase project: `heinrix-super-admin-stg`
- Hosting target: `admin_stg`
- Admin URL: `https://admin-stg.heinrix.com`

## 1. Preflight

- `firebase login --reauth --no-localhost`
- `./super_admin_console/scripts/apply_web_env.sh stg`
- Fill `super_admin_console/web/.env` with the staging Firebase Web App config
- Confirm `super_admin_console/firebase/functions/.env.stg` is present
- Confirm `super_admin_console/.firebaserc` contains the `stg` alias and `admin_stg` target

## 2. Deploy

```bash
bash super_admin_console/scripts/deploy_admin.sh stg
```

Expected scope:
- Cloud Functions
- Firestore Rules + Indexes
- Hosting (`admin_stg`)

## 3. UAT Checklist

- Login succeeds only for `heinrix.com` super admin accounts
- MFA-required account without second factor is blocked
- Environment-mismatched super admin token is blocked
- Dashboard loads summary cards and recent activity
- Companies CRUD callable flows succeed
- Projects CRUD/archive callable flows succeed
- Users role/status update flows succeed
- Membership create/update/delete flows succeed
- Deletion request review flow succeeds
- Audit logs screen loads and filters work
- System config read/write works
- Protected `super_admin` delete/anonymize is blocked

## 4. Evidence To Record

- Deploy command timestamp
- Hosting URL and release version
- Updated function revisions
- Any blocking issue and rollback decision
