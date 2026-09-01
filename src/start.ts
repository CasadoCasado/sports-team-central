import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  // Ya no hace falta el middleware que adjuntaba el token de Supabase a las
  // funciones de servidor: la app habla directamente con la API de Django y
  // es `src/lib/api.ts` quien pone la cabecera Authorization.
  requestMiddleware: [errorMiddleware],
}));
