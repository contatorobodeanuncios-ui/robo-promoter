
-- Recreate missing triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_access_request ON auth.users;
CREATE TRIGGER on_auth_user_created_access_request
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_access_request();

-- Backfill: create profiles for users who don't have one
INSERT INTO public.profiles (id, display_name, email, phone, status)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name',
           u.raw_user_meta_data->>'name',
           split_part(u.email, '@', 1)),
  u.email,
  u.raw_user_meta_data->>'phone',
  'pending'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Backfill access_requests too
INSERT INTO public.access_requests (user_id, email, display_name, status)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name',
           u.raw_user_meta_data->>'name',
           split_part(u.email, '@', 1)),
  'pending'
FROM auth.users u
LEFT JOIN public.access_requests ar ON ar.user_id = u.id
WHERE ar.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Reconcile: any access_request already approved => ensure profile approved
UPDATE public.profiles p
   SET status = 'approved'
  FROM public.access_requests ar
 WHERE ar.user_id = p.id
   AND ar.status = 'approved'
   AND p.status IS DISTINCT FROM 'approved';

-- Reconcile bans
UPDATE public.profiles p
   SET status = 'banned'
  FROM public.access_requests ar
 WHERE ar.user_id = p.id
   AND ar.status = 'rejected'
   AND p.status IS DISTINCT FROM 'banned';
