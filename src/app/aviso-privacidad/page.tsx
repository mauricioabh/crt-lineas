import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aviso de privacidad | CRT Líneas",
  description:
    "Aviso de privacidad para el uso de CURP y celular en CRT Líneas.",
};

const sections = [
  {
    title: "Responsable",
    body: "CRT Líneas es responsable del tratamiento de los datos personales ingresados en esta herramienta. Antes de operar en producción, completa aquí la razón social, domicilio y correo oficial del responsable.",
  },
  {
    title: "Datos que recabamos",
    body: "Para verificar líneas telefónicas solicitamos CURP y número celular. También guardamos la fecha y versión del aviso de privacidad aceptado.",
  },
  {
    title: "Finalidad",
    body: "Usamos CURP y celular únicamente para consultar portales de operadoras telefónicas y determinar si existen líneas asociadas o procesos de vinculación relacionados con esos datos.",
  },
  {
    title: "Seguridad",
    body: "CURP y celular se cifran antes de guardarse en la base de datos. La aplicación solo los descifra temporalmente en el servidor para ejecutar la verificación solicitada por el usuario autenticado.",
  },
  {
    title: "Transferencias",
    body: "No vendemos ni compartimos estos datos para publicidad. Durante la verificación, los datos pueden ser enviados al portal de la operadora correspondiente porque ese envío es necesario para realizar la consulta solicitada.",
  },
  {
    title: "Conservación",
    body: "Los datos se conservan mientras la cuenta necesite verificar líneas. El usuario puede solicitar corrección o eliminación conforme a los derechos ARCO.",
  },
  {
    title: "Derechos ARCO",
    body: "El titular puede solicitar acceso, rectificación, cancelación u oposición al tratamiento de sus datos a través del canal de contacto oficial que el responsable defina para esta herramienta.",
  },
  {
    title: "Cambios al aviso",
    body: "Si este aviso cambia de forma importante, se actualizará la versión y se podrá solicitar una nueva aceptación antes de continuar usando la verificación.",
  },
];

export default function PrivacyNoticePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-zinc-900 dark:text-zinc-50">
      <div className="mb-8">
        <Link
          href="/dashboard/setup"
          className="text-sm text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Volver
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Aviso de privacidad
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Versión 2026-05-18. Este texto es una base operativa para el producto;
          debe revisarse con asesoría legal antes de uso público o comercial.
        </p>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="mt-2 leading-7 text-zinc-700 dark:text-zinc-300">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
