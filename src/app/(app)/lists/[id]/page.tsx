"use client";

import { useEffect, useState, useRef, useCallback, use, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Share2, Trash2, X, UserMinus, GripVertical, User } from "lucide-react";
import Link from "next/link";
import { ConfettiBurst } from "@/components/confetti";

interface Item {
  id: string;
  name: string;
  checked: boolean;
  added_by: string;
  created_at: string;
  position: number;
  assigned_to: string | null;
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

const MEMBER_COLORS = [
  "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

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
  const [members, setMembers] = useState<SharedUser[]>([]);
  const [assignPopover, setAssignPopover] = useState<string | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [draggingLine, setDraggingLine] = useState(false);
  const confettiKey = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const loadMembers = async () => {
    const { data } = await supabase
      .from("listly_members")
      .select("user_id, global_profiles!listly_members_user_id_fkey(id, email, display_name)")
      .eq("list_id", listId);
    const users = (data ?? [])
      .map((m) => (m as any).global_profiles as unknown as SharedUser)
      .filter(Boolean);
    setMembers(users);
  };

  const getMemberColor = (userId: string) => {
    const idx = members.findIndex((m) => m.id === userId);
    return MEMBER_COLORS[idx % MEMBER_COLORS.length];
  };

  const getMemberInitial = (userId: string) => {
    const member = members.find((m) => m.id === userId);
    if (!member) return "?";
    const name = member.display_name || member.email;
    return name.charAt(0).toUpperCase();
  };

  const assignItem = async (itemId: string, userId: string | null) => {
    await supabase
      .from("listly_items")
      .update({ assigned_to: userId })
      .eq("id", itemId);
    setAssignPopover(null);
    loadItems();
  };

  // Close assign popover on click outside
  useEffect(() => {
    if (!assignPopover) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-assign-popover]")) setAssignPopover(null);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [assignPopover]);

  useEffect(() => {
    loadList();
    loadItems();
    loadMembers();

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
      .select("name, emoji, today_count")
      .eq("id", listId)
      .single();
    if (data) {
      setListName(data.name);
      setListEmoji(data.emoji);
      setTodayCount(data.today_count ?? 0);
    }
  };

  const updateTodayCount = async (count: number) => {
    setTodayCount(count);
    await supabase
      .from("listly_lists")
      .update({ today_count: count })
      .eq("id", listId);
  };

  const handleLineDrag = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setDraggingLine(true);

    const getY = (ev: TouchEvent | MouseEvent) =>
      "touches" in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;

    const onMove = (ev: TouchEvent | MouseEvent) => {
      const y = getY(ev);
      const itemEls = document.querySelectorAll("[data-drag-index]");
      let newCount = 0;
      itemEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (y > rect.top + rect.height / 2) {
          newCount = parseInt(el.getAttribute("data-drag-index")!, 10) + 1;
        }
      });
      setTodayCount(Math.max(0, newCount));
    };

    const onEnd = () => {
      setDraggingLine(false);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      // Save the final value — read from DOM since state may be stale in closure
      const itemEls = document.querySelectorAll("[data-drag-index]");
      // Use a microtask to read the latest state
      setTimeout(() => {
        setTodayCount((c) => {
          supabase.from("listly_lists").update({ today_count: c }).eq("id", listId);
          return c;
        });
      }, 0);
    };

    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
  };

  const loadItems = async () => {
    const { data } = await supabase
      .from("listly_items")
      .select("*")
      .eq("list_id", listId)
      .order("checked", { ascending: true })
      .order("position", { ascending: true });
    setItems(data ?? []);
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Shift existing items down
    await supabase.rpc("listly_shift_positions", { p_list_id: listId, p_from: 0, p_delta: 1 });

    await supabase.from("listly_items").insert({
      list_id: listId,
      name: newItem.trim(),
      added_by: user.id,
      position: 0,
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

    // Check if all items are now checked → celebration confetti (3 waves)
    if (newChecked) {
      const remainingUnchecked = items.filter(
        (i) => !i.checked && i.id !== item.id
      ).length;
      if (remainingUnchecked === 0) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const makeWave = () => {
          const positions = [
            { x: w * 0.5, y: h * 0.2 },
            { x: w * 0.15, y: h * 0.4 },
            { x: w * 0.85, y: h * 0.4 },
            { x: w * 0.3, y: h * 0.65 },
            { x: w * 0.7, y: h * 0.65 },
          ];
          return positions.map((pos) => {
            confettiKey.current++;
            return { key: confettiKey.current, ...pos };
          });
        };
        // 3 waves, 800ms apart
        setTimeout(() => setBonusConfetti(makeWave()), 400);
        setTimeout(() => setBonusConfetti(makeWave()), 1200);
        setTimeout(() => setBonusConfetti(makeWave()), 2000);
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
      .select("user_id, global_profiles!listly_members_user_id_fkey(id, email, display_name)")
      .eq("list_id", listId);

    const users = (data ?? [])
      .map((m) => (m as any).global_profiles as unknown as SharedUser)
      .filter(Boolean);
    setSharedUsers(users);
    setMembers(users);
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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteList = async () => {
    await supabase.from("listly_lists").delete().eq("id", listId);
    window.location.href = "/lists";
  };

  const handleReorder = useCallback(async (fromIdx: number, toIdx: number) => {
    const reordered = [...uncheckedItemsRef.current];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Update positions locally for instant feedback
    const updated = reordered.map((item, i) => ({ ...item, position: i }));
    setItems((prev) => [
      ...updated,
      ...prev.filter((i) => i.checked),
    ]);

    // Persist to DB
    for (let i = 0; i < updated.length; i++) {
      await supabase
        .from("listly_items")
        .update({ position: i })
        .eq("id", updated[i].id);
    }
  }, [supabase]);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
    setOverIndex(index);
    setIsDragging(true);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const handleDragOver = (index: number) => {
    if (dragIndex === null) return;
    setOverIndex(index);
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      handleReorder(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
    setIsDragging(false);
  };

  const handleTouchStart = (index: number) => {
    longPressTimer.current = setTimeout(() => {
      handleDragStart(index);
    }, 400);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isDragging) handleDragEnd();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      return;
    }
    e.preventDefault();
    const touch = e.touches[0];
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const itemEl = elements.find((el) => el.getAttribute("data-drag-index") !== null);
    if (itemEl) {
      const idx = parseInt(itemEl.getAttribute("data-drag-index")!, 10);
      setOverIndex(idx);
    }
  };

  const uncheckedItems = items.filter((i) => !i.checked);
  const uncheckedItemsRef = useRef(uncheckedItems);
  uncheckedItemsRef.current = uncheckedItems;
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
        <div className="flex items-center gap-1">
          <button
            onClick={openShare}
            className="p-2 text-muted hover:text-emerald transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-muted hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
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

      {/* Today line — show at top if todayCount === 0 and there are items, to let user drag it down */}
      {uncheckedItems.length > 0 && todayCount === 0 && (
        <div
          className="flex items-center gap-2 py-1 cursor-ns-resize select-none mb-2 opacity-40 hover:opacity-100 transition-opacity"
          onMouseDown={handleLineDrag}
          onTouchStart={handleLineDrag}
        >
          <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: "var(--color-emerald, #10b981)" }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider px-1 shrink-0" style={{ color: "var(--color-emerald, #10b981)" }}>
            drag to set today
          </span>
          <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: "var(--color-emerald, #10b981)" }} />
        </div>
      )}

      {/* Unchecked items */}
      <div className="space-y-2 mb-6" onTouchMove={handleTouchMove}>
        {uncheckedItems.map((item, index) => {
          const isBeingDragged = isDragging && dragIndex === index;
          const isOver = isDragging && overIndex === index && dragIndex !== index;
          const showTodayLine = todayCount > 0 && index === todayCount;
          return (
            <Fragment key={item.id}>
              {showTodayLine && (
                <div
                  className="flex items-center gap-2 py-1 cursor-ns-resize select-none"
                  onMouseDown={handleLineDrag}
                  onTouchStart={handleLineDrag}
                >
                  <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: "var(--color-emerald, #10b981)" }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1 shrink-0" style={{ color: "var(--color-emerald, #10b981)" }}>
                    today
                  </span>
                  <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: "var(--color-emerald, #10b981)" }} />
                </div>
              )}
            <div
              data-drag-index={index}
              className={`flex items-center gap-2 bg-surface rounded-xl p-3 border transition-all ${
                isBeingDragged ? "border-emerald opacity-50 scale-95" : isOver ? "border-emerald border-2" : "border-border"
              }`}
              draggable={isDragging}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => { e.preventDefault(); handleDragOver(index); }}
              onDrop={handleDragEnd}
              onDragEnd={handleDragEnd}
              onTouchStart={() => handleTouchStart(index)}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="text-muted shrink-0 cursor-grab active:cursor-grabbing touch-none"
                onMouseDown={() => handleDragStart(index)}
              >
                <GripVertical className="w-4 h-4" />
              </div>
              <button
                onClick={(e) => toggleItem(item, e)}
                className="w-6 h-6 rounded-full border-2 border-emerald shrink-0 hover:bg-emerald/20 transition-colors"
              />
              <span className="flex-1 text-sm text-foreground">{item.name}</span>
              <div className="relative shrink-0" data-assign-popover>
                <button
                  onClick={() => setAssignPopover(assignPopover === item.id ? null : item.id)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                  style={item.assigned_to ? {
                    backgroundColor: getMemberColor(item.assigned_to),
                    color: "#fff",
                  } : {
                    backgroundColor: "transparent",
                    border: "1.5px dashed var(--color-muted)",
                    color: "var(--color-muted)",
                  }}
                  title={item.assigned_to ? members.find(m => m.id === item.assigned_to)?.display_name || "Assigned" : "Assign"}
                >
                  {item.assigned_to ? getMemberInitial(item.assigned_to) : <User className="w-3 h-3" />}
                </button>
                {assignPopover === item.id && (
                  <div className="absolute right-0 top-8 bg-surface border border-border rounded-xl shadow-lg z-50 py-1 min-w-[160px]">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => assignItem(item.id, m.id)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-background transition-colors"
                      >
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: getMemberColor(m.id) }}
                        >
                          {(m.display_name || m.email).charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate">{m.display_name || m.email}</span>
                      </button>
                    ))}
                    {item.assigned_to && (
                      <button
                        onClick={() => assignItem(item.id, null)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted hover:bg-background transition-colors border-t border-border"
                      >
                        <X className="w-4 h-4" />
                        <span>Unassign</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => deleteItem(item.id)}
                className="text-muted hover:text-red-400 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            </Fragment>
          );
        })}
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
                {item.assigned_to && (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: getMemberColor(item.assigned_to) }}
                  >
                    {getMemberInitial(item.assigned_to)}
                  </span>
                )}
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

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center px-6">
          <div className="bg-surface rounded-2xl p-6 border border-border max-w-sm w-full">
            <h3 className="font-bold text-foreground mb-2">Delete List?</h3>
            <p className="text-sm text-muted mb-6">
              This will permanently delete &quot;{listName}&quot; and all its items.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={deleteList}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
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
          onDone={() => setBonusConfetti((prev) => prev.filter((b) => b.key !== c.key))}
        />
      ))}
    </div>
  );
}
