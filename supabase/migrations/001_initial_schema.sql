-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES TABLE (extends auth.users)
-- =============================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'coach', 'admin')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

create table user_set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  workout_id uuid references workouts(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete cascade,
  set_number integer not null,
  weight decimal(6,2),  -- e.g., 102.5 kg
  reps integer not null,
  rpe integer,  -- optional: rate of perceived exertion (1-10)
  completed_at timestamp with time zone default now(),
  notes text,
  
  unique(user_id, workout_id, exercise_id, set_number, completed_at::date)
);


create table exercise_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid references exercises(id) on delete cascade,
  set_number int not null,
  target_weight decimal,
  target_reps int,
  rest_seconds int default 60,
  created_at timestamp with time zone default now(),
  unique(exercise_id, set_number)
);


-- =============================================
-- COACHES TABLE
-- =============================================
CREATE TABLE public.coaches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- COACH-USER ASSIGNMENTS
-- =============================================
CREATE TABLE public.coach_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID REFERENCES public.coaches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, user_id)
);

-- =============================================
-- PROGRAMS
-- =============================================
CREATE TABLE public.programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  weeks INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES public.profiles(id),
  duplicated_from UUID REFERENCES public.programs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- WORKOUTS
-- =============================================
CREATE TABLE public.workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- EXERCISES
-- =============================================
CREATE TABLE public.exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID REFERENCES public.workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  video_provider TEXT NOT NULL CHECK (video_provider IN ('youtube', 'vimeo', 'custom')),
  video_id TEXT NOT NULL,
  target_muscles TEXT[] NOT NULL,
  assisting_muscles TEXT[],
  sets INTEGER,
  reps TEXT,
  rest_seconds INTEGER,
  notes TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- USER-PROGRAM ASSIGNMENTS
-- =============================================
CREATE TABLE public.user_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, program_id)
);

-- =============================================
-- USER EXERCISE PROGRESS
-- =============================================
CREATE TABLE public.user_exercise_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  synced BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exercise_id, completed_at)
);

-- =============================================
-- USER WORKOUT PROGRESS
-- =============================================
CREATE TABLE public.user_workout_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES public.workouts(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  synced BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, workout_id, completed_at)
);

-- =============================================
-- MUSCLE GROUPS REFERENCE
-- =============================================
CREATE TABLE public.muscle_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  svg_path TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('front', 'back', 'core'))
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_workouts_program ON public.workouts(program_id);
CREATE INDEX idx_workouts_week_day ON public.workouts(week_number, day_number);
CREATE INDEX idx_exercises_workout ON public.exercises(workout_id);
CREATE INDEX idx_user_programs_user ON public.user_programs(user_id);
CREATE INDEX idx_user_programs_program ON public.user_programs(program_id);
CREATE INDEX idx_user_exercise_progress_user ON public.user_exercise_progress(user_id);
CREATE INDEX idx_user_exercise_progress_exercise ON public.user_exercise_progress(exercise_id);
CREATE INDEX idx_user_workout_progress_user ON public.user_workout_progress(user_id);
CREATE INDEX idx_user_workout_progress_workout ON public.user_workout_progress(workout_id);
CREATE INDEX idx_coach_users_coach ON public.coach_users(coach_id);
CREATE INDEX idx_coach_users_user ON public.coach_users(user_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- =============================================
-- FUNCTIONS FOR UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON public.exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exercise_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workout_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muscle_groups ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES POLICIES
-- =============================================

-- Users can view their own profile
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Coaches can view assigned users' profiles
CREATE POLICY "Coaches view assigned users" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT cu.user_id FROM public.coach_users cu
      JOIN public.coaches c ON c.id = cu.coach_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Admins can view all profiles
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can update their own profile
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Coaches can update assigned users (enable/disable)
CREATE POLICY "Coaches update assigned users" ON public.profiles
  FOR UPDATE USING (
    id IN (
      SELECT cu.user_id FROM public.coach_users cu
      JOIN public.coaches c ON c.id = cu.coach_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins update all profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- COACHES POLICIES
-- =============================================

-- Admins can view all coaches
CREATE POLICY "Admins view all coaches" ON public.coaches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Coaches can view their own coach record
CREATE POLICY "Coaches view own record" ON public.coaches
  FOR SELECT USING (user_id = auth.uid());

-- Admins can manage coaches
CREATE POLICY "Admins manage coaches" ON public.coaches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- COACH_USERS POLICIES
-- =============================================

-- Coaches can view their assigned users
CREATE POLICY "Coaches view assigned users" ON public.coach_users
  FOR SELECT USING (
    coach_id IN (
      SELECT id FROM public.coaches WHERE user_id = auth.uid()
    )
  );

-- Coaches can assign users
CREATE POLICY "Coaches manage assignments" ON public.coach_users
  FOR ALL USING (
    coach_id IN (
      SELECT id FROM public.coaches WHERE user_id = auth.uid()
    )
  );

-- Admins can view and manage all assignments
CREATE POLICY "Admins manage all assignments" ON public.coach_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- PROGRAMS POLICIES
-- =============================================

-- Users can view assigned programs
CREATE POLICY "Users view assigned programs" ON public.programs
  FOR SELECT USING (
    id IN (
      SELECT program_id FROM public.user_programs
      WHERE user_id = auth.uid()
    )
  );

-- Coaches can view and manage their own programs
CREATE POLICY "Coaches manage own programs" ON public.programs
  FOR ALL USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'coach'
    )
  );

-- Admins can view and manage all programs
CREATE POLICY "Admins manage all programs" ON public.programs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- WORKOUTS POLICIES
-- =============================================

-- Users can view workouts from assigned programs
CREATE POLICY "Users view assigned workouts" ON public.workouts
  FOR SELECT USING (
    program_id IN (
      SELECT program_id FROM public.user_programs
      WHERE user_id = auth.uid()
    )
  );

-- Coaches can manage workouts in their programs
CREATE POLICY "Coaches manage workouts" ON public.workouts
  FOR ALL USING (
    program_id IN (
      SELECT id FROM public.programs WHERE created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

-- =============================================
-- EXERCISES POLICIES
-- =============================================

-- Users can view exercises from assigned workouts
CREATE POLICY "Users view assigned exercises" ON public.exercises
  FOR SELECT USING (
    workout_id IN (
      SELECT w.id FROM public.workouts w
      JOIN public.user_programs up ON up.program_id = w.program_id
      WHERE up.user_id = auth.uid()
    )
  );

-- Coaches can manage exercises in their workouts
CREATE POLICY "Coaches manage exercises" ON public.exercises
  FOR ALL USING (
    workout_id IN (
      SELECT w.id FROM public.workouts w
      JOIN public.programs p ON p.id = w.program_id
      WHERE p.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

-- =============================================
-- USER_PROGRAMS POLICIES
-- =============================================

-- Users can view their program assignments
CREATE POLICY "Users view own assignments" ON public.user_programs
  FOR SELECT USING (user_id = auth.uid());

-- Coaches can assign programs to their users
CREATE POLICY "Coaches assign programs" ON public.user_programs
  FOR ALL USING (
    user_id IN (
      SELECT cu.user_id FROM public.coach_users cu
      JOIN public.coaches c ON c.id = cu.coach_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Admins can manage all assignments
CREATE POLICY "Admins manage all program assignments" ON public.user_programs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- USER_EXERCISE_PROGRESS POLICIES
-- =============================================

-- Users can view and manage their own progress
CREATE POLICY "Users manage own exercise progress" ON public.user_exercise_progress
  FOR ALL USING (user_id = auth.uid());

-- Coaches can view their users' progress
CREATE POLICY "Coaches view user exercise progress" ON public.user_exercise_progress
  FOR SELECT USING (
    user_id IN (
      SELECT cu.user_id FROM public.coach_users cu
      JOIN public.coaches c ON c.id = cu.coach_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Admins can view all progress
CREATE POLICY "Admins view all exercise progress" ON public.user_exercise_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- USER_WORKOUT_PROGRESS POLICIES
-- =============================================

-- Users can view and manage their own workout progress
CREATE POLICY "Users manage own workout progress" ON public.user_workout_progress
  FOR ALL USING (user_id = auth.uid());

-- Coaches can view their users' workout progress
CREATE POLICY "Coaches view user workout progress" ON public.user_workout_progress
  FOR SELECT USING (
    user_id IN (
      SELECT cu.user_id FROM public.coach_users cu
      JOIN public.coaches c ON c.id = cu.coach_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Admins can view all workout progress
CREATE POLICY "Admins view all workout progress" ON public.user_workout_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- MUSCLE_GROUPS POLICIES (READ-ONLY FOR ALL)
-- =============================================

CREATE POLICY "Everyone can view muscle groups" ON public.muscle_groups
  FOR SELECT USING (true);
