import { Logo } from "@/components/brand/logo";
import { Aurora } from "@/components/motion/aurora";

// Temporary placeholder — the landing page replaces this file.
export default function Home() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <Aurora variant="spot" />
      <Logo size={40} className="animate-fade-up" />
    </main>
  );
}
