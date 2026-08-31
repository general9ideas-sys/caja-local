import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function LoginPage() {
  const { cloud, user, profile, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!cloud) return <Navigate to="/caja" replace />;
  if (user && profile) {
    return <Navigate to={profile.role === "owner" ? "/panel" : "/caja"} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
    } catch {
      setError("No se pudo entrar. Revisá el correo y la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl bg-card p-8 shadow-[0_10px_15px_rgba(0,0,0,0.08)]"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Caja Local</p>
        <h1 className="font-display mt-1 text-2xl font-bold">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dueño: ves todos los locales. Caja: cobrás en un local.
        </p>
        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}
        <label className="mt-5 block text-sm font-semibold" htmlFor="email">
          Correo
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input mt-1"
          required
        />
        <label className="mt-3 block text-sm font-semibold" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input mt-1"
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="focus-ring mt-5 min-h-10 w-full rounded-xl bg-primary text-sm font-bold text-on-primary"
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿Primera vez?{" "}
          <Link to="/registro" className="font-bold text-primary">
            Crear negocio
          </Link>
        </p>
      </form>
    </div>
  );
}

export function RegisterPage() {
  const { cloud, user, profile, registerOwner } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!cloud) return <Navigate to="/caja" replace />;
  if (user && profile) return <Navigate to="/panel" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await registerOwner({ name, email, password, businessName, storeName });
      navigate("/panel", { replace: true });
    } catch {
      setError("No se pudo crear la cuenta. El correo puede estar en uso.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl bg-card p-8 shadow-[0_10px_15px_rgba(0,0,0,0.08)]"
      >
        <h1 className="font-display text-2xl font-bold">Crear negocio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vas a ser el dueño. Después podés sumar más locales y cajeros.
        </p>
        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}
        {[
          ["name", "Tu nombre", name, setName],
          ["businessName", "Nombre del negocio", businessName, setBusinessName],
          ["storeName", "Primer local", storeName, setStoreName],
          ["email", "Correo", email, setEmail],
        ].map(([id, label, value, set]) => (
          <div key={id as string} className="mt-3">
            <label className="block text-sm font-semibold" htmlFor={id as string}>
              {label as string}
            </label>
            <input
              id={id as string}
              type={id === "email" ? "email" : "text"}
              value={value as string}
              onChange={(e) => (set as (v: string) => void)(e.target.value)}
              className="field-input mt-1"
              required
            />
          </div>
        ))}
        <label className="mt-3 block text-sm font-semibold" htmlFor="password">
          Contraseña (6 caracteres o más)
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input mt-1"
          minLength={6}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="focus-ring mt-5 min-h-10 w-full rounded-xl bg-primary text-sm font-bold text-on-primary"
        >
          {busy ? "Creando…" : "Crear y entrar"}
        </button>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="font-bold text-primary">
            Ya tengo cuenta
          </Link>
        </p>
      </form>
    </div>
  );
}
