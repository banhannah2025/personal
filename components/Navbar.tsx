'use client';

import Link from "next/link";
import ModeToggle from "@/components/mode-toggle";
import { useUser } from "@clerk/nextjs";

export default function Navbar() {
  const { isSignedIn } = useUser();

  return (
    <nav className="sticky top-0 z-20 border-b border-border/50 bg-background/80 px-6 py-4 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-[0.25em] text-foreground">
          CCPROS
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium text-foreground/80">
          <Link href="/" className="transition hover:text-foreground">
            Home
          </Link>
          <Link href="/help" className="transition hover:text-foreground">
            Help
          </Link>
          {isSignedIn ? (
            <Link href="/app" className="transition hover:text-foreground">
              Dashboard
            </Link>
          ) : null}
          <ModeToggle />
        </div>
      </div>
    </nav>
  );
}
