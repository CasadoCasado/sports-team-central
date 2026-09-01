import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { FullProfile } from "@/lib/types";

import { useSession } from "./use-session";

/** El perfil completo del usuario actual. */
export function useProfile() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: () => api.get<FullProfile>("/profiles/me/"),
  });
}
