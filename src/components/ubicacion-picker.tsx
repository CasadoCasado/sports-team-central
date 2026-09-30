/**
 * Desplegable con buscador de provincia.
 *
 * Un torneo se sitúa en una provincia y se busca por ella; un perfil dice la
 * suya. La lista llega una vez (ver `lib/localidades`) y se busca aquí, sin
 * tildes ni mayúsculas. El valor es el código INE, que es lo que guarda el
 * backend.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Map as MapIcon, type LucideIcon } from "lucide-react";

import { normalizar, useProvincias } from "@/lib/localidades";
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

type Opcion = {
  codigo: string;
  nombre: string;
  /** Sin tildes ni mayúsculas, para buscar. */
  clave: string;
};

/** Lo que empieza por lo escrito va antes que lo que solo lo contiene. */
function buscar(opciones: Opcion[], texto: string): Opcion[] {
  const q = normalizar(texto);
  if (!q) return opciones;
  const exactas: Opcion[] = [];
  const empiezan: Opcion[] = [];
  const palabra: Opcion[] = [];
  const contienen: Opcion[] = [];
  for (const o of opciones) {
    const i = o.clave.indexOf(q);
    if (i < 0) continue;
    if (o.clave === q) exactas.push(o);
    else if (i === 0) empiezan.push(o);
    else if (/[\s/'-]/.test(o.clave[i - 1])) palabra.push(o);
    else contienen.push(o);
  }
  return [...exactas, ...empiezan, ...palabra, ...contienen];
}

type ComunProps = {
  id?: string;
  /** Nombre accesible, cuando no hay un `<Label htmlFor>` que lo dé. */
  label?: string;
  /** Código INE, o null si no hay nada elegido. */
  value: string | null;
  onChange: (codigo: string | null) => void;
  placeholder?: string;
  /** Texto de la opción de arriba que deja el valor vacío (quitar el filtro). */
  todas?: string;
  className?: string;
};

function BuscadorDesplegable({
  id,
  label,
  value,
  onChange,
  placeholder,
  todas,
  className,
  opciones,
  cargando,
  elegidaTexto,
  buscarPlaceholder,
  sinResultados,
  icon: Icon,
}: ComunProps & {
  opciones: Opcion[];
  cargando: boolean;
  elegidaTexto: (o: Opcion) => string;
  buscarPlaceholder: string;
  sinResultados: string;
  icon: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");

  const elegida = useMemo(
    () => (value ? opciones.find((o) => o.codigo === value) : undefined),
    [opciones, value],
  );
  const resultados = useMemo(() => buscar(opciones, texto), [opciones, texto]);

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
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn("min-w-0 flex-1 truncate", !elegida && "text-muted-foreground")}>
            {elegida ? elegidaTexto(elegida) : (placeholder ?? todas)}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={texto} onValueChange={setTexto} placeholder={buscarPlaceholder} />
          <CommandList>
            {!cargando && <CommandEmpty>{sinResultados}</CommandEmpty>}
            <CommandGroup>
              {todas && !texto && (
                <CommandItem value="__todas" onSelect={() => elegir(null)}>
                  <Check className={cn(value ? "opacity-0" : "opacity-100")} />
                  {todas}
                </CommandItem>
              )}
              {resultados.map((o) => (
                <CommandItem key={o.codigo} value={o.codigo} onSelect={() => elegir(o.codigo)}>
                  <Check className={cn(value === o.codigo ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ProvinciaPicker(props: ComunProps) {
  const { t } = useTranslation();
  const { data = [], isLoading } = useProvincias();
  return (
    <BuscadorDesplegable
      placeholder={props.todas ? undefined : t("ubicacion.provinciaPlaceholder")}
      {...props}
      opciones={data}
      cargando={isLoading}
      elegidaTexto={(o) => o.nombre}
      buscarPlaceholder={t("ubicacion.provinciaBuscar")}
      sinResultados={t("ubicacion.provinciaNinguna")}
      icon={MapIcon}
    />
  );
}
