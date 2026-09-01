import { useEffect, useState } from "react";

import { type AuthUser, fetchUser, getCachedUser, hasSession, onAuthStateChange } from "@/lib/auth";

/**
 * El usuario autenticado y su perfil.
 *
 * Antes esto venía de `supabase.auth.getSession()` más una consulta a
 * `profiles`; ahora `/auth/me/` devuelve las dos cosas de una vez, así que
 * `user.profile` está siempre disponible.
 */
export function useSession() {
  const [user, setUser] = useState<AuthUser | null>(() => getCachedUser());
  const [loading, setLoading] = useState(() => !getCachedUser() && hasSession());

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!hasSession()) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const next = await fetchUser();
      if (!mounted) return;
      setUser(next);
      setLoading(false);
    };

    void load();
    const { unsubscribe } = onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
        return;
      }
      void fetchUser(true).then((next) => mounted && setUser(next));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return { user, profile: user?.profile ?? null, loading };
}
