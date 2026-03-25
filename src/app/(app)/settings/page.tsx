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
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 text-red-400 text-sm font-medium"
      >
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </div>
  );
}
