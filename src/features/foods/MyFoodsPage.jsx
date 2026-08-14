import React from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { MyFoods } from "../catalog/CreateCatalog";

export function MyFoodsPage({ api, setPage }) {
  return (
    <section className="page narrow my-foods-page">
      <button className="back-button" onClick={() => setPage("scanner")}>
        <Icon name="arrow_back" />Registrar
      </button>
      <Header title="Mis alimentos" />
      <MyFoods api={api} />
    </section>
  );
}
