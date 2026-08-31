import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { firebaseConfig, getDb, getFirebaseAuth, isFirebaseConfigured } from "./lib/firebase";
import { firebaseMessage } from "./lib/firebaseErrors";
import { uid } from "./lib/format";
import { slugify } from "./lib/slug";
import type { Profile, StoreRecord } from "./types";

const SELECTED_STORE_KEY = "caja-selected-store";

interface AuthApi {
  ready: boolean;
  cloud: boolean;
  user: User | null;
  profile: Profile | null;
  selectedStoreId: string | null;
  setSelectedStoreId: (id: string | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  registerOwner: (input: {
    name: string;
    email: string;
    password: string;
    businessName: string;
    storeName: string;
  }) => Promise<void>;
  createStore: (input: {
    name: string;
    cashierEmail?: string;
    cashierPassword?: string;
    cashierName?: string;
  }) => Promise<StoreRecord>;
  updateStore: (
    storeId: string,
    input: { name: string },
  ) => Promise<void>;
  addCashier: (input: {
    storeId: string;
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  removeCashier: (uid: string) => Promise<void>;
  deleteStore: (storeId: string, ownerPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

async function commitDeletes(refs: DocumentReference[]) {
  const db = getDb();
  if (!db || refs.length === 0) return;
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + 400)) batch.delete(ref);
    await batch.commit();
  }
}

async function createCashierProfile(input: {
  email: string;
  password: string;
  name: string;
  businessId: string;
  storeId: string;
}) {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");
  const email = input.email.trim().toLowerCase();
  const secondary = initializeApp(firebaseConfig(), `cashier-${uid()}`);
  const secondaryAuth = getAuth(secondary);
  try {
    const created = await createUserWithEmailAndPassword(secondaryAuth, email, input.password);
    await setDoc(doc(db, "profiles", created.user.uid), {
      uid: created.user.uid,
      email,
      name: input.name.trim() || "Caja",
      role: "cashier",
      businessId: input.businessId,
      storeId: input.storeId,
    } satisfies Profile);
  } finally {
    await firebaseSignOut(secondaryAuth);
    await deleteApp(secondary);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cloud = isFirebaseConfigured();
  const [ready, setReady] = useState(!cloud);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | null>(() =>
    localStorage.getItem(SELECTED_STORE_KEY),
  );

  const setSelectedStoreId = useCallback((id: string | null) => {
    setSelectedStoreIdState(id);
    if (id) localStorage.setItem(SELECTED_STORE_KEY, id);
    else localStorage.removeItem(SELECTED_STORE_KEY);
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setReady(true);
      return;
    }
    return onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (!next) {
        setProfile(null);
        setReady(true);
        return;
      }
      const db = getDb();
      if (!db) {
        setReady(true);
        return;
      }
      const snap = await getDoc(doc(db, "profiles", next.uid));
      const data = snap.data() as Profile | undefined;
      if (data?.disabled) {
        setProfile(null);
        await firebaseSignOut(auth);
        setReady(true);
        return;
      }
      setProfile(data ? { ...data, uid: next.uid } : null);
      if (data?.storeId) setSelectedStoreId(data.storeId);
      setReady(true);
    });
  }, [setSelectedStoreId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    const db = getDb();
    if (!auth || !db) throw new Error("Firebase no está configurado.");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "profiles", cred.user.uid));
    const data = snap.data() as Profile | undefined;
    if (!data || data.disabled) {
      await firebaseSignOut(auth);
      throw new Error("Esta cuenta no tiene acceso. Pedile al dueño que te dé de alta.");
    }
  }, []);

  const registerOwner = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      businessName: string;
      storeName: string;
    }) => {
      const auth = getFirebaseAuth();
      const db = getDb();
      if (!auth || !db) throw new Error("Firebase no está configurado.");
      const email = input.email.trim().toLowerCase();
      let user = auth.currentUser;
      try {
        if (!user || user.email?.toLowerCase() !== email) {
          try {
            const cred = await createUserWithEmailAndPassword(auth, email, input.password);
            user = cred.user;
          } catch (error) {
            const code =
              typeof error === "object" && error && "code" in error
                ? String((error as { code: string }).code)
                : "";
            if (code !== "auth/email-already-in-use") throw error;
            const cred = await signInWithEmailAndPassword(auth, email, input.password);
            user = cred.user;
          }
        }
        const existing = await getDoc(doc(db, "profiles", user.uid));
        if (existing.exists()) {
          throw new Error("Ya tenés cuenta. Entrá con tu correo.");
        }
        const businessId = uid();
        const storeId = uid();
        const slug = `${slugify(input.storeName)}-${storeId.slice(0, 6)}`;
        await setDoc(doc(db, "businesses", businessId), {
          name: input.businessName.trim(),
          ownerId: user.uid,
          createdAt: new Date().toISOString(),
        });
        const profileDoc: Profile = {
          uid: user.uid,
          email,
          name: input.name.trim(),
          role: "owner",
          businessId,
        };
        await setDoc(doc(db, "profiles", user.uid), profileDoc);
        await setDoc(doc(db, "stores", storeId), {
          businessId,
          name: input.storeName.trim(),
          slug,
          catalogMode: "shared",
          nextTicket: 1,
        });
        setProfile(profileDoc);
        setSelectedStoreId(storeId);
      } catch (error) {
        throw new Error(firebaseMessage(error));
      }
    },
    [setSelectedStoreId],
  );

  const createStore = useCallback(
    async (input: {
      name: string;
      cashierEmail?: string;
      cashierPassword?: string;
      cashierName?: string;
    }) => {
      const db = getDb();
      const mainAuth = getFirebaseAuth();
      if (!db || !mainAuth || !profile || profile.role !== "owner") {
        throw new Error("Solo el dueño puede crear locales.");
      }
      const storeId = uid();
      const store: StoreRecord = {
        id: storeId,
        businessId: profile.businessId,
        name: input.name.trim(),
        slug: `${slugify(input.name)}-${storeId.slice(0, 6)}`,
        catalogMode: "shared",
        nextTicket: 1,
      };
      await setDoc(doc(db, "stores", storeId), {
        businessId: store.businessId,
        name: store.name,
        slug: store.slug,
        catalogMode: "shared",
        nextTicket: store.nextTicket,
      });

      if (input.cashierEmail && input.cashierPassword) {
        await createCashierProfile({
          email: input.cashierEmail,
          password: input.cashierPassword,
          name: input.cashierName || "Caja",
          businessId: profile.businessId,
          storeId,
        });
      }
      return store;
    },
    [profile],
  );

  const updateStore = useCallback(
    async (storeId: string, input: { name: string }) => {
      const db = getDb();
      if (!db || !profile || profile.role !== "owner") {
        throw new Error("Solo el dueño puede editar locales.");
      }
      await updateDoc(doc(db, "stores", storeId), {
        name: input.name.trim(),
      });
    },
    [profile],
  );

  const addCashier = useCallback(
    async (input: { storeId: string; name: string; email: string; password: string }) => {
      if (!profile || profile.role !== "owner") {
        throw new Error("Solo el dueño puede agregar usuarios.");
      }
      try {
        await createCashierProfile({
          email: input.email,
          password: input.password,
          name: input.name,
          businessId: profile.businessId,
          storeId: input.storeId,
        });
      } catch (error) {
        const code =
          typeof error === "object" && error && "code" in error
            ? String((error as { code: string }).code)
            : "";
        if (code === "auth/email-already-in-use") {
          throw new Error("Ese correo ya tiene cuenta. Usá otro para este cajero.");
        }
        throw new Error(firebaseMessage(error));
      }
    },
    [profile],
  );

  const removeCashier = useCallback(
    async (uid: string) => {
      const db = getDb();
      if (!db || !profile || profile.role !== "owner") {
        throw new Error("Solo el dueño puede quitar usuarios.");
      }
      await updateDoc(doc(db, "profiles", uid), { disabled: true, storeId: null });
    },
    [profile],
  );

  const deleteStore = useCallback(
    async (storeId: string, ownerPassword: string) => {
      const db = getDb();
      const auth = getFirebaseAuth();
      const current = auth?.currentUser;
      if (!db || !auth || !current?.email || !profile || profile.role !== "owner") {
        throw new Error("Solo el dueño puede eliminar un local.");
      }
      try {
        await reauthenticateWithCredential(
          current,
          EmailAuthProvider.credential(current.email, ownerPassword),
        );
      } catch (error) {
        throw new Error(firebaseMessage(error));
      }

      const [people, inventory, sessions, products] = await Promise.all([
        getDocs(query(collection(db, "profiles"), where("businessId", "==", profile.businessId))),
        getDocs(query(collection(db, "inventory"), where("businessId", "==", profile.businessId))).catch(
          () => ({ docs: [] as never[] }),
        ),
        getDocs(query(collection(db, "sessions"), where("businessId", "==", profile.businessId))).catch(
          () => ({ docs: [] as never[] }),
        ),
        getDocs(query(collection(db, "products"), where("businessId", "==", profile.businessId))),
      ]);
      const cashiers = people.docs.filter((d) => d.data().storeId === storeId);
      const ownProducts = products.docs.filter((d) => d.data().storeId === storeId);
      const storeInventory = inventory.docs.filter((d) => d.data().storeId === storeId);
      const storeSessions = sessions.docs.filter((d) => d.data().storeId === storeId);

      for (const snap of cashiers) {
        await updateDoc(snap.ref, { disabled: true, storeId: null });
      }
      try {
        await commitDeletes([
          ...storeInventory.map((d) => d.ref),
          ...storeSessions.map((d) => d.ref),
          ...ownProducts.map((d) => d.ref),
          doc(db, "stores", storeId),
        ]);
      } catch {
        await updateDoc(doc(db, "stores", storeId), { deleted: true });
      }
      if (selectedStoreId === storeId) setSelectedStoreId(null);
    },
    [profile, selectedStoreId, setSelectedStoreId],
  );

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await firebaseSignOut(auth);
    setProfile(null);
  }, []);

  const api = useMemo<AuthApi>(
    () => ({
      ready,
      cloud,
      user,
      profile,
      selectedStoreId: profile?.storeId || selectedStoreId,
      setSelectedStoreId,
      signIn,
      registerOwner,
      createStore,
      updateStore,
      addCashier,
      removeCashier,
      deleteStore,
      signOut,
    }),
    [
      ready,
      cloud,
      user,
      profile,
      selectedStoreId,
      setSelectedStoreId,
      signIn,
      registerOwner,
      createStore,
      updateStore,
      addCashier,
      removeCashier,
      deleteStore,
      signOut,
    ],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
