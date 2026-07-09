import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import "../styles.css";
import { request as apiRequest } from "../services/http";
import { TOKEN_KEY, USER_KEY } from "../config/app";
import { getSavedUser } from "../services/recents";
import { Shell } from "./Shell";
import { AuthScreen } from "../features/auth/AuthScreen";
import { Toast } from "../components/Layout";
import { Dashboard } from "../features/dashboard/Dashboard";
import { Foods } from "../features/foods/Foods";
import { CreateCatalog } from "../features/catalog/CreateCatalog";
import { ConfigureFood } from "../features/foods/ConfigureFood";
import { Scanner } from "../features/scanner/Scanner";
import { History } from "../features/history/History";
import { Profile } from "../features/profile/Profile";

export function App() {
  const [page, setPage] = useState(() => (localStorage.getItem(TOKEN_KEY) ? "dashboard" : "login"));
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(() => getSavedUser(USER_KEY));
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState("");

  const api = useMemo(
    () => ({
      request: apiRequest,
      notify(message, tone = "success") {
        setToast({ message, tone });
        window.setTimeout(() => setToast(null), 3500);
      },
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
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    setUser(payload.user);
    setPage("dashboard");
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setPage("login");
  }

  useEffect(() => {
    const expireSession = () => {
      logout();
      api.notify("Tu sesion vencio. Volve a ingresar.", "error");
    };
    window.addEventListener("kazaFitness:session-expired", expireSession);
    return () => window.removeEventListener("kazaFitness:session-expired", expireSession);
  }, [api]);

  const authenticated = Boolean(localStorage.getItem(TOKEN_KEY));
  return (
    <>
      {authenticated ? (
        <Shell user={user} page={page} setPage={setPage} logout={logout}>
          {page === "dashboard" && <Dashboard api={api} user={user} setPage={setPage} />}
          {page === "foods" && <Foods api={api} user={user} setPage={setPage} setSelectedFoodId={setSelectedFoodId} />}
          {page === "create" && <CreateCatalog api={api} setPage={setPage} prefillBarcode={prefillBarcode} clearPrefillBarcode={() => setPrefillBarcode("")} />}
          {page === "configure" && <ConfigureFood api={api} setPage={setPage} foodId={selectedFoodId} user={user} />}
          {page === "scanner" && <Scanner api={api} setPage={setPage} setSelectedFoodId={setSelectedFoodId} setPrefillBarcode={setPrefillBarcode} />}
          {page === "history" && <History api={api} />}
          {page === "profile" && <Profile api={api} logout={logout} />}
        </Shell>
      ) : (
        <AuthScreen page={page} setPage={setPage} saveSession={saveSession} notify={api.notify} />
      )}
      {toast && <Toast {...toast} />}
    </>
  );
}
