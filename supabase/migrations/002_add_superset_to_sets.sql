-- Move superset fields from exercises to exercise_sets
-- This allows individual sets to be part of supersets, not entire exercises

-- Remove superset fields from exercises table (if they exist)
ALTER TABLE public.exercises
DROP COLUMN IF EXISTS superset_group,
DROP COLUMN IF EXISTS superset_order;

-- Add superset fields to exercise_sets table
ALTER TABLE public.exercise_sets
ADD COLUMN superset_group TEXT,
ADD COLUMN superset_order INTEGER DEFAULT 0;

-- Create index for faster superset queries
CREATE INDEX IF NOT EXISTS idx_exercise_sets_superset ON public.exercise_sets(superset_group) WHERE superset_group IS NOT NULL;
