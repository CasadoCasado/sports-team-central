/**
 * Las provincias (`/api/provincias/`) y los municipios de España
 * (`/api/localidades/`), por su código INE. Llegan una vez por sesión y no
 * caducan: el INE los cambia una vez al año. Ver `components/ubicacion-picker`.
 */

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

/** `[código INE, nombre, provincia]`. */
type Fila = [string, string, string];

export type Localidad = {
  codigo: string;
  nombre: string;
  provincia: string;
  /** Nombre sin tildes ni mayúsculas, para buscar. */
  clave: string;
};

export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Fuera del hook para que React Query no repita el `map` de ocho mil filas en
// cada render: solo lo rehace si cambia la referencia de `select`.
const aLocalidades = (filas: Fila[]): Localidad[] =>
  filas.map(([codigo, nombre, provincia]) => ({
    codigo,
    nombre,
    provincia,
    clave: normalizar(nombre),
  }));

export function useLocalidades() {
  return useQuery({
    queryKey: ["localidades"],
    queryFn: () => api.get<Fila[]>("/localidades/"),
    staleTime: Infinity,
    gcTime: Infinity,
    select: aLocalidades,
  });
}

export type Provincia = {
  codigo: string;
  nombre: string;
  clave: string;
};

const aProvincias = (filas: [string, string][]): Provincia[] =>
  filas.map(([codigo, nombre]) => ({ codigo, nombre, clave: normalizar(nombre) }));

/** Las 52 provincias, por nombre (`/api/provincias/`). */
export function useProvincias() {
  return useQuery({
    queryKey: ["provincias"],
    queryFn: () => api.get<[string, string][]>("/provincias/"),
    staleTime: Infinity,
    gcTime: Infinity,
    select: aProvincias,
  });
}

/** Los dos primeros dígitos del código de un municipio son su provincia. */
export const provinciaDe = (localidad: string | null) => (localidad ? localidad.slice(0, 2) : null);
