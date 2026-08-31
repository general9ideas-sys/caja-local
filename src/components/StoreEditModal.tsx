import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import type { Profile, StoreRecord } from "../types";

interface StoreEditModalProps {
  store: StoreRecord;
  cashiers: Profile[];
  onClose: () => void;
  onSaveName: (name: string) => Promise<void>;
  onOpenCaja: () => void;
  onAddCashier: (input: { name: string; email: string; password: string }) => Promise<void>;
  onRemoveCashier: (uid: string) => Promise<void>;
  onDeleteStore: (ownerPassword: string) => Promise<void>;
}

export function StoreEditModal({
  store,
  cashiers,
  onClose,
  onSaveName,
  onOpenCaja,
  onAddCashier,
  onRemoveCashier,
  onDeleteStore,
}: StoreEditModalProps) {
  const [name, setName] = useState(store.name);
  const [cashierName, setCashierName] = useState("");
  const [cashierEmail, setCashierEmail] = useState("");
  const [cashierPassword, setCashierPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar.");
    } finally {
      setBusy(false);
    }
  }

  function saveName(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await onSaveName(name.trim());
    });
  }

  function addUser(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await onAddCashier({
        name: cashierName,
        email: cashierEmail,
        password: cashierPassword,
      });
      setCashierName("");
      setCashierEmail("");
      setCashierPassword("");
    });
  }

  function deleteStore(e: FormEvent) {
    e.preventDefault();
    if (confirmName.trim() !== store.name) {
      setError("Escribí el nombre del local tal cual para confirmar.");
      return;
    }
    void run(async () => {
      await onDeleteStore(ownerPassword);
      onClose();
    });
  }

  return (
    <Modal open title={store.name} onClose={onClose} wide>
      {error ? (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={onOpenCaja}
        className="focus-ring min-h-10 w-full rounded-xl bg-primary text-sm font-bold text-on-primary"
      >
        Abrir caja
      </button>

      <form onSubmit={saveName} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-sm font-semibold">
          Nombre del local
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input mt-1"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="focus-ring min-h-10 rounded-xl bg-muted px-4 text-sm font-bold"
        >
          Guardar nombre
        </button>
      </form>

      <h3 className="font-display mt-6 text-base font-semibold">Usuarios</h3>
      {cashiers.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Todavía no hay cajeros en este local.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {cashiers.map((person) => (
            <li
              key={person.uid}
              className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2 text-sm"
            >
              <div>
                <p className="font-semibold">{person.name}</p>
                <p className="text-xs text-muted-foreground">{person.email}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`¿Quitar a ${person.name} de ${store.name}?`)) return;
                  void run(() => onRemoveCashier(person.uid));
                }}
                className="focus-ring rounded-lg px-2 py-1 text-xs font-bold text-destructive hover:bg-card"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addUser} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Nombre
          <input
            value={cashierName}
            onChange={(e) => setCashierName(e.target.value)}
            className="field-input mt-1"
            required
          />
        </label>
        <label className="text-sm font-semibold">
          Correo
          <input
            type="email"
            value={cashierEmail}
            onChange={(e) => setCashierEmail(e.target.value)}
            className="field-input mt-1"
            required
          />
        </label>
        <label className="sm:col-span-2 text-sm font-semibold">
          Contraseña (6 caracteres o más)
          <input
            type="password"
            value={cashierPassword}
            onChange={(e) => setCashierPassword(e.target.value)}
            className="field-input mt-1"
            minLength={6}
            required
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="focus-ring min-h-9 rounded-xl bg-foreground px-4 text-sm font-bold text-on-primary"
          >
            {busy ? "Agregando…" : "Agregar usuario"}
          </button>
        </div>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        Con ese correo el cajero entra directo a la caja de este local.
      </p>

      <div className="mt-6 border-t border-border pt-4">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(true);
              setError("");
            }}
            className="focus-ring min-h-9 rounded-xl px-3 text-sm font-bold text-destructive hover:bg-red-50"
          >
            Eliminar local
          </button>
        ) : (
          <form onSubmit={deleteStore} className="space-y-3">
            <p className="text-sm text-destructive">
              Se elimina {store.name}. Los cajeros de este local no van a poder entrar. Las ventas
              ya hechas quedan en el resumen.
            </p>
            <label className="block text-sm font-semibold">
              Escribí <span className="font-bold">{store.name}</span> para confirmar
              <input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="field-input mt-1"
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              Tu contraseña de dueño
              <input
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                className="field-input mt-1"
                required
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="focus-ring min-h-9 rounded-xl bg-destructive px-4 text-sm font-bold text-white"
              >
                {busy ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  setOwnerPassword("");
                  setConfirmName("");
                  setError("");
                }}
                className="focus-ring min-h-9 rounded-xl bg-muted px-4 text-sm font-bold"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
