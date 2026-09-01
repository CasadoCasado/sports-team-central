import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { fetchUser, hasSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Sin tokens no hace falta ni preguntar al servidor.
    if (!hasSession()) throw redirect({ to: "/auth" });

    const user = await fetchUser();
    if (!user) throw redirect({ to: "/auth" });

    // El onboarding se decide con el perfil, que ya viene en /auth/me/.
    const onboarded = user.profile?.onboarding_completed;
    if (!onboarded && location.pathname !== "/onboarding") {
      throw redirect({ to: "/onboarding" });
    }
    if (onboarded && location.pathname === "/onboarding") {
      throw redirect({ to: "/inicio" });
    }
    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  // El onboarding se pinta sin el armazón, para que la primera vez sea limpia.
  if (pathname === "/onboarding") {
    return <Outlet />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
