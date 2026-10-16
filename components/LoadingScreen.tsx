import LogoLoader from "@/components/LogoLoader";

interface LoadingScreenProps {
  text?: string;
}

export default function LoadingScreen({
  text = "กำลังโหลดข้อมูล...",
}: LoadingScreenProps) {
  return (
    <div data-loading-screen className="fixed inset-0 z-50 flex items-center justify-center bg-[#ece8f4] sm:p-4">
      <div data-loading-panel className="relative flex h-full w-full max-w-md flex-col items-center justify-center overflow-hidden bg-[#faf8fc] sm:h-[calc(100dvh-2rem)] sm:rounded-[40px] sm:shadow-2xl">
        <div className="relative z-10 flex flex-col items-center gap-4">
          <LogoLoader text={text} size="lg" />
          <p className="text-sm font-medium tracking-wide text-slate-500">OFFICE SYSTEM</p>
        </div>
      </div>
    </div>
  );
}
