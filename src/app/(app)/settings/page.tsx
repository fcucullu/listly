"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut, Send } from "lucide-react";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleFeedback = async () => {
    if (!feedback.trim()) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: feedback, type: "Feedback", email: user?.email }),
    });
    setSending(false);
    setSent(true);
    setFeedback("");
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-6">Settings</h1>

      {/* Feedback form */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-4">
        <p className="text-sm font-medium text-foreground mb-2">Send Feedback</p>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What can we improve?"
          rows={3}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-emerald resize-none mb-2"
        />
        <button
          onClick={handleFeedback}
          disabled={sending || !feedback.trim()}
          className="flex items-center gap-2 bg-emerald text-black font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-40"
        >
          <Send className="w-4 h-4" /> {sending ? "Sending..." : sent ? "Sent!" : "Send"}
        </button>
      </div>

      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 text-red-400 text-sm font-medium"
      >
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </div>
  );
}
