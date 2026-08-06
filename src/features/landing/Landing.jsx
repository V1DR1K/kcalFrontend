import React from "react";
import { Icon } from "../../components/Icon";
import { APP_NAME } from "../../config/app";

const ledgerEntries = [
  ["Desayuno", "Yogur griego, avena y fruta", "428 kcal"],
  ["Almuerzo", "Pollo, arroz y vegetales", "612 kcal"],
  ["Merienda", "Pendiente de registrar", ""],
];

export function Landing() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label={`${APP_NAME}, inicio`}>
          <span><Icon name="scale" /></span>
          <strong>{APP_NAME}</strong>
        </a>
        <nav className="landing-nav" aria-label="Navegacion de la pagina">
          <a href="#como-funciona">Como funciona</a>
          <a href="#registro">Tu registro</a>
        </nav>
        <a className="landing-login" href="/ingresar">Ingresar</a>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <h1 id="landing-title">Tu plan se entiende mejor cuando cabe en tu dia.</h1>
          <p>ScaleGrams transforma cada comida en un registro claro: cantidades, calorias y macros para que puedas seguir tu plan con precision, sin perder tiempo.</p>
          <div className="landing-actions">
            <a className="landing-primary" href="/ingresar">Ingresar a ScaleGrams <Icon name="arrow_back" className="landing-arrow" /></a>
            <a className="landing-secondary" href="#como-funciona">Conocer la app</a>
          </div>
          <p className="landing-note">Acceso para cuentas existentes.</p>
        </div>

        <div className="landing-ledger" aria-label="Ejemplo ilustrativo del registro diario">
          <div className="ledger-heading">
            <div><span>Martes, 12 de agosto</span><strong>Mi dia</strong></div>
            <Icon name="calendar_month" />
          </div>
          <div className="ledger-balance">
            <div><span>Energia registrada</span><strong>1.040 <small>kcal</small></strong></div>
            <span className="ledger-state">En curso</span>
          </div>
          <ol className="ledger-entries">
            {ledgerEntries.map(([meal, detail, value]) => (
              <li key={meal} className={value ? "" : "is-open"}>
                <span className="ledger-mark" aria-hidden="true" />
                <div><strong>{meal}</strong><small>{detail}</small></div>
                {value ? <b>{value}</b> : <Icon name="add" />}
              </li>
            ))}
          </ol>
          <div className="ledger-macros">
            <span><i className="protein" /><strong>Proteinas</strong><b>76 / 125 g</b></span>
            <span><i className="carbs" /><strong>Carbos</strong><b>110 / 190 g</b></span>
            <span><i className="fat" /><strong>Grasas</strong><b>32 / 65 g</b></span>
          </div>
          <small className="ledger-caption">Datos ilustrativos</small>
        </div>
      </section>

      <section className="landing-method" id="como-funciona" aria-labelledby="method-title">
        <div>
          <h2 id="method-title">Un registro diario, no una rutina imposible.</h2>
        </div>
        <ol>
          <li><span>01</span><div><strong>Registra la comida real</strong><p>Busca alimentos, usa tus recetas o escanea un codigo cuando lo necesites.</p></div></li>
          <li><span>02</span><div><strong>Lee el dia completo</strong><p>El balance de energia, macros y agua permanece a mano mientras avanzas.</p></div></li>
          <li><span>03</span><div><strong>Ajusta con contexto</strong><p>El historial hace visible la constancia para que tu plan siga siendo util en la vida real.</p></div></li>
        </ol>
      </section>

      <section className="landing-register" id="registro" aria-labelledby="register-title">
        <div className="landing-register-copy">
          <h2 id="register-title">Cada dato tiene un lugar. Cada dia deja una referencia.</h2>
          <p>Desde una cantidad en gramos hasta una comida completa, ScaleGrams organiza la informacion para que puedas consultarla sin ruido.</p>
          <a className="landing-primary" href="/ingresar">Ingresar a mi cuenta <Icon name="arrow_back" className="landing-arrow" /></a>
        </div>
        <dl className="landing-capabilities">
          <div><dt><Icon name="restaurant" />Comidas y recetas</dt><dd>Registro por alimento, cantidad o preparacion.</dd></div>
          <div><dt><Icon name="barcode_scanner" />Catalogo y escaner</dt><dd>Acceso rapido a productos y codigos de barras.</dd></div>
          <div><dt><Icon name="monitoring" />Historial del plan</dt><dd>Una vista clara para leer tu seguimiento diario.</dd></div>
        </dl>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="/"><span><Icon name="scale" /></span><strong>{APP_NAME}</strong></a>
        <p>Una bitacora cotidiana para seguir tu plan con precision.</p>
        <a href="/ingresar">Ingresar</a>
      </footer>
    </main>
  );
}
