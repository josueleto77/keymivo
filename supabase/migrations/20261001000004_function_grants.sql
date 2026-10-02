-- Lock down SECURITY DEFINER functions: nothing is callable anonymously; trigger functions
-- aren't callable at all; signed-in users get only the helpers RLS needs and the app RPCs.

revoke execute on function
  public.current_profile_id(), public.current_org_id(), public.is_super_admin(), public.is_org_staff(),
  public.can_access_org(uuid),
  public.complete_onboarding(text,text,text,text,text,text,text),
  public.seed_demo_data(), public.remove_demo_data(),
  public.handle_new_user(), public.log_entity_created(), public.log_showing_status(),
  public.log_preference_update()
from public, anon, authenticated;

grant execute on function
  public.current_profile_id(), public.current_org_id(), public.is_super_admin(), public.is_org_staff(),
  public.can_access_org(uuid),
  public.complete_onboarding(text,text,text,text,text,text,text),
  public.seed_demo_data(), public.remove_demo_data()
to authenticated;
