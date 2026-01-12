-- =============================================
-- MUSCLE GROUPS SEED DATA
-- =============================================

-- Front muscles
INSERT INTO public.muscle_groups (id, name, name_ar, svg_path, category) VALUES
  ('chest', 'Chest', 'صدر', 'M180,120 L220,120 L220,180 L180,180 Z', 'front'),
  ('abs', 'Abs', 'بطن', 'M180,180 L220,180 L220,240 L180,240 Z', 'front'),
  ('front-shoulders', 'Front Shoulders', 'كتف أمامي', 'M160,100 L180,120 L180,140 L160,130 Z', 'front'),
  ('biceps', 'Biceps', 'باي', 'M140,140 L160,140 L160,180 L140,180 Z', 'front'),
  ('forearms', 'Forearms', 'ساعد', 'M140,180 L160,180 L160,220 L140,220 Z', 'front'),
  ('quads', 'Quadriceps', 'فخذ أمامي', 'M170,240 L190,240 L190,320 L170,320 Z', 'front'),
  ('calves-front', 'Calves', 'سمانة', 'M175,320 L185,320 L185,380 L175,380 Z', 'front');

-- Back muscles
INSERT INTO public.muscle_groups (id, name, name_ar, svg_path, category) VALUES
  ('upper-back', 'Upper Back', 'ظهر علوي', 'M180,100 L220,100 L220,140 L180,140 Z', 'back'),
  ('lats', 'Lats', 'ظهر جانبي', 'M160,140 L180,140 L180,200 L160,180 Z', 'back'),
  ('lower-back', 'Lower Back', 'أسفل الظهر', 'M180,200 L220,200 L220,240 L180,240 Z', 'back'),
  ('rear-shoulders', 'Rear Shoulders', 'كتف خلفي', 'M160,100 L180,100 L180,120 L160,115 Z', 'back'),
  ('triceps', 'Triceps', 'تراي', 'M140,140 L160,140 L160,180 L140,180 Z', 'back'),
  ('glutes', 'Glutes', 'مؤخرة', 'M175,240 L195,240 L195,270 L175,270 Z', 'back'),
  ('hamstrings', 'Hamstrings', 'فخذ خلفي', 'M170,270 L190,270 L190,320 L170,320 Z', 'back'),
  ('calves-back', 'Calves', 'سمانة', 'M175,320 L185,320 L185,380 L175,380 Z', 'back');

-- Core
INSERT INTO public.muscle_groups (id, name, name_ar, svg_path, category) VALUES
  ('obliques', 'Obliques', 'جوانب', 'M160,180 L180,180 L180,220 L165,220 Z', 'core');

-- =============================================
-- SAMPLE ADMIN USER (for testing)
-- Note: You'll need to create this user in Supabase Auth first,
-- then update this with the actual UUID
-- =============================================

-- Example:
-- INSERT INTO public.profiles (id, name, email, role, active) VALUES
--   ('your-auth-user-uuid-here', 'Admin User', 'admin@example.com', 'admin', true);
