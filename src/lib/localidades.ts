/**
 * Las provincias de España (`/api/provincias/`), por su código INE. Llegan
 * una vez por sesión y no caducan. Ver `components/ubicacion-picker`.
 */

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

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
