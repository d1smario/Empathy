import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthSetPasswordForm } from "@/components/access/AuthSetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New password",
  description: "Set a new password after the link you received by email.",
};

export default async function AuthSetPasswordPage() {
  const t = await getTranslations("AuthSetPasswordPage");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 py-16 text-white">
      <div className="text-center">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.35em] text-gray-500">Access</p>
        <h1 className="mt-3 text-xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-400">
          {t("subtitle")}
        </p>
      </div>
      <AuthSetPasswordForm />
    </main>
  );
}
