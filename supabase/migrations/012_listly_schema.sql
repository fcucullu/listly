-- Listly tables (profiles table already exists from shared Supabase project)

-- Lists
CREATE TABLE IF NOT EXISTS public.listly_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🛒',
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.listly_lists ENABLE ROW LEVEL SECURITY;

-- Members (who has access to which list)
CREATE TABLE IF NOT EXISTS public.listly_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.listly_lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(list_id, user_id)
);

ALTER TABLE public.listly_members ENABLE ROW LEVEL SECURITY;

-- Items
CREATE TABLE IF NOT EXISTS public.listly_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.listly_lists(id) ON DELETE CASCADE,
  name text NOT NULL,
  checked boolean DEFAULT false NOT NULL,
  added_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checked_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.listly_items ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is a member of a list
CREATE OR REPLACE FUNCTION public.is_listly_member(p_list_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM listly_members WHERE list_id = p_list_id AND user_id = auth.uid()
  );
$$;

-- RLS for lists
CREATE POLICY "Members can view lists" ON public.listly_lists
  FOR SELECT USING (is_listly_member(id));
CREATE POLICY "Authenticated users can create lists" ON public.listly_lists
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update lists" ON public.listly_lists
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete lists" ON public.listly_lists
  FOR DELETE USING (auth.uid() = owner_id);

-- RLS for members
CREATE POLICY "Members can view members" ON public.listly_members
  FOR SELECT USING (is_listly_member(list_id));
CREATE POLICY "Owners can add members" ON public.listly_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM listly_lists WHERE id = list_id AND owner_id = auth.uid())
    OR (user_id = auth.uid() AND role = 'owner')
  );
CREATE POLICY "Owners can remove members" ON public.listly_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM listly_lists WHERE id = list_id AND owner_id = auth.uid())
  );

-- RLS for items
CREATE POLICY "Members can view items" ON public.listly_items
  FOR SELECT USING (is_listly_member(list_id));
CREATE POLICY "Members can add items" ON public.listly_items
  FOR INSERT WITH CHECK (is_listly_member(list_id) AND auth.uid() = added_by);
CREATE POLICY "Members can update items" ON public.listly_items
  FOR UPDATE USING (is_listly_member(list_id));
CREATE POLICY "Members can delete items" ON public.listly_items
  FOR DELETE USING (is_listly_member(list_id));

-- Indexes
CREATE INDEX idx_listly_members_user ON public.listly_members(user_id);
CREATE INDEX idx_listly_members_list ON public.listly_members(list_id);
CREATE INDEX idx_listly_items_list ON public.listly_items(list_id);
CREATE INDEX idx_listly_items_checked ON public.listly_items(checked);

-- Lookup profile by email for sharing (reuse if exists)
CREATE OR REPLACE FUNCTION public.lookup_profile_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE email = lower(p_email) LIMIT 1;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.listly_items;
