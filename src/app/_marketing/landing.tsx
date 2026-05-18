"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  BarChart3,
  LayoutList,
  Layers,
  Lock,
  Puzzle,
  Radar,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion/reveal";

const featureCards = [
  {
    title: "Operación primero",
    body: "Tabla clara por empresa y link, con estados y notas para auditoría operativa.",
    icon: LayoutList,
    accent:
      "from-emerald-500/25 via-emerald-400/10 to-transparent dark:from-emerald-400/20 dark:via-emerald-500/10",
    iconWrap:
      "bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:bg-emerald-400/15 dark:text-emerald-300 dark:ring-emerald-400/30",
    ring: "ring-emerald-200/80 hover:ring-emerald-300/90 dark:ring-emerald-500/35 dark:hover:ring-emerald-400/50",
    bg: "bg-emerald-50/75 dark:bg-emerald-950/40",
  },
  {
    title: "Patrones extensibles",
    body: "Empieza con el patrón genérico y agrega flujos específicos por operadora sin reescribir el sistema.",
    icon: Puzzle,
    accent:
      "from-sky-500/25 via-sky-400/10 to-transparent dark:from-sky-400/20 dark:via-sky-500/10",
    iconWrap:
      "bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:bg-sky-400/15 dark:text-sky-300 dark:ring-sky-400/30",
    ring: "ring-sky-200/80 hover:ring-sky-300/90 dark:ring-sky-500/35 dark:hover:ring-sky-400/50",
    bg: "bg-sky-50/75 dark:bg-sky-950/40",
  },
  {
    title: "Roles y seguridad",
    body: "Admin sincroniza y configura; usuarios ven solo empresas habilitadas. Menos ruido, más control.",
    icon: ShieldCheck,
    accent:
      "from-violet-500/25 via-violet-400/10 to-transparent dark:from-violet-400/20 dark:via-violet-500/10",
    iconWrap:
      "bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:bg-violet-400/15 dark:text-violet-300 dark:ring-violet-400/30",
    ring: "ring-violet-200/80 hover:ring-violet-300/90 dark:ring-violet-500/35 dark:hover:ring-violet-400/50",
    bg: "bg-violet-50/75 dark:bg-violet-950/40",
  },
] as const;

const quickViewItems = [
  {
    text: "Sincronización desde CRT (solo enlaces tipo Persona)",
    icon: RefreshCw,
    card: "bg-emerald-50/80 ring-emerald-200/90 dark:bg-emerald-950/35 dark:ring-emerald-500/40",
    iconWrap:
      "bg-emerald-500/20 text-emerald-800 ring-emerald-400/40 dark:bg-emerald-400/20 dark:text-emerald-200 dark:ring-emerald-400/35",
  },
  {
    text: "Verificación por CURP con espera semimanual (captcha friendly)",
    icon: UserRoundSearch,
    card: "bg-sky-50/80 ring-sky-200/90 dark:bg-sky-950/35 dark:ring-sky-500/40",
    iconWrap:
      "bg-sky-500/20 text-sky-800 ring-sky-400/40 dark:bg-sky-400/20 dark:text-sky-200 dark:ring-sky-400/35",
  },
  {
    text: "Estados: activo / inactivo / pendiente + notas y manual review",
    icon: Layers,
    card: "bg-amber-50/85 ring-amber-200/90 dark:bg-amber-950/30 dark:ring-amber-500/40",
    iconWrap:
      "bg-amber-500/20 text-amber-900 ring-amber-400/40 dark:bg-amber-400/20 dark:text-amber-200 dark:ring-amber-400/35",
  },
  {
    text: "Control de visibilidad por empresa (enabled) para usuarios",
    icon: SlidersHorizontal,
    card: "bg-violet-50/85 ring-violet-200/90 dark:bg-violet-950/35 dark:ring-violet-500/40",
    iconWrap:
      "bg-violet-500/20 text-violet-800 ring-violet-400/40 dark:bg-violet-400/20 dark:text-violet-200 dark:ring-violet-400/35",
  },
] as const;

export function Landing() {
  return (
    <div className="min-h-screen bg-linear-to-b from-emerald-50/35 via-zinc-50 to-sky-50/40 text-zinc-900 dark:from-emerald-950/25 dark:via-zinc-950 dark:to-sky-950/25 dark:text-zinc-50">
      <header className="border-b border-emerald-200/40 bg-white/75 backdrop-blur dark:border-emerald-500/20 dark:bg-zinc-950/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Reveal delay={0.05} className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-sky-600 text-white shadow-sm ring-1 ring-white/30 dark:ring-white/10">
              <Radar className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              CRT Líneas
            </span>
          </Reveal>
          <Reveal delay={0.12} className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "hidden sm:inline-flex",
              )}
            >
              Iniciar sesión
            </Link>
            <Link
              href="/sign-up"
              className={buttonVariants({ variant: "default" })}
            >
              Crear cuenta
            </Link>
          </Reveal>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="absolute left-[12%] top-[-120px] h-[380px] w-[380px] rounded-full bg-emerald-400/25 blur-3xl dark:bg-emerald-500/15" />
            <div className="absolute right-[8%] top-[40%] h-[320px] w-[320px] rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/12" />
            <div className="absolute bottom-[-180px] left-1/2 h-[440px] w-[440px] -translate-x-1/2 rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-500/12" />
          </div>

          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
            <div className="space-y-6">
              <Reveal delay={0.05}>
                <Badge
                  variant="secondary"
                  className="w-fit border-violet-200/80 bg-violet-100/70 text-violet-900 dark:border-violet-500/35 dark:bg-violet-950/50 dark:text-violet-200"
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Monitoreo semiautomatizado
                </Badge>
              </Reveal>
              <Reveal delay={0.12}>
                <h1 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">
                  Monitorea líneas del{" "}
                  <span className="bg-linear-to-r from-emerald-600 via-sky-600 to-violet-600 bg-clip-text text-transparent dark:from-emerald-400 dark:via-sky-400 dark:to-violet-400">
                    portal CRT
                  </span>{" "}
                  con trazabilidad y control
                </h1>
              </Reveal>
              <Reveal delay={0.18}>
                <p className="text-pretty text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                  Sincroniza operadoras desde el CRT, verifica por CURP cuando
                  el portal lo permite y registra resultados para revisión
                  operativa. Diseñado para equipos internos que necesitan
                  visibilidad clara y acciones rápidas.
                </p>
              </Reveal>
              <Reveal
                delay={0.24}
                className="flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <Link
                  href="/sign-in"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "sm:px-8 transition-transform hover:-translate-y-0.5",
                  )}
                >
                  Entrar al dashboard
                </Link>
                <Link
                  href="/sign-up"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "transition-transform hover:-translate-y-0.5",
                  )}
                >
                  Crear cuenta
                </Link>
              </Reveal>
              <Reveal delay={0.3} className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full bg-sky-100/90 px-3 py-1.5 text-sky-900 ring-1 ring-sky-200/90 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-500/35">
                  <Lock className="h-3.5 w-3.5" />
                  Acceso con cuentas y roles
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100/90 px-3 py-1.5 text-emerald-900 ring-1 ring-emerald-200/90 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-500/35">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Estado por empresa y link
                </span>
              </Reveal>
            </div>

            <Reveal delay={0.16}>
              <Card className="border-zinc-200/60 bg-white/85 p-6 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-100/60 backdrop-blur dark:border-zinc-700/60 dark:bg-zinc-950/70 dark:shadow-sky-500/5 dark:ring-emerald-500/15">
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        Vista rápida
                      </p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                        Lo que verás al entrar al dashboard.
                      </p>
                    </div>
                    <Badge className="shrink-0 border-violet-200/80 bg-violet-100 text-violet-900 dark:border-violet-500/40 dark:bg-violet-950/60 dark:text-violet-200">
                      v0.1
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    {quickViewItems.map((item) => {
                      const QIcon = item.icon;
                      return (
                        <motion.div
                          key={item.text}
                          whileHover={{
                            y: -2,
                            transition: {
                              type: "spring",
                              stiffness: 400,
                              damping: 24,
                            },
                          }}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-4 py-3 ring-1 transition-shadow hover:shadow-sm",
                            item.card,
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
                              item.iconWrap,
                            )}
                          >
                            <QIcon className="h-4 w-4" aria-hidden />
                          </div>
                          <p className="min-w-0 flex-1 text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
                            {item.text}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Nota: en algunos alojamientos en la nube el navegador no
                    puede ejecutarse junto con la app; en producción suele hacer
                    falta un servidor dedicado.
                  </p>
                </div>
              </Card>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-zinc-200 bg-linear-to-b from-white via-zinc-50/80 to-white dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-900/40 dark:to-zinc-950">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <Reveal delay={0.02} className="mb-8 max-w-2xl">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Por qué CRT Líneas
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Mismo estilo que la vista previa del dashboard: claridad, color
                y micro‑interacciones.
              </p>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-3 md:items-stretch">
              {featureCards.map((f, idx) => {
                const Icon = f.icon;
                return (
                  <Reveal
                    key={f.title}
                    delay={0.06 + idx * 0.1}
                    className="h-full min-h-0"
                  >
                    <motion.article
                      initial={false}
                      whileHover={{
                        y: -6,
                        transition: {
                          type: "spring",
                          stiffness: 380,
                          damping: 22,
                        },
                      }}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        "relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl p-6 shadow-sm ring-1 transition-shadow duration-300 hover:shadow-md",
                        f.ring,
                        f.bg,
                      )}
                    >
                      <div
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-linear-to-br blur-2xl",
                          f.accent,
                        )}
                      />
                      <div className="relative flex flex-1 flex-col gap-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1",
                              f.iconWrap,
                            )}
                          >
                            <Icon className="h-5 w-5" aria-hidden />
                          </div>
                          <p className="min-w-0 flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {f.title}
                          </p>
                        </div>
                        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {f.body}
                        </p>
                      </div>
                    </motion.article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-violet-200/50 bg-linear-to-r from-violet-50/70 via-sky-50/50 to-emerald-50/70 dark:border-violet-500/20 dark:from-violet-950/40 dark:via-sky-950/30 dark:to-emerald-950/35">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <Reveal delay={0.05}>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    ¿Listo para empezar?
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    Entra al dashboard y corre tu primera sincronización desde
                    CRT.
                  </p>
                </div>
              </Reveal>
              <Reveal
                delay={0.12}
                className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
              >
                <Link
                  href="/sign-in"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "sm:px-8 transition-transform hover:-translate-y-0.5",
                  )}
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/sign-up"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "transition-transform hover:-translate-y-0.5",
                  )}
                >
                  Crear cuenta
                </Link>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200/80 bg-white/90 py-8 dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          <p className="font-medium text-zinc-600 dark:text-zinc-300">
            CRT Líneas
          </p>
          <p className="mt-1">by Wayool</p>
        </div>
      </footer>
    </div>
  );
}
