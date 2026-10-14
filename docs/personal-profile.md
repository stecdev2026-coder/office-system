# Personal profile and UI conventions

- All buttons and button-like controls use cursor:pointer in app/globals.css and the rule is recorded in AGENTS.md.
- Avatar opens an account popup on the admin header and employee homepage. Includes personal profile, password change and logout.
- Admin profile: /admin/profile; employee profile: /profile/edit. #password opens password section.
- Personal fields: first/last name, nickname, contact email, phone, own uploaded profile image.
- HR fields are readonly: employee code, department, division, branch, work group, position, role, annual leave quota and active status.
- /api/profile only accepts personal fields for the current server session, rejects fields/IDs outside the allowlist, and verifies uploaded image ownership. Generic employee API no longer allows staff position changes.
- /api/profile/password requires the account's old password, matching confirmation and 8–128 characters. Revokes all old sessions after saving.
- Avatar files use the existing private attendance_photos bucket and the authorized /api/photos route. Private avatars on the employee homepage bypass Next image optimization to send session cookies directly.
- admin/users has alternating rows, separators and hover/focus highlighting. Clicking a row opens details.

Migration: supabase/migrations/202610120004_personal_profile.sql applied on ikkgncneoenaktlwotmp.
Validation: scripts/test-live-profile.mjs covers a temporary Staff account, HR/foreign photo denial, profile photo upload/session display, personal changes and password/session checks. Removes exactly its fixtures and image afterward.
