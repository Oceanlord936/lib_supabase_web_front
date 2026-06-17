"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface NavLinkProps {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}

function NavLink({ href, active, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors ${
        active
          ? "text-foreground underline underline-offset-4"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="w-full border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-foreground" />
          <span className="text-lg font-bold text-foreground">Good Library</span>
        </Link>
        <nav className="flex items-center gap-6">
          <NavLink href="/home" active={pathname === "/home"}>Discover</NavLink>
          <NavLink href="/favorites" active={pathname === "/favorites"}>Favorites</NavLink>
          <NavLink href="/community" active={pathname === "/community"}>Community</NavLink>
          <NavLink href="/profile" active={pathname === "/profile"}>Profile</NavLink>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
