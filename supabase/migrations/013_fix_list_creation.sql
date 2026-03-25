-- Allow owners to see their own lists (needed for insert returning)
CREATE POLICY "Owners can view own lists" ON public.listly_lists
  FOR SELECT USING (auth.uid() = owner_id);
