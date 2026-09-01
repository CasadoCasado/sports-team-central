import { useSession } from "@/hooks/use-session";

/**
 * Si el usuario tiene el rol global `admin`.
 *
 * Era una llamada a la función SQL `has_role`; ahora viene resuelto en
 * `/auth/me/`, así que no hace falta una petición aparte.
 */
export function useIsAdmin() {
  const { user } = useSession();
  return !!user?.is_admin;
}
