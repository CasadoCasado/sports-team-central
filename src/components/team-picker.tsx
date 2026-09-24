import { useTranslation } from "react-i18next";
import { Picture } from "@/components/picture";
import { Shield, ChevronDown } from "lucide-react";
import { useActiveTeam } from "@/hooks/use-active-team";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Para cambiar de equipo, en las pantallas que enseñan uno solo.
 *
 * Solo sale con dos equipos o más: con uno no hay nada que elegir, y el
 * nombre del equipo ya lo dice cada pantalla donde le toca.
 */
export function TeamPicker() {
  const { t } = useTranslation();
  const { memberships, active, setActiveId } = useActiveTeam();

  if (!active || memberships.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex min-h-9 min-w-0 max-w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors hover:border-primary/40">
        <Picture
          url={active.team.logo_url}
          alt=""
          className="size-5 shrink-0 rounded-sm"
          fallback={<Shield className="size-3.5 text-primary" />}
        />
        <span className="min-w-0 truncate">{active.team.nombre}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-2xs uppercase tracking-widest text-muted-foreground">
          {t("team.switchTeam")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem key={m.team_id} onClick={() => setActiveId(m.team_id)}>
            <div className="flex w-full items-center gap-2">
              <Picture
                url={m.team.logo_url}
                alt=""
                className="size-5 rounded-sm"
                fallback={<Shield className="size-4 text-primary" />}
              />
              <span className="flex-1 truncate">{m.team.nombre}</span>
              <span className="text-2xs uppercase tracking-widest text-muted-foreground">
                {m.role}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
