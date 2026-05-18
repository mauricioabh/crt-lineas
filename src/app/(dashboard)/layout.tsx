import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { getCurrentRole } from "@/lib/auth";
import { PageEnter } from "@/components/motion/page-enter";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getCurrentRole();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 w-full items-center justify-between px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
            >
              CRT Líneas
            </Link>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {role === "admin" ? "Admin" : "Usuario"}
            </span>
            <Link
              href="/dashboard/setup"
              className="text-sm text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Mis datos
            </Link>
          </div>
          <UserButton />
        </div>
      </header>
      <main className="mx-auto w-full flex-1 px-4 py-4 md:px-6 md:py-6 lg:px-8">
        <PageEnter>{children}</PageEnter>
      </main>
    </div>
  );
}
