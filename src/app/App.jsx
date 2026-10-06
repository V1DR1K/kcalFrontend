import { routeAtPath, routePath, safeReturnPath } from "./routes";
import { pageTitle } from "./page-metadata.js";
import { requestWithArchivedAcknowledgement } from "../services/archived-foods";
import { clearSessionDrafts } from "../features/training/session-draft";
import React, { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "../styles.css";
import { request as apiRequest, clearSessionSignal } from "../services/http";
import { Shell } from "./Shell";
import { AuthScreen } from "../features/auth/AuthScreen";
import { DashboardSkeleton, SkeletonRows } from "../components/Loading";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { Notification } from "../components/Notification";
import { Icon } from "../components/Icon";
import { MealShareAcceptDialog } from "../features/dashboard/dialogs/MealShareDialogs";

function lazyPage(load, name) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}

const Dashboard = lazyPage(() => import("../features/dashboard/Dashboard"), "Dashboard");
const History = lazyPage(() => import("../features/history/History"), "History");
const Profile = lazyPage(() => import("../features/profile/Profile"), "Profile");
const MyFoodsPage = lazyPage(() => import("../features/foods/MyFoodsPage"), "MyFoodsPage");
const Recipes = lazyPage(() => import("../features/recipes/Recipes"), "Recipes");
const CreateCatalog = lazyPage(() => import("../features/catalog/CreateCatalog"), "CreateCatalog");
const ConfigureFood = lazyPage(() => import("../features/foods/ConfigureFood"), "ConfigureFood");
const Scanner = lazyPage(() => import("../features/scanner/Scanner"), "Scanner");
const TrainingDashboard = lazyPage(() => import("../features/training/TrainingDashboard"), "TrainingDashboard");
const TrainingCalendar = lazyPage(() => import("../features/training/TrainingCalendar"), "TrainingCalendar");
const CardioPage = lazyPage(() => import("../features/training/CardioPage"), "CardioPage");
const TrainingProfile = lazyPage(() => import("../features/training/TrainingProfile"), "TrainingProfile");
const PlansPage = lazyPage(() => import("../features/plans/PlansPage"), "PlansPage");
const DayPresetsPage = lazyPage(() => import("../features/day-presets/DayPresetsPage"), "DayPresetsPage");

function navigationState() {
  const explicitRoute = routeAtPath(window.location.pathname);
  if (explicitRoute) return explicitRoute;
  const state = window.history.state || {};
  const mode = state.scalegramsMode === "training" ? "training" : "nutrition";
  return { mode, page: typeof state.scalegramsPage === "string" ? state.scalegramsPage : null };
}

function PageLoader({ page, mode }) {
  if (page === "dashboard") return <DashboardSkeleton />;
  return <SkeletonRows count={4} className={`page-skeleton page-skeleton-${page} ${mode === "training" ? "training-skeleton" : ""}`.trim()} label="Cargando vista" />;
}

function SessionRecovery({ onRetry }) {
  return <main className="auth-page"><section className="auth-card">
    <div className="brand auth-brand"><Icon name="scale" className="fill" /><div><strong>ScaleGrams</strong><span>Reconectando</span></div></div>
    <h1>No pudimos comprobar tu sesión</h1>
    <p className="auth-intro">La conexión con ScaleGrams no respondió. Tus datos de acceso siguen protegidos; probá de nuevo cuando tengas conexión.</p>
    <button className="primary" onClick={onRetry}>Reintentar</button>
  </section></main>;
}

export function App() {
  const initialNavigation = navigationState();
  const foodIdRef = useRef(initialNavigation.foodId || null);
  const returnPathRef = useRef(safeReturnPath(new URLSearchParams(window.location.search).get("retorno")) || (routeAtPath(window.location.pathname) ? window.location.pathname + window.location.search : null));
  const [page, setPageRaw] = useState(() => initialNavigation.page || "login");
  const [mode, setModeRaw] = useState(() => initialNavigation.mode);
  const pageRef = useRef(page);
  const modeRef = useRef(mode);
  const nutritionPageRef = useRef(mode === "nutrition" ? page : "dashboard");
  const trainingPageRef = useRef(mode === "training" ? page : "training-dashboard");
  pageRef.current = page;
  modeRef.current = mode;

  function pushNavigation(nextMode, nextPage, replace = false) {
    const params = new URLSearchParams();
    const shared = new URLSearchParams(window.location.search).get("compartir");
    if (shared) params.set("compartir", shared);
    const path = routePath(nextMode, nextPage, foodIdRef.current);
    const { scalegramsModal: _modal, ...state } = window.history.state || {};
    window.history[replace ? "replaceState" : "pushState"]({ ...state, scalegramsMode: nextMode, scalegramsPage: nextPage }, "", `${path}${params.size ? `?${params}` : ""}`);
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
  const userRef = useRef(user);
  userRef.current = user;
  const [sessionState, setSessionState] = useState("checking");
  const [sessionRetry, setSessionRetry] = useState(0);
  const [selectedFoodId, setSelectedFoodIdRaw] = useState(initialNavigation.foodId || null);
  function setSelectedFoodId(id) { foodIdRef.current = id; setSelectedFoodIdRaw(id); }
  const [prefillBarcode, setPrefillBarcode] = useState("");
  const [dayPresetSeed, setDayPresetSeed] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [notification, setNotification] = useState(null);
  const [sharedMealToken, setSharedMealToken] = useState(() => new URLSearchParams(window.location.search).get("compartir") || "");
  const confirmationResolver = useRef(null);
  const confirmationQueue = useRef([]);
  const notify = React.useCallback((message, tone = "success") => {
    if (message) setNotification({ message, tone });
  }, []);

  const api = useMemo(
    () => ({
      request: (path, options) => requestWithArchivedAcknowledgement(apiRequest, queueConfirmation, () => userRef.current?.id, path, options),
      getUserId: () => userRef.current?.id,
      async runAction(_loading, operation) { return operation(); },
      confirm: queueConfirmation,
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
    const returnPath = safeReturnPath(returnPathRef.current);
    const target = returnPath ? routeAtPath(new URL(returnPath, window.location.origin).pathname) : { mode:"nutrition", page:"dashboard" };
    setModeRaw(target.mode); setPageRaw(target.page);
    if (target.foodId) setSelectedFoodId(target.foodId);
    if (target.mode === "training") trainingPageRef.current = target.page;
    else nutritionPageRef.current = target.page;
    pushNavigation(target.mode, target.page, true);
    if (returnPath) window.history.replaceState(window.history.state,"",returnPath);
    returnPathRef.current = null;
  }

  function logout() {
    clearSessionLocally();
    api.request("/api/auth/logout", { method: "POST" }).catch(() => {
      api.notify("La sesión se cerró en este dispositivo, pero no se pudo confirmar su revocación central.", "error");
    });
  }

  function clearSessionLocally(preserveDestination = false) {
    if (preserveDestination) returnPathRef.current = safeReturnPath(window.location.pathname + window.location.search);
    else returnPathRef.current = null;
    clearSessionDrafts();
    clearSessionSignal();
    userRef.current = null;
    confirmationQueue.current.splice(0).forEach(entry => entry.resolve(false));
    confirmationResolver.current?.(false);
    confirmationResolver.current = null;
    setConfirmation(null);
    setUser(null);
    setSessionState("anonymous");
    setPageRaw("login");
    redirectToLogin();
  }

  function redirectToLogin() {
    const params = new URLSearchParams();
    const returnPath = safeReturnPath(returnPathRef.current);
    if (returnPath) params.set("retorno",returnPath);
    const shared = new URLSearchParams(window.location.search).get("compartir");
    if (shared) params.set("compartir",shared);
    window.history.replaceState({scalegramsMode:"nutrition",scalegramsPage:"login"},"",`/ingresar${params.size ? `?${params}` : ""}`);
  }

  function openDayPresets(seed = null) {
    setDayPresetSeed(seed);
    setPage("day-presets");
  }

  function queueConfirmation(options) {
    return new Promise(resolve => {
      confirmationQueue.current.push({ options, resolve });
      showNextConfirmation();
    });
  }
  function showNextConfirmation() {
    if (confirmationResolver.current) return;
    const next = confirmationQueue.current.shift();
    confirmationResolver.current = next?.resolve || null;
    setConfirmation(next?.options || null);
  }
  function resolveConfirmation(confirmed) {
    const resolve = confirmationResolver.current;
    confirmationResolver.current = null;
    setConfirmation(null);
    resolve?.(confirmed);
    showNextConfirmation();
  }

  function clearSharedMeal() {
    setSharedMealToken("");
    const url = new URL(window.location.href);
    url.searchParams.delete("compartir");
    window.history.replaceState({ ...(window.history.state || {}) }, "", `${url.pathname}${url.search}${url.hash}`);
  }

  useEffect(() => {
    let active = true;
    let retryTimer = null;

    function scheduleRetry() {
      retryTimer = window.setTimeout(() => {
        if (active) setSessionRetry((current) => current + 1);
      }, 5000);
    }

    setSessionState("checking");
    api.request("/api/auth/me").then((sessionUser) => {
      if (!active) return;
      setUser(sessionUser);
      setSessionState("authenticated");
      if (pageRef.current === "login") {
        saveSession({user:sessionUser});
      } else pushNavigation(modeRef.current,pageRef.current,true);
    }).catch((error) => {
      if (!active) return;
      if (error?.status === 401 && !error.retryable) {
        setUser(null);
        setSessionState("anonymous");
        setPageRaw("login");
        redirectToLogin();
        return;
      }
      setSessionState("unavailable");
      scheduleRetry();
    });
    return () => { active = false; window.clearTimeout(retryTimer); };
  }, [api, sessionRetry]);

  useEffect(() => {
    const expireSession = () => {
      clearSessionLocally(true);
      api.notify("Tu sesión venció. Volvé a ingresar.", "error");
    };
    window.addEventListener("scalegrams:session-expired", expireSession);
    return () => window.removeEventListener("scalegrams:session-expired", expireSession);
  }, [api]);

  useEffect(() => {
    let lastExitAttempt = 0;
    const onPopState = (event) => {
      const route = routeAtPath(window.location.pathname);
      const state = event.state;
      if (route || (window.location.pathname === "/ingresar" && state?.scalegramsPage)) {
        const target = route || {mode: state.scalegramsMode === "training" ? "training" : "nutrition",page:state.scalegramsPage};
        setModeRaw(target.mode); setPageRaw(target.page);
        if (target.foodId) setSelectedFoodId(target.foodId);
        if (target.mode === "training") trainingPageRef.current = target.page;
        else nutritionPageRef.current = target.page;
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
    document.title = `${pageTitle(mode, page)} | ScaleGrams`;
  }, [authenticated, mode, page]);

  return (
    <>
      {sessionState === "checking" ? <PageLoader page={page} mode={mode} /> : sessionState === "unavailable" ? <SessionRecovery onRetry={() => setSessionRetry((current) => current + 1)} /> : authenticated ? (
        <Shell page={page} mode={mode} setPage={setPage} setMode={setMode} logout={logout}>
          <Suspense fallback={<PageLoader page={page} mode={mode} />}>
            {page === "dashboard" && <Dashboard api={api} user={user} setPage={setPage} onOpenDayPresets={openDayPresets} />}
            {page === "configure" && <ConfigureFood api={api} setPage={setPage} foodId={selectedFoodId} user={user} />}
            {page === "scanner" && (
              <Scanner
                api={api}
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
            {page === "plans" && <PlansPage api={api} mode={mode} />}
            {page === "my-foods" && <MyFoodsPage api={api} setPage={setPage} user={user} />}
            {page === "recipes" && <Recipes api={api} setPage={setPage} />}
            {page === "day-presets" && <DayPresetsPage api={api} user={user} seed={dayPresetSeed} onSeedConsumed={() => setDayPresetSeed(null)} />}
            {page === "profile" && <Profile api={api} logout={logout} mode={mode} />}
            {page === "training-dashboard" && <TrainingDashboard api={api} setPage={setPage} />}
            {page === "training-calendar" && <TrainingCalendar api={api} />}
            {page === "training-cardio" && <CardioPage api={api} />}
            {page === "training-profile" && <TrainingProfile api={api} />}
          </Suspense>
        </Shell>
      ) : (
        <AuthScreen api={api} page={page} setPage={setPage} saveSession={saveSession} />
      )}
      {confirmation && <ConfirmationDialog {...confirmation} mode={mode} onCancel={() => resolveConfirmation(false)} onConfirm={() => resolveConfirmation(true)} />}
      {notification && <Notification message={notification.message} tone={notification.tone} onDismiss={() => setNotification(null)} />}
      {authenticated && sharedMealToken && <MealShareAcceptDialog api={api} token={sharedMealToken} onClose={clearSharedMeal} onDone={() => { clearSharedMeal(); setPage("dashboard"); }} />}
    </>
  );
}
