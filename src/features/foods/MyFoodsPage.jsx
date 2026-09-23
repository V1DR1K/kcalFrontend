import React, { useState } from "react";
import { Icon } from "../../components/Icon";
import { CreateCatalog, MyFoods } from "../catalog/CreateCatalog";
import { AdminFoodCatalog } from "../catalog/components/AdminFoodCatalog";

export function MyFoodsPage({ api, setPage, user, embedded = false, onCreateFood }) {
  const [creating, setCreating] = useState(false);
  const [section, setSection] = useState("mine");
  const isAdmin = user?.role === "ADMIN";
  return (
    <section className={`page abm-page narrow my-foods-page ${embedded ? "register-embedded-page" : ""}`}>
      {!embedded && <button className="back-button" onClick={() => setPage("scanner")}>
        <Icon name="arrow_back" />Registrar
      </button>}
      {!embedded && <header className="abm-page-header"><div><h1>Alimentos</h1><p>Tu catálogo personal, con cantidades y nutrientes listos para registrar.</p></div></header>}
      {isAdmin && <div className="tabs foods-tabs" role="tablist" aria-label="Secciones de alimentos">
        <button type="button" role="tab" aria-selected={section === "mine"} aria-controls="my-foods-panel" className={section === "mine" ? "selected" : ""} onClick={() => setSection("mine")}>Mis alimentos</button>
        <button type="button" role="tab" aria-selected={section === "catalog"} aria-controls="original-food-catalog-panel" className={section === "catalog" ? "selected" : ""} onClick={() => setSection("catalog")}>Catálogo original</button>
      </div>}
      {isAdmin ? <>
        <div id="my-foods-panel" role="tabpanel" hidden={section !== "mine"}><MyFoods api={api} embedded onCreateFood={onCreateFood || (() => setCreating(true))} /></div>
        <div id="original-food-catalog-panel" role="tabpanel" hidden={section !== "catalog"}>{section === "catalog" && <AdminFoodCatalog api={api} />}</div>
      </> : <MyFoods api={api} embedded onCreateFood={onCreateFood || (() => setCreating(true))} />}
      {creating && <CreateCatalog api={api} prefillBarcode="" clearPrefillBarcode={() => {}} onClose={() => setCreating(false)} />}
    </section>
  );
}
