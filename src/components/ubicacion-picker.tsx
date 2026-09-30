/**
 * Desplegables con buscador de provincia y de municipio.
 *
 * Un torneo se sitúa en un municipio y se busca por provincia y, dentro de
 * ella, por municipio; un perfil solo dice su provincia. Las listas llegan
 * una vez (ver `lib/localidades`) y se buscan aquí, sin tildes ni mayúsculas.
 * De los municipios, unos ocho mil, solo se pintan las primeras coincidencias
 * para que el desplegable no se atasque. El valor es siempre el código INE,
 * que es lo que guarda el backend.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Map as MapIcon, MapPin, type LucideIcon } from "lucide-react";

import { normalizar, useLocalidades, useProvincias } from "@/lib/localidades";
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

type Opcion = {
  codigo: string;
  nombre: string;
  /** Sin tildes ni mayúsculas, para buscar. */
  clave: string;
  /** Lo que se pinta a la derecha, en gris: la provincia de un municipio. */
  detalle?: string;
};

/** Lo que empieza por lo escrito va antes que lo que solo lo contiene. */
function buscar(opciones: Opcion[], texto: string): Opcion[] {
  const q = normalizar(texto);
  if (!q) return opciones.slice(0, MAX_RESULTADOS);
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
  return [...exactas, ...empiezan, ...palabra, ...contienen].slice(0, MAX_RESULTADOS);
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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");

  const elegida = useMemo(
    () => (value ? opciones.find((o) => o.codigo === value) : undefined),
    [opciones, value],
  );
  const resultados = useMemo(() => buscar(opciones, texto), [opciones, texto]);
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
                  {o.detalle && (
                    <span className="shrink-0 text-xxs text-muted-foreground">{o.detalle}</span>
                  )}
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

/**
 * Con `provincia`, solo los municipios de esa provincia; sin ella, todos, con
 * la provincia al lado para distinguir los que se llaman igual.
 */
export function LocalidadPicker({
  provincia,
  ...props
}: ComunProps & { provincia?: string | null }) {
  const { t } = useTranslation();
  const { data = [], isLoading } = useLocalidades();
  const opciones = useMemo(
    () =>
      data
        .filter((l) => !provincia || l.codigo.startsWith(provincia))
        .map((l) => ({ ...l, detalle: provincia ? undefined : l.provincia })),
    [data, provincia],
  );
  return (
    <BuscadorDesplegable
      placeholder={props.todas ? undefined : t("torneos.localidadPlaceholder")}
      {...props}
      opciones={opciones}
      cargando={isLoading}
      elegidaTexto={(o) => (o.detalle ? `${o.nombre} (${o.detalle})` : o.nombre)}
      buscarPlaceholder={t("torneos.localidadBuscar")}
      sinResultados={t("torneos.localidadNinguna")}
      icon={MapPin}
    />
  );
}
