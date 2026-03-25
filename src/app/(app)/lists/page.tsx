"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X } from "lucide-react";
import Link from "next/link";

interface ListEntry {
  id: string;
  name: string;
  emoji: string;
  owner_id: string;
  item_count: number;
  unchecked_count: number;
}

const EMOJIS = ["🛒", "🎁", "🏠", "🍽️", "✈️", "📚", "💊", "🎯", "❤️", "🐕"];

export default function ListsPage() {
  const supabase = createClient();
  const [lists, setLists] = useState<ListEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🛒");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get all lists the user is a member of
    const { data: memberships } = await supabase
      .from("listly_members")
      .select("list_id")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      setLists([]);
      setLoading(false);
      return;
    }

    const listIds = memberships.map((m) => m.list_id);
    const { data: listsData } = await supabase
      .from("listly_lists")
      .select("*")
      .in("id", listIds)
      .order("created_at", { ascending: false });

    // Get item counts per list
    const enriched: ListEntry[] = [];
    for (const list of listsData ?? []) {
      const { count: total } = await supabase
        .from("listly_items")
        .select("*", { count: "exact", head: true })
        .eq("list_id", list.id);

      const { count: unchecked } = await supabase
        .from("listly_items")
        .select("*", { count: "exact", head: true })
        .eq("list_id", list.id)
        .eq("checked", false);

      enriched.push({
        ...list,
        item_count: total ?? 0,
        unchecked_count: unchecked ?? 0,
      });
    }

    setLists(enriched);
    setLoading(false);

    // Update app badge
    const totalUnchecked = enriched.reduce((sum, l) => sum + l.unchecked_count, 0);
    if ("setAppBadge" in navigator) {
      if (totalUnchecked > 0) {
        navigator.setAppBadge(totalUnchecked).catch(() => {});
      } else {
        navigator.clearAppBadge?.().catch(() => {});
      }
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: list, error } = await supabase
      .from("listly_lists")
      .insert({ name: name.trim(), emoji, owner_id: user.id })
      .select("id")
      .single();

    if (error || !list) return alert("Failed to create list");

    // Add owner as member
    await supabase.from("listly_members").insert({
      list_id: list.id,
      user_id: user.id,
      role: "owner",
    });

    setName("");
    setEmoji("🛒");
    setShowForm(false);
    loadLists();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold emerald-shimmer">Listly</h1>
          <p className="text-xs text-muted mt-0.5">Your shared lists</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-emerald text-black font-medium px-3 py-1.5 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" /> New List
        </button>
      </div>

      {/* Create list modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center">
          <div className="bg-surface w-full max-w-lg rounded-t-2xl p-6 pb-[calc(1.5rem+4rem+env(safe-area-inset-bottom))] border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-foreground">New List</h2>
              <button onClick={() => setShowForm(false)} className="text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="List name (e.g., Groceries)"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm mb-4 outline-none focus:border-emerald"
            />

            <p className="text-xs text-muted mb-2">Icon</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                    emoji === e ? "bg-emerald/20 border border-emerald" : "bg-background border border-border"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="w-full bg-emerald text-black font-medium py-3 rounded-xl disabled:opacity-40"
            >
              Create List
            </button>
          </div>
        </div>
      )}

      {/* Lists */}
      <div className="space-y-3">
        {loading && <p className="text-center text-muted text-sm py-8">Loading...</p>}

        {!loading && lists.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted mb-4">No lists yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-emerald text-black font-medium px-4 py-2 rounded-xl text-sm"
            >
              <Plus className="w-4 h-4" /> Create your first list
            </button>
          </div>
        )}

        {lists.map((list) => (
          <Link
            key={list.id}
            href={`/lists/${list.id}`}
            className="block bg-surface rounded-xl p-4 border border-border hover:border-emerald/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{list.emoji}</span>
                <div>
                  <span className="font-medium text-foreground text-sm">{list.name}</span>
                  <p className="text-xs text-muted">{list.item_count} items</p>
                </div>
              </div>
              {list.unchecked_count > 0 && (
                <span className="bg-emerald text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {list.unchecked_count}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
