import React, { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "../styles.css";
import { request as apiRequest } from "../services/http";
import { Shell } from "./Shell";
import { AuthScreen } from "../features/auth/AuthScreen";
import { ActionLoader } from "../components/ActionLoader";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { Notification } from "../components/Notification";
import { History } from "../features/history/History";
import { Profile } from "../features/profile/Profile";

function lazyPage(load, name) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}

const Dashboard = lazyPage(() => import("../features/dashboard/Dashboard"), "Dashboard");
const MyFoodsPage = lazyPage(() => import("../features/foods/MyFoodsPage"), "MyFoodsPage");
const Recipes = lazyPage(() => import("../features/recipes/Recipes"), "Recipes");
const CreateCatalog = lazyPage(() => import("../features/catalog/CreateCatalog"), "CreateCatalog");
const ConfigureFood = lazyPage(() => import("../features/foods/ConfigureFood"), "ConfigureFood");
const Scanner = lazyPage(() => import("../features/scanner/Scanner"), "Scanner");
const TrainingDashboard = lazyPage(() => import("../features/training/TrainingDashboard"), "TrainingDashboard");
const TrainingCalendar = lazyPage(() => import("../features/training/TrainingCalendar"), "TrainingCalendar");
const TrainingProfile = lazyPage(() => import("../features/training/TrainingProfile"), "TrainingProfile");

function navigationState() {
  const state = window.history.state || {};
  const mode = state.scalegramsMode === "training" ? "training" : "nutrition";
  return { mode, page: typeof state.scalegramsPage === "string" ? state.scalegramsPage : null };
}

function PageLoader({ page, mode }) {
  const labels = {
    dashboard: ["Cargando día", "Estamos preparando tu resumen diario..."],
    "my-foods": ["Cargando alimentos", "Estamos preparando el catálogo personal..."],
    recipes: ["Cargando recetas", "Estamos preparando la biblioteca de recetas..."],
    configure: ["Cargando alimento", "Estamos preparando sus datos nutricionales..."],
    scanner: ["Cargando Registrar", "Estamos preparando las opciones de registro..."],
    "training-dashboard": ["Cargando día", "Estamos preparando tu resumen de actividad..."],
    "training-calendar": ["Cargando calendario", "Estamos preparando tus sesiones..."],
    "training-profile": ["Cargando ejercicios", "Estamos preparando el catálogo personal y base..."],
  };
  const [title, description] = labels[page] || ["Cargando vista", "Estamos preparando la información..."];
  return <ActionLoader title={title} description={description} mode={mode} />;
}

export function App() {
  const initialNavigation = navigationState();
  const [page, setPageRaw] = useState(() => initialNavigation.page || "login");
  const [mode, setModeRaw] = useState(() => initialNavigation.mode);
  const pageRef = useRef(page);
  const modeRef = useRef(mode);
  const nutritionPageRef = useRef(mode === "nutrition" ? page : "dashboard");
  const trainingPageRef = useRef(mode === "training" ? page : "training-dashboard");
  pageRef.current = page;
  modeRef.current = mode;

  function pushNavigation(nextMode, nextPage, replace = false) {
    window.history[replace ? "replaceState" : "pushState"]({ ...(window.history.state || {}), scalegramsMode: nextMode, scalegramsPage: nextPage }, "");
  }

  function setPage(next) {
    setPageRaw(next);
    if (modeRef.current === "training") trainingPageRef.current = next;
    else nutritionPageRef.current = next;
    pushNavigation(modeRef.current, next);
  }

  function setMode(nextMode) {
    if (nextMode === modeRef.current) return;
    const nextPage = nextMode === "training"
      ? trainingPageRef.current || "training-dashboard"
      : nutritionPageRef.current === "login" ? "dashboard" : nutritionPageRef.current || "dashboard";
    setModeRaw(nextMode);
    setPageRaw(nextPage);
    if (nextMode === "training") trainingPageRef.current = nextPage;
    else nutritionPageRef.current = nextPage;
    pushNavigation(nextMode, nextPage);
  }
  const [user, setUser] = useState(null);
  const [sessionState, setSessionState] = useState("checking");
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [notification, setNotification] = useState(null);
  const actionSequence = useRef(0);
  const pendingActions = useRef(new Map());
  const confirmationResolver = useRef(null);
  const notify = React.useCallback((message, tone = "success") => {
    if (message) setNotification({ message, tone });
  }, []);

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
      notify,
    }),
    [notify],
  );

  useEffect(() => {
    if (!notification) return undefined;
    const timeout = window.setTimeout(() => setNotification(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [mode, page]);

  function saveSession(payload) {
    if (!payload?.user) throw new Error("La respuesta de autenticación no contiene el usuario.");
    setUser(payload.user);
    setSessionState("authenticated");
    window.dispatchEvent(new Event("scalegrams:session-updated"));
    setModeRaw("nutrition");
    nutritionPageRef.current = "dashboard";
    setPageRaw("dashboard");
    pushNavigation("nutrition", "dashboard");
  }

  function logout() {
    api.request("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setSessionState("anonymous");
    setPage("login");
  }

  function resolveConfirmation(confirmed) {
    const resolve = confirmationResolver.current;
    confirmationResolver.current = null;
    setConfirmation(null);
    resolve?.(confirmed);
  }

  useEffect(() => {
    let active = true;
    api.request("/api/auth/me", { skipAuthRefresh: true }).then((sessionUser) => {
      if (!active) return;
      setUser(sessionUser);
      setSessionState("authenticated");
      if (pageRef.current === "login") {
        setModeRaw("nutrition");
        nutritionPageRef.current = "dashboard";
        setPageRaw("dashboard");
        pushNavigation("nutrition", "dashboard", true);
      }
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setSessionState("anonymous");
      setPageRaw("login");
    });
    return () => { active = false; };
  }, [api]);

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
        const nextMode = state.scalegramsMode === "training" ? "training" : "nutrition";
        setModeRaw(nextMode);
        setPageRaw(state.scalegramsPage);
        if (nextMode === "training") trainingPageRef.current = state.scalegramsPage;
        else nutritionPageRef.current = state.scalegramsPage;
        return;
      }
      if (sessionState !== "authenticated") return;
      const now = Date.now();
      if (now - lastExitAttempt < 2000) return;
      lastExitAttempt = now;
      pushNavigation(modeRef.current, pageRef.current);
      api.notify("Tocá atrás de nuevo para salir");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [api, sessionState]);

  const authenticated = sessionState === "authenticated";
  useEffect(() => {
    if (!authenticated) {
      document.title = "Ingresar | ScaleGrams";
      return;
    }
    const titles = { dashboard: "Día", "my-foods": "Alimentos", recipes: "Recetas", configure: "Configurar alimento", scanner: "Registrar", history: "Historial", profile: "Perfil", "training-dashboard": "Día", "training-calendar": "Calendario de entrenamiento", "training-profile": "Ejercicios" };
    document.title = `${titles[page] || "ScaleGrams"} | ScaleGrams`;
  }, [authenticated, mode, page]);

  return (
    <>
      {authenticated ? (
        <Shell user={user} page={page} mode={mode} setPage={setPage} setMode={setMode} logout={logout}>
          <Suspense fallback={<PageLoader page={page} mode={mode} />}>
            {page === "dashboard" && <Dashboard api={api} user={user} setPage={setPage} />}
            {page === "configure" && <ConfigureFood api={api} setPage={setPage} foodId={selectedFoodId} user={user} />}
            {["scanner", "recipes", "my-foods"].includes(page) && (
              <Scanner
                api={api}
                initialDialog={page === "scanner" ? null : page}
                user={user}
                setPage={setPage}
                setSelectedFoodId={setSelectedFoodId}
                setPrefillBarcode={setPrefillBarcode}
                CatalogComponent={CreateCatalog}
                RecipesComponent={Recipes}
                MyFoodsComponent={MyFoodsPage}
              />
            )}
            {page === "history" && <History api={api} />}
            {page === "profile" && <Profile api={api} logout={logout} mode={mode} />}
            {page === "training-dashboard" && <TrainingDashboard api={api} setPage={setPage} />}
            {page === "training-calendar" && <TrainingCalendar api={api} />}
            {page === "training-profile" && <TrainingProfile api={api} />}
          </Suspense>
        </Shell>
      ) : (
        <AuthScreen api={api} page={page} setPage={setPage} saveSession={saveSession} />
      )}
      {actionLoading && <ActionLoader {...actionLoading} mode={mode} />}
      {confirmation && <ConfirmationDialog {...confirmation} mode={mode} onCancel={() => resolveConfirmation(false)} onConfirm={() => resolveConfirmation(true)} />}
      {notification && <Notification message={notification.message} tone={notification.tone} onDismiss={() => setNotification(null)} />}
    </>
  );
}
