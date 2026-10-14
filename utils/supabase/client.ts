import { createBrowserClient } from "@supabase/ssr";
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    { global: { fetch: async (input, init) => {
      const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (target.origin === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin && target.pathname.startsWith('/rest/v1/')) {
        const table = target.pathname.slice('/rest/v1/'.length);
        return fetch(`/api/data/${encodeURIComponent(table)}${target.search}`, { ...init, credentials: 'same-origin' });
      }
      return fetch(input, init);
    } } },
  );
}
