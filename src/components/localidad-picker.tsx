/**
 * Desplegable con buscador de los municipios de España.
 *
 * Sirve para situar un torneo al crearlo y para buscar torneos fuera de casa.
 * La lista entera (unos ocho mil, del INE) llega una vez de
 * `/api/localidades/` y se busca aquí, sin tildes ni mayúsculas; solo se
 * pintan las primeras coincidencias para que el desplegable no se atasque.
 * El valor es el código INE del municipio, que es lo que guarda el backend.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";

import { normalizar, useLocalidades, type Localidad } from "@/lib/localidades";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MAX_RESULTADOS = 60;

/** Lo que empieza por lo escrito va antes que lo que solo lo contiene. */
function buscar(localidades: Localidad[], texto: string): Localidad[] {
  const q = normalizar(texto);
  if (!q) return localidades.slice(0, MAX_RESULTADOS);
  const exactas: Localidad[] = [];
  const empiezan: Localidad[] = [];
  const palabra: Localidad[] = [];
  const contienen: Localidad[] = [];
  for (const l of localidades) {
    const i = l.clave.indexOf(q);
    if (i < 0) continue;
    if (l.clave === q) exactas.push(l);
    else if (i === 0) empiezan.push(l);
    else if (/[\s/'-]/.test(l.clave[i - 1])) palabra.push(l);
    else contienen.push(l);
  }
  return [...exactas, ...empiezan, ...palabra, ...contienen].slice(0, MAX_RESULTADOS);
}

export function LocalidadPicker({
  id,
  label,
  value,
  onChange,
  placeholder,
  todas = false,
  className,
}: {
  id?: string;
  /** Nombre accesible, cuando no hay un `<Label htmlFor>` que lo dé. */
  label?: string;
  /** Código INE, o null si no hay ninguna elegida. */
  value: string | null;
  onChange: (codigo: string | null) => void;
  placeholder?: string;
  /** Añade «Todas las localidades» arriba, para quitar el filtro. */
  todas?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const { data: localidades = [], isLoading } = useLocalidades();

  const elegida = useMemo(
    () => (value ? localidades.find((l) => l.codigo === value) : undefined),
    [localidades, value],
  );
  const resultados = useMemo(() => buscar(localidades, texto), [localidades, texto]);
  const hayMas = resultados.length === MAX_RESULTADOS;

  function elegir(codigo: string | null) {
    onChange(codigo);
    setOpen(false);
    setTexto("");
  }

  return (
    // `modal` para que la rueda del ratón funcione también dentro de un Dialog.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          id={id}
          aria-label={label}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
        >
          <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn("min-w-0 flex-1 truncate", !elegida && "text-muted-foreground")}>
            {elegida
              ? `${elegida.nombre} (${elegida.provincia})`
              : (placeholder ?? t("torneos.localidadPlaceholder"))}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={texto}
            onValueChange={setTexto}
            placeholder={t("torneos.localidadBuscar")}
          />
          <CommandList>
            {!isLoading && <CommandEmpty>{t("torneos.localidadNinguna")}</CommandEmpty>}
            <CommandGroup>
              {todas && !texto && (
                <CommandItem value="__todas" onSelect={() => elegir(null)}>
                  <Check className={cn(value ? "opacity-0" : "opacity-100")} />
                  {t("torneos.localidadTodas")}
                </CommandItem>
              )}
              {resultados.map((l) => (
                <CommandItem key={l.codigo} value={l.codigo} onSelect={() => elegir(l.codigo)}>
                  <Check className={cn(value === l.codigo ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">{l.nombre}</span>
                  <span className="shrink-0 text-xxs text-muted-foreground">{l.provincia}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {hayMas && (
              <p className="px-3 pb-2 text-xxs text-muted-foreground">
                {t("torneos.localidadMas")}
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
