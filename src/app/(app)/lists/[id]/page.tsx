"use client";

import { useEffect, useState, useRef, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Share2, Trash2, X, UserMinus } from "lucide-react";
import Link from "next/link";
import { ConfettiBurst } from "@/components/confetti";

interface Item {
  id: string;
  name: string;
  checked: boolean;
  added_by: string;
  created_at: string;
}

interface SharedUser {
  id: string;
  email: string;
  display_name: string | null;
}

interface ConfettiState {
  key: number;
  x: number;
  y: number;
}

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: listId } = use(params);
  const supabase = createClient();
  const [listName, setListName] = useState("");
  const [listEmoji, setListEmoji] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState("");
  const [confetti, setConfetti] = useState<ConfettiState | null>(null);
  const [bonusConfetti, setBonusConfetti] = useState<ConfettiState[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const confettiKey = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadList();
    loadItems();

    const channel = supabase
      .channel(`list:${listId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listly_items", filter: `list_id=eq.${listId}` },
        () => loadItems()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [listId]);

  const loadList = async () => {
    const { data } = await supabase
      .from("listly_lists")
      .select("name, emoji")
      .eq("id", listId)
      .single();
    if (data) {
      setListName(data.name);
      setListEmoji(data.emoji);
    }
  };

  const loadItems = async () => {
    const { data } = await supabase
      .from("listly_items")
      .select("*")
      .eq("list_id", listId)
      .order("checked", { ascending: true })
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("listly_items").insert({
      list_id: listId,
      name: newItem.trim(),
      added_by: user.id,
    });

    setNewItem("");
    inputRef.current?.focus();
    loadItems();
  };

  const toggleItem = async (item: Item, e: React.MouseEvent) => {
    const newChecked = !item.checked;

    // Fire confetti immediately before async call
    if (newChecked) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      confettiKey.current++;
      setConfetti({
        key: confettiKey.current,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }

    await supabase
      .from("listly_items")
      .update({
        checked: newChecked,
        checked_at: newChecked ? new Date().toISOString() : null,
      })
      .eq("id", item.id);

    // Check if all items are now checked → celebration confetti
    if (newChecked) {
      const remainingUnchecked = items.filter(
        (i) => !i.checked && i.id !== item.id
      ).length;
      if (remainingUnchecked === 0 && items.length > 1) {
        // Fire confetti from multiple points across the screen
        setTimeout(() => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const bursts: ConfettiState[] = [];
          const positions = [
            { x: w * 0.5, y: h * 0.3 },
            { x: w * 0.2, y: h * 0.5 },
            { x: w * 0.8, y: h * 0.5 },
          ];
          positions.forEach((pos, i) => {
            confettiKey.current++;
            bursts.push({ key: confettiKey.current + i, ...pos });
          });
          setBonusConfetti(bursts);
          setTimeout(() => setBonusConfetti([]), 2000);
        }, 300);
      }
    }

    loadItems();
  };

  const deleteItem = async (itemId: string) => {
    await supabase.from("listly_items").delete().eq("id", itemId);
    loadItems();
  };

  const clearChecked = async () => {
    await supabase
      .from("listly_items")
      .delete()
      .eq("list_id", listId)
      .eq("checked", true);
    loadItems();
  };

  const openShare = async () => {
    setShowShare(true);
    setShareEmail("");
    setShareMessage("");

    const { data } = await supabase
      .from("listly_members")
      .select("user_id, profiles!listly_members_user_id_fkey(id, email, display_name)")
      .eq("list_id", listId);

    const users = (data ?? [])
      .map((m) => m.profiles as unknown as SharedUser)
      .filter(Boolean);
    setSharedUsers(users);
  };

  const handleShare = async () => {
    if (!shareEmail.trim()) return;

    const { data: profileId, error: lookupError } = await supabase
      .rpc("lookup_profile_by_email", { p_email: shareEmail.trim() });

    if (lookupError || !profileId) {
      setShareMessage("User not found. They need to sign up first.");
      return;
    }

    const { error } = await supabase.from("listly_members").insert({
      list_id: listId,
      user_id: profileId,
      role: "member",
    });

    if (error?.code === "23505") {
      setShareMessage("Already shared with this user.");
    } else if (error) {
      setShareMessage("Error sharing list.");
    } else {
      setShareMessage("Shared!");
      setShareEmail("");
      openShare();
    }
    setTimeout(() => setShareMessage(""), 2000);
  };

  const handleUnshare = async (userId: string) => {
    await supabase
      .from("listly_members")
      .delete()
      .eq("list_id", listId)
      .eq("user_id", userId);
    openShare();
  };

  const uncheckedItems = items.filter((i) => !i.checked);
  const checkedItems = items.filter((i) => i.checked);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/lists" className="text-muted hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {listEmoji} {listName}
            </h1>
            <p className="text-xs text-muted">{uncheckedItems.length} remaining</p>
          </div>
        </div>
        <button
          onClick={openShare}
          className="p-2 text-muted hover:text-emerald transition-colors"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Add item */}
      <div className="flex gap-2 mb-6">
        <input
          ref={inputRef}
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="Add an item..."
          className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:border-emerald"
        />
        <button
          onClick={addItem}
          disabled={!newItem.trim()}
          className="bg-emerald text-black font-medium px-4 py-3 rounded-xl disabled:opacity-40 text-sm"
        >
          Add
        </button>
      </div>

      {/* Unchecked items */}
      <div className="space-y-2 mb-6">
        {uncheckedItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-border"
          >
            <button
              onClick={(e) => toggleItem(item, e)}
              className="w-6 h-6 rounded-full border-2 border-emerald shrink-0 hover:bg-emerald/20 transition-colors"
            />
            <span className="flex-1 text-sm text-foreground">{item.name}</span>
            <button
              onClick={() => deleteItem(item.id)}
              className="text-muted hover:text-red-400 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Checked items */}
      {checkedItems.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted">Checked ({checkedItems.length})</p>
            <button
              onClick={clearChecked}
              className="text-xs text-muted hover:text-red-400"
            >
              Clear all
            </button>
          </div>
          <div className="space-y-2 mb-6">
            {checkedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-border opacity-50"
              >
                <button
                  onClick={(e) => toggleItem(item, e)}
                  className="w-6 h-6 rounded-full border-2 border-emerald bg-emerald shrink-0 flex items-center justify-center"
                >
                  <span className="text-black text-xs font-bold">✓</span>
                </button>
                <span className="flex-1 text-sm text-foreground line-through">{item.name}</span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-muted hover:text-red-400 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center px-6">
          <div className="bg-surface rounded-2xl p-6 border border-border max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Share List</h3>
              <button onClick={() => setShowShare(false)} className="text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            {sharedUsers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-muted mb-2">Shared with</p>
                <div className="space-y-2">
                  {sharedUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                      <span className="text-sm text-foreground truncate">
                        {u.display_name || u.email}
                      </span>
                      <button
                        onClick={() => handleUnshare(u.id)}
                        className="text-muted hover:text-red-400 transition-colors ml-2 shrink-0"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted mb-2">Add person by email</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleShare()}
                placeholder="email@example.com"
                className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:border-emerald"
              />
              <button
                onClick={handleShare}
                disabled={!shareEmail.trim()}
                className="bg-emerald text-black font-medium px-4 py-3 rounded-xl disabled:opacity-40 text-sm"
              >
                Share
              </button>
            </div>
            {shareMessage && (
              <p className={`text-xs mt-2 ${shareMessage.includes("Shared") ? "text-green-400" : "text-red-400"}`}>
                {shareMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Confetti */}
      {confetti && (
        <ConfettiBurst
          key={confetti.key}
          x={confetti.x}
          y={confetti.y}
          onDone={() => setConfetti(null)}
        />
      )}

      {/* Celebration confetti — all items checked! */}
      {bonusConfetti.map((c) => (
        <ConfettiBurst
          key={c.key}
          x={c.x}
          y={c.y}
          onDone={() => {}}
        />
      ))}
    </div>
  );
}
