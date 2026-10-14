"use client";
import { createContext, useContext, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
const HistoryContext = createContext<{ canGoBack: () => boolean }>({ canGoBack: () => false });
export function AppHistory({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const paths = useRef([pathname]);
  useEffect(() => {
    const index = paths.current.lastIndexOf(pathname);
    if (index >= 0) paths.current = paths.current.slice(0, index + 1);
    else paths.current.push(pathname);
  }, [pathname]);
  return <HistoryContext.Provider value={{ canGoBack: () => paths.current.length > 1 }}>{children}</HistoryContext.Provider>;
}
export default function BackButton({ fallback = '/', className }: { fallback?: string; className?: string }) {
  const router = useRouter();
  const history = useContext(HistoryContext);
  return <button type="button" aria-label="ย้อนกลับ" className={className} onClick={() => history.canGoBack() ? router.back() : router.replace(fallback)}><ChevronLeft size={24} aria-hidden="true" /></button>;
}
