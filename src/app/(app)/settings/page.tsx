"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-6">Settings</h1>
      {/* WhatsApp feedback */}
      <a
        href="https://wa.me/34644941706?text=Hey%20Fran!%20%F0%9F%91%8B%20I'm%20using%20Listly%20and%20wanted%20to%20tell%20you..."
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 bg-surface border border-border rounded-xl py-4 text-sm font-medium text-foreground hover:border-primary/30 transition-colors mb-4"
      >
        Feedback? Chat with Fran 💬
      </a>

      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 text-red-400 text-sm font-medium"
      >
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </div>
  );
}
