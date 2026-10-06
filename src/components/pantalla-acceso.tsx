/**
 * El marco de las pantallas sin sesión que no son la de entrar: el logo, el
 * título con el idioma y el tema, y el contenido en una columna estrecha.
 */

import type React from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { LOGO_URL } from "@/lib/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";

export function PantallaAcceso({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-3">
            <img
              src={LOGO_URL}
              alt="TeamUp"
              className="size-8 object-contain"
              width={32}
              height={32}
            />
            <span className="text-display text-lg font-extrabold uppercase tracking-tight">
              {t("app.name")}
            </span>
          </Link>
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-display text-2xl font-black tracking-tight sm:text-3xl">
              {titulo}
            </h1>
            <div className="flex items-center gap-2">
              <LangToggle />
              <ThemeToggle />
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
