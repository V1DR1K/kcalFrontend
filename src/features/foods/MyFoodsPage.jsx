import React from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { MyFoods } from "../catalog/CreateCatalog";

export function MyFoodsPage({ api, setPage, embedded = false }) {
  return (
    <section className={`page narrow my-foods-page ${embedded ? "register-embedded-page" : ""}`}>
      {!embedded && <button className="back-button" onClick={() => setPage("scanner")}>
        <Icon name="arrow_back" />Registrar
      </button>}
      {!embedded && <Header title="Mis alimentos" />}
      <MyFoods api={api} />
    </section>
  );
}
