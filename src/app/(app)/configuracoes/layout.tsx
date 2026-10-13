import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "./tabs";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Configurações" description="Empresa, equipe e personalização do CRM." />
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </>
  );
}
