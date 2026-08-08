import React, { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "../styles.css";
import { request as apiRequest } from "../services/http";
import { REFRESH_KEY, TOKEN_KEY, USER_KEY } from "../config/app";
import { getSavedUser } from "../services/recents";
import { Shell } from "./Shell";
import { AuthScreen } from "../features/auth/AuthScreen";
import { ActionLoader } from "../components/ActionLoader";
import { ConfirmationDialog } from "../components/ConfirmationDialog";

function lazyPage(load, name) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}

const Dashboard = lazyPage(() => import("../features/dashboard/Dashboard"), "Dashboard");
const Foods = lazyPage(() => import("../features/foods/Foods"), "Foods");
const CreateCatalog = lazyPage(() => import("../features/catalog/CreateCatalog"), "CreateCatalog");
const ConfigureFood = lazyPage(() => import("../features/foods/ConfigureFood"), "ConfigureFood");
const Scanner = lazyPage(() => import("../features/scanner/Scanner"), "Scanner");
const History = lazyPage(() => import("../features/history/History"), "History");
const Profile = lazyPage(() => import("../features/profile/Profile"), "Profile");

function PageLoader() {
  return <section className="page"><div className="catalog-status" role="status">Cargando…</div></section>;
}

export function App() {
  const [page, setPageRaw] = useState(() => (localStorage.getItem(TOKEN_KEY) ? "dashboard" : "login"));
  const pageRef = useRef(page);
  pageRef.current = page;

  function setPage(next) {
    setPageRaw(next);
    window.history.pushState({ scalegramsPage: next }, "");
  }
  const [user, setUser] = useState(() => getSavedUser(USER_KEY));
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const actionSequence = useRef(0);
  const pendingActions = useRef(new Map());
  const confirmationResolver = useRef(null);

  const api = useMemo(
    () => ({
      request: apiRequest,
      async runAction(loading, operation, options = {}) {
        if (options.quiet) return operation();
        const id = actionSequence.current + 1;
        actionSequence.current = id;
        pendingActions.current.set(id, loading);
        setActionLoading(loading);
        try {
          return await operation();
        } finally {
          pendingActions.current.delete(id);
          const activeActions = [...pendingActions.current.values()];
          setActionLoading(activeActions[activeActions.length - 1] || null);
        }
      },
      confirm(options) {
        return new Promise((resolve) => {
          confirmationResolver.current = resolve;
          setConfirmation(options);
        });
      },
      notify() {},
    }),
    [],
  );

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [page]);

  function saveSession(payload) {
    localStorage.setItem(TOKEN_KEY, payload.token);
    if (payload.refreshToken) localStorage.setItem(REFRESH_KEY, payload.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    setUser(payload.user);
    setPage("dashboard");
  }

  function logout() {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      api
        .request("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) })
        .catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setPage("login");
  }

  function resolveConfirmation(confirmed) {
    const resolve = confirmationResolver.current;
    confirmationResolver.current = null;
    setConfirmation(null);
    resolve?.(confirmed);
  }

  useEffect(() => {
    const expireSession = () => {
      logout();
      api.notify("Tu sesión venció. Volvé a ingresar.", "error");
    };
    window.addEventListener("scalegrams:session-expired", expireSession);
    return () => window.removeEventListener("scalegrams:session-expired", expireSession);
  }, [api]);

  useEffect(() => {
    let lastExitAttempt = 0;
    const onPopState = (event) => {
      const state = event.state;
      if (state && typeof state.scalegramsPage === "string") {
        setPageRaw(state.scalegramsPage);
        return;
      }
      if (!localStorage.getItem(TOKEN_KEY)) return;
      const now = Date.now();
      if (now - lastExitAttempt < 2000) return;
      lastExitAttempt = now;
      window.history.pushState({ scalegramsPage: pageRef.current }, "");
      api.notify("Tocá atrás de nuevo para salir");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [api]);

  const authenticated = Boolean(localStorage.getItem(TOKEN_KEY));
  useEffect(() => {
    if (!authenticated) {
      document.title = "Ingresar | ScaleGrams";
      return;
    }
    const titles = { dashboard: "Mi día", foods: "Alimentos", create: "Crear", configure: "Configurar alimento", scanner: "Escáner", history: "Historial", profile: "Perfil" };
    document.title = `${titles[page] || "ScaleGrams"} | ScaleGrams`;
  }, [authenticated, page]);

  return (
    <>
      {authenticated ? (
        <Shell user={user} page={page} setPage={setPage} logout={logout}>
          <Suspense fallback={<PageLoader />}>
            {page === "dashboard" && <Dashboard api={api} user={user} setPage={setPage} />}
            {page === "foods" && <Foods api={api} user={user} setPage={setPage} setSelectedFoodId={setSelectedFoodId} />}
            {page === "create" && <CreateCatalog api={api} setPage={setPage} prefillBarcode={prefillBarcode} clearPrefillBarcode={() => setPrefillBarcode("")} />}
            {page === "configure" && <ConfigureFood api={api} setPage={setPage} foodId={selectedFoodId} user={user} />}
            {page === "scanner" && <Scanner api={api} setPage={setPage} setSelectedFoodId={setSelectedFoodId} setPrefillBarcode={setPrefillBarcode} />}
            {page === "history" && <History api={api} />}
            {page === "profile" && <Profile api={api} logout={logout} />}
          </Suspense>
        </Shell>
      ) : (
        <AuthScreen api={api} page={page} setPage={setPage} saveSession={saveSession} notify={api.notify} />
      )}
      {actionLoading && <ActionLoader {...actionLoading} />}
      {confirmation && <ConfirmationDialog {...confirmation} onCancel={() => resolveConfirmation(false)} onConfirm={() => resolveConfirmation(true)} />}
    </>
  );
}
