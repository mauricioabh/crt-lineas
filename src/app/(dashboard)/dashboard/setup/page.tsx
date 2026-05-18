import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { VerificationSetupForm } from "@/app/(dashboard)/dashboard/setup/setup-form";
import { getVerificationProfileStatus } from "@/lib/verification-profile";

export default async function VerificationSetupPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  let status = {
    complete: false,
    curpMasked: null as string | null,
    phoneMasked: null as string | null,
  };
  try {
    status = await getVerificationProfileStatus(userId);
  } catch {
    // Sin clave de cifrado: el formulario mostrará error al guardar.
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Datos de verificación
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Ingresa los datos que se usarán para consultar automáticamente los
          portales de las operadoras.
        </p>
      </div>
      <VerificationSetupForm
        initialCurpMasked={status.curpMasked}
        initialPhoneMasked={status.phoneMasked}
      />
    </div>
  );
}
