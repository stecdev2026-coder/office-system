This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Mobile PWA

Production uses a single service worker at `/sw.js`. It caches public app assets and provides `/offline.html` when navigation cannot reach the network. Employee records, authenticated HTML, Supabase requests and mutations are not cached. Forms still require internet; there is no offline submission queue. Bump `office-shell-v1` when changing the offline shell. The worker is registered only in production; use HTTPS (or localhost) to test.

Android: choose **ติดตั้งแอป** when the browser offers installation. iPhone: Safari → Share → Add to Home Screen. Test portrait/landscape, safe areas, keyboard opening, detail dialogs and bottom navigation on real devices. iPhone push requires iOS 16.4+ and a home-screen installation.

### Push integration

The worker supports `push` and notification clicks. To enable the opt-in button, configure:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: URL-safe base64 public VAPID key.
- `NEXT_PUBLIC_PUSH_SUBSCRIBE_URL`: preferably a same-origin authenticated backend endpoint.

The subscription endpoint receives POST JSON (`endpoint`, `expirationTime`, `keys`) and must validate the signed-in user, persist subscriptions against that user, and return success only after saving. Do not identify users solely through `employee_data` in localStorage. The existing app does not include a push delivery backend; connect one before enabling these settings. Keep the private VAPID key on the server. Send standard Web Push JSON `{ "title": "Office System", "body": "...", "url": "/notifications" }`; remove expired subscriptions on 404/410. No notification permission is requested automatically.

Validation: `npx tsc --noEmit`, `npm run build`. Device acceptance checks: install and relaunch standalone, navigate between tabs and forms, scroll to the final submit button, open keyboard, disconnect/reconnect network, opt in to push and open a notification while the app is closed.

## Username/password and device sessions

See [authentication setup](docs/auth-setup.md) for the Supabase migration, server-only environment settings, administrator bootstrap, LINE toggle and one-device binding.

## Work groups and permissions

See [คู่มือกลุ่มงาน สิทธิ์ และลงเวลา](docs/groups-permissions-guide.md). The fresh-project SQL includes migrations 005–010. Use the admin employee screen to download a current database-driven import template. Keep bootstrap credential files private and out of Git.
