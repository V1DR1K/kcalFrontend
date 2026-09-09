import React, { useState } from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { CreateCatalog, MyFoods } from "../catalog/CreateCatalog";

export function MyFoodsPage({ api, setPage, embedded = false, onCreateFood }) {
  const [creating, setCreating] = useState(false);
  return (
    <section className={`page abm-page narrow my-foods-page ${embedded ? "register-embedded-page" : ""}`}>
      {!embedded && <button className="back-button" onClick={() => setPage("scanner")}>
        <Icon name="arrow_back" />Registrar
      </button>}
      {!embedded && <header className="abm-page-header"><div><h1>Alimentos</h1><p>Tu catálogo personal, con cantidades y nutrientes listos para registrar.</p></div></header>}
      <MyFoods api={api} embedded onCreateFood={onCreateFood || (() => setCreating(true))} />
      {creating && <CreateCatalog api={api} prefillBarcode="" clearPrefillBarcode={() => {}} onClose={() => setCreating(false)} />}
    </section>
  );
}
