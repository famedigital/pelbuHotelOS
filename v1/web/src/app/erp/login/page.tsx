import { Metadata } from "next";
import Link from "next/link";
import { TouchStaffPinGateway } from "@/components/auth/TouchStaffPinGateway";
import { ArrowLeft, Sparkles, Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Front Desk Login · Hotel OS Bhutan v2",
  description: "Touch-First 0.2s Staff PIN Gateway and Role Switcher.",
  robots: { index: false, follow: false },
};

export default function DeskLoginPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#030712] text-slate-100 flex flex-col justify-between p-6">
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full blur-[140px] opacity-25"
        style={{
          background: "radial-gradient(circle, #6366f1 0%, rgba(99, 102, 241, 0) 70%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full blur-[160px] opacity-20"
        style={{
          background: "radial-gradient(circle, #8b5cf6 0%, rgba(139, 92, 246, 0) 70%)",
        }}
        aria-hidden
      />

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between max-w-5xl mx-auto w-full mb-6">
        <Link
          href="/v2"
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to v2 Launcher</span>
        </Link>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400 font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Hotel OS v2 Enterprise</span>
        </div>
      </header>

      {/* Main Touch PIN Gateway */}
      <div className="relative z-10 max-w-5xl mx-auto w-full">
        <TouchStaffPinGateway />
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4 text-xs text-slate-500 border-t border-white/5 mt-8">
        Hotel OS Bhutan v2 • 0ms In-Memory RAM Architecture • DRC BST & RMA QR Gateway Ready
      </footer>
    </main>
  );
}
