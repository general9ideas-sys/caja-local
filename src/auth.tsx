import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseConfig, getDb, getFirebaseAuth, isFirebaseConfigured } from "./lib/firebase";
import { uid } from "./lib/format";
import { slugify } from "./lib/slug";
import type { CatalogMode, Profile, StoreRecord } from "./types";

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
    catalogMode: CatalogMode;
    cashierEmail?: string;
    cashierPassword?: string;
    cashierName?: string;
  }) => Promise<StoreRecord>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

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
      setProfile(data ? { ...data, uid: next.uid } : null);
      if (data?.storeId) setSelectedStoreId(data.storeId);
      setReady(true);
    });
  }, [setSelectedStoreId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase no está configurado.");
    await signInWithEmailAndPassword(auth, email, password);
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
      const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
      const businessId = uid();
      const storeId = uid();
      const slug = `${slugify(input.storeName)}-${storeId.slice(0, 6)}`;
      await setDoc(doc(db, "businesses", businessId), {
        name: input.businessName.trim(),
        ownerId: cred.user.uid,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, "stores", storeId), {
        businessId,
        name: input.storeName.trim(),
        slug,
        catalogMode: "shared",
        nextTicket: 1,
      });
      const profileDoc: Profile = {
        uid: cred.user.uid,
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        role: "owner",
        businessId,
      };
      await setDoc(doc(db, "profiles", cred.user.uid), profileDoc);
      setSelectedStoreId(storeId);
    },
    [setSelectedStoreId],
  );

  const createStore = useCallback(
    async (input: {
      name: string;
      catalogMode: CatalogMode;
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
        catalogMode: input.catalogMode,
        nextTicket: 1,
      };
      await setDoc(doc(db, "stores", storeId), {
        businessId: store.businessId,
        name: store.name,
        slug: store.slug,
        catalogMode: store.catalogMode,
        nextTicket: store.nextTicket,
      });

      if (input.cashierEmail && input.cashierPassword) {
        const secondary = initializeApp(firebaseConfig(), `cashier-${storeId}`);
        const secondaryAuth = getAuth(secondary);
        const created = await createUserWithEmailAndPassword(
          secondaryAuth,
          input.cashierEmail.trim(),
          input.cashierPassword,
        );
        await setDoc(doc(db, "profiles", created.user.uid), {
          uid: created.user.uid,
          email: input.cashierEmail.trim().toLowerCase(),
          name: input.cashierName?.trim() || "Caja",
          role: "cashier",
          businessId: profile.businessId,
          storeId,
        } satisfies Profile);
        await firebaseSignOut(secondaryAuth);
      }
      return store;
    },
    [profile],
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
