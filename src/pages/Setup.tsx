import { Link } from "react-router-dom";
import { isFirebaseConfigured } from "../lib/firebase";

export function SetupPage() {
  const ready = isFirebaseConfigured();

  return (
    <div className="min-h-dvh bg-background p-6">
      <div className="mx-auto max-w-2xl rounded-2xl bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Proyecto ventalocales
        </p>
        <h1 className="font-display mt-1 text-2xl font-bold">Conectar la nube</h1>
        {ready ? (
          <p className="mt-3 text-sm text-primary">
            Las claves de la app web ya están en esta PC. Falta activar correo y la base de datos
            en Firebase, después{" "}
            <Link to="/registro" className="font-bold underline">
              crear el negocio
            </Link>
            .
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Reiniciá la app (cerrá y volvé a abrir <code>npm run dev</code>) para cargar las
            claves.
          </p>
        )}

        <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm">
          <li>
            En Firebase, menú <strong>Compilación → Authentication</strong> → Comenzar →{" "}
            <strong>Correo/contraseña</strong> → Activar → Guardar.
          </li>
          <li>
            Menú <strong>Compilación → Firestore Database</strong> → Crear base → modo producción →
            ubicación <code>southamerica-east1</code> (São Paulo) o la más cercana.
          </li>
          <li>
            En Firestore, pestaña <strong>Reglas</strong>: borralo y pegá el archivo{" "}
            <code>firestore.rules</code> de este proyecto → Publicar.
          </li>
          <li>
            En Authentication → Settings → Authorized domains, agregá{" "}
            <code>general9ideas-sys.github.io</code> (dejá <code>localhost</code>).
          </li>
        </ol>

        <p className="mt-5 text-sm text-muted-foreground">
          Cuando termines esos cuatro pasos, volvé acá y avisame: te indico cómo crear el negocio
          y los locales.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/registro"
            className="focus-ring inline-flex min-h-10 items-center rounded-xl bg-primary px-4 text-sm font-bold text-on-primary"
          >
            Crear negocio
          </Link>
          <Link
            to="/caja"
            className="focus-ring inline-flex min-h-10 items-center rounded-xl bg-muted px-4 text-sm font-bold"
          >
            Seguir en esta PC
          </Link>
        </div>
      </div>
    </div>
  );
}
