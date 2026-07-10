import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PlaceholderPage } from "./placeholder";

export const Route = createFileRoute("/_authenticated/encuestas")({
  component: () => {
    const { t } = useTranslation();
    return <PlaceholderPage title={t("nav.encuestas")} />;
  },
});
