"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  initialCurpMasked: string | null;
  initialPhoneMasked: string | null;
};

function setSpanishValidity(
  event: React.InvalidEvent<HTMLInputElement>,
  message: string,
) {
  event.currentTarget.setCustomValidity(message);
}

function clearInputValidity(event: React.ChangeEvent<HTMLInputElement>) {
  event.currentTarget.setCustomValidity("");
}

export function VerificationSetupForm({
  initialCurpMasked,
  initialPhoneMasked,
}: Props) {
  const router = useRouter();
  const [curp, setCurp] = useState("");
  const [phone, setPhone] = useState("");
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hasCurrentProfile = Boolean(initialCurpMasked || initialPhoneMasked);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/me/verification-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curp, phone, privacyNoticeAccepted }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    const confirmed = window.confirm(
      "Esto eliminará tus datos de verificación guardados. No podrás verificar líneas hasta ingresarlos de nuevo. ¿Continuar?",
    );
    if (!confirmed) return;

    setError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/me/verification-profile", {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No se pudo eliminar el perfil");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Datos de verificación</CardTitle>
        <CardDescription>
          Estos datos se usan exclusivamente para consultar portales de
          operadoras. Se guardan cifrados; nadie más puede verlos en texto
          claro.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {hasCurrentProfile && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Registro actual:{" "}
              {initialCurpMasked && (
                <span className="font-mono">{initialCurpMasked}</span>
              )}
              {initialCurpMasked && initialPhoneMasked ? " · " : null}
              {initialPhoneMasked && (
                <span className="font-mono">{initialPhoneMasked}</span>
              )}
              . Ingresa valores nuevos para actualizar.
            </p>
          )}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              CURP
            </span>
            <input
              type="text"
              name="curp"
              autoComplete="off"
              spellCheck={false}
              maxLength={18}
              value={curp}
              onChange={(e) => {
                clearInputValidity(e);
                setCurp(e.target.value.toUpperCase());
              }}
              onInvalid={(e) =>
                setSpanishValidity(e, "Ingresa tu CURP (18 caracteres).")
              }
              placeholder="18 caracteres"
              required
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Celular (10 dígitos)
            </span>
            <input
              type="tel"
              name="phone"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={15}
              value={phone}
              onChange={(e) => {
                clearInputValidity(e);
                setPhone(e.target.value);
              }}
              onInvalid={(e) =>
                setSpanishValidity(
                  e,
                  "Ingresa tu número de celular (10 dígitos).",
                )
              }
              placeholder="5512345678"
              required
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="flex gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={privacyNoticeAccepted}
              onChange={(e) => {
                clearInputValidity(e);
                setPrivacyNoticeAccepted(e.target.checked);
              }}
              onInvalid={(e) =>
                setSpanishValidity(e, "Debes aceptar el aviso de privacidad.")
              }
              required
              className="mt-1 size-4 rounded border-zinc-300"
            />
            <span>
              Acepto que mis datos se usen para verificar líneas en portales de
              operadoras, conforme al{" "}
              <Link
                href="/aviso-privacidad"
                target="_blank"
                className="font-medium underline underline-offset-4"
              >
                aviso de privacidad
              </Link>
              .
            </span>
          </label>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <div className="flex w-full flex-col gap-2">
            <Button
              type="submit"
              disabled={pending || deleting}
              className="w-full"
            >
              {pending ? "Guardando…" : "Guardar y continuar"}
            </Button>
            {hasCurrentProfile && (
              <Button
                type="button"
                variant="destructive"
                disabled={pending || deleting}
                className="w-full"
                onClick={onDelete}
              >
                {deleting ? "Eliminando…" : "Eliminar mis datos guardados"}
              </Button>
            )}
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
