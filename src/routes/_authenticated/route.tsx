import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }

    // Onboarding check: fetch profile to see if preferred_role is set.
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed && location.pathname !== "/onboarding") {
      throw redirect({ to: "/onboarding" });
    }
    if (profile?.onboarding_completed && location.pathname === "/onboarding") {
      throw redirect({ to: "/inicio" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  // Render onboarding without the shell for a cleaner first-run flow.
  if (pathname === "/onboarding") {
    return <Outlet />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
