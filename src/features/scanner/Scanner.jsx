import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { ModalShell } from "../../components/dialog/ModalShell";
import { NutritionSummary } from "../../components/NutritionSummary";
import "../../styles/05-scanner.css";

export function Scanner({ api, initialDialog = null, user, setPage, setSelectedFoodId, setPrefillBarcode, CatalogComponent, RecipesComponent, MyFoodsComponent }) {
  const [barcode, setBarcode] = useState("");
  const [food, setFood] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [barcodeError, setBarcodeError] = useState("");
  const [status, setStatus] = useState("Alineá el código dentro del marco");
  const [mode, setMode] = useState("choices");
  const [activeDialog, setActiveDialog] = useState(initialDialog);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const videoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  const mountedRef = useRef(true);
  const timeoutRef = useRef(null);
  useEffect(() => () => {
    mountedRef.current = false;
    window.clearTimeout(timeoutRef.current);
  }, []);
  useEffect(() => {
    if (!cameraOn) return undefined;
    let cancelled = false;
    let controls = null;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraOn(false);
          return setStatus("Tu navegador no permite usar cámara acá. Usá ingreso manual.");
        }
        setStatus("Escaneando código de barras...");
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          videoRef.current,
          async (result, _error, controls) => {
            if (!result || cancelled) return;
            cancelled = true;
            controls.stop();
            const detectedBarcode = result.getText();
            setBarcode(detectedBarcode);
            setStatus("Código reconocido. Buscando producto...");
            api.notify("Código reconocido. Ya podés dejar de apuntar la cámara.");
            navigator.vibrate?.([80, 40, 80]);
            await search(detectedBarcode, true);
          },
        );
        scannerControlsRef.current = controls;
        if (cancelled) controls.stop();
      } catch {
        if (!cancelled && mountedRef.current) {
          setCameraOn(false);
          setStatus("No se pudo acceder a la cámara. Revisá permisos o usá ingreso manual.");
        }
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      controls?.stop();
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
      videoRef.current?.srcObject?.getTracks?.().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraOn]);
  async function search(code = barcode, scanned = false) {
    const cleanCode = String(code || "").trim();
    if (!cleanCode) {
      setStatus("Ingresá un código de barras.");
      return;
    }
    try {
      const found = await api.runAction(
        { title: "Buscando producto", description: "Estamos consultando el código de barras..." },
        () => api.request(`/api/foods/barcode/${encodeURIComponent(cleanCode)}`),
        { quiet: true },
      );
      if (!mountedRef.current) return;
      setFood(found);
      setStatus("Producto encontrado. Ajustá la porción antes de agregarlo.");
      setBarcodeError("");
      setCameraOn(false);
      setSelectedFoodId(found.id);
      api.notify(`${found.name} reconocido. Revisá la porción antes de agregarlo.`);
      timeoutRef.current = window.setTimeout(() => {
        if (mountedRef.current) setPage("configure");
      }, scanned ? 500 : 0);
    } catch (error) {
      if (!mountedRef.current) return;
      setFood(null);
      setBarcodeError("No encontramos ese código en el catálogo. Podés registrarlo manualmente.");
      setCameraOn(false);
      setStatus("No encontramos ese código en el catálogo.");
      api.notify(error.message || "No encontramos ese código.", "error");
    }
  }
  function openScanner() {
    setActiveDialog("scanner");
    setMode("scanner");
    setStatus("Alineá el código dentro del marco");
    setCameraOn(true);
    setFood(null);
  }
  function openCatalog() {
    setCameraOn(false);
    setPrefillBarcode?.(barcode);
    setActiveDialog("catalog");
    setCatalogOpen(true);
  }
  function closeCatalog({ fromHistory = false } = {}) {
    const modalHistoryActive = window.history.state?.scalegramsModal === "catalog";
    setCatalogOpen(false);
    setActiveDialog(mode === "scanner" ? "scanner" : null);
    setPrefillBarcode?.("");
    if (!fromHistory && modalHistoryActive) window.history.back();
  }
  function closeScanner() {
    setCameraOn(false);
    setMode("choices");
    setActiveDialog(null);
  }
  function closeCollection() {
    setActiveDialog(null);
    if (initialDialog) setPage("scanner");
  }
  function renderCollectionDialog() {
    if (activeDialog === "recipes" && RecipesComponent) {
      return (
        <ModalShell
          title="Recetas"
          eyebrow="Registrar"
          onClose={closeCollection}
          closeLabel="Cerrar recetas"
          className="register-collection-dialog"
          backdropClassName="register-collection-backdrop"
          wrapContent={false}
        >
          <div className="register-collection-content" data-dialog-scroll-owner="true">
            <RecipesComponent api={api} user={user} setPage={setPage} embedded />
          </div>
        </ModalShell>
      );
    }
    if (activeDialog === "my-foods" && MyFoodsComponent) {
      return (
        <ModalShell
          title="Alimentos"
          eyebrow="Registrar"
          onClose={closeCollection}
          closeLabel="Cerrar mis alimentos"
          className="register-collection-dialog"
          backdropClassName="register-collection-backdrop"
          wrapContent={false}
        >
          <div className="register-collection-content" data-dialog-scroll-owner="true">
              <MyFoodsComponent api={api} setPage={setPage} embedded onCreateFood={openCatalog} />
          </div>
        </ModalShell>
      );
    }
    return null;
  }
  if (mode === "choices") {
    return (
      <section className="page register-page">
        <header className="register-heading">
          <div>
            <span className="register-kicker">Catálogo</span>
            <h1>Registrar</h1>
            <p>Sumá un alimento a tu registro con el camino más rápido.</p>
          </div>
          <Icon name="qr_code_scanner" />
        </header>
        <div className="register-options">
          <button className="register-option register-option-primary" type="button" onClick={openScanner}>
            <span className="register-option-icon"><Icon name="barcode_scanner" /></span>
            <span><strong>Escanear código de barras</strong><small>Usá la cámara para buscar un alimento en el catálogo.</small></span>
            <Icon name="arrow_forward" />
          </button>
          <button className="register-option" type="button" onClick={openCatalog}>
            <span className="register-option-icon"><Icon name="add_box" /></span>
            <span><strong>Crear alimento</strong><small>Agregá un alimento nuevo al catálogo personal.</small></span>
            <Icon name="arrow_forward" />
          </button>
          <button className="register-option" type="button" onClick={() => setActiveDialog("recipes")}>
            <span className="register-option-icon"><Icon name="restaurant" /></span>
            <span><strong>Recetas</strong><small>Consultá tus recetas o explorá las que compartió la comunidad.</small></span>
            <Icon name="arrow_forward" />
          </button>
          <button className="register-option register-option-compact" type="button" onClick={() => setActiveDialog("my-foods")}>
            <span className="register-option-icon"><Icon name="nutrition" /></span>
            <span><strong>Alimentos</strong><small>Consultá y editá los alimentos que creaste.</small></span>
            <Icon name="arrow_forward" />
          </button>
        </div>
        {catalogOpen && CatalogComponent && (
          <CatalogComponent
            api={api}
            prefillBarcode={barcode}
            clearPrefillBarcode={() => setBarcode("")}
            onClose={closeCatalog}
          />
        )}
        {renderCollectionDialog()}
      </section>
    );
  }
  return (
    <ModalShell
      title="Escanear código"
      description="Alineá el código dentro del marco o ingresalo manualmente."
      eyebrow="Registrar"
      onClose={closeScanner}
      closeLabel="Cerrar escáner"
      className="scanner-dialog"
      backdropClassName="scanner-dialog-backdrop"
      wrapContent={false}
    >
      <section className="scanner-page">
        <div className="scanner-stage">
          <video ref={videoRef} muted playsInline />
          {!cameraOn && <div className="scanner-fallback" />}
          <div className={`scan-frame ${status.startsWith("Código reconocido") ? "recognized" : ""}`}>
            <i />
            <i />
            <i />
            <i />
            <div className="scan-line" />
            <Icon name={status.startsWith("Código reconocido") ? "check_circle" : "barcode_scanner"} />
          </div>
          <p aria-live="polite">{status}</p>
        </div>
        <section className={`scanner-result ${food ? "show" : ""}`} data-dialog-scroll-owner="true">
          {food ? (
            <>
              <div>
                <strong>{food.name}</strong>
                <span className="scanner-result-context">Por 100 g</span>
              </div>
              <NutritionSummary nutrition={food} />
              <button
                className="primary"
                onClick={() => {
                  setSelectedFoodId(food.id);
                  setPage("configure");
                }}
              >
                Configurar porción
              </button>
            </>
          ) : (
            <>
              <button className="manual-toggle" aria-expanded={manualOpen} aria-controls="manual-barcode-panel" onClick={() => setManualOpen((value) => !value)}>
                <span>Código manual</span>
                <Icon name={manualOpen ? "expand_more" : "chevron_right"} />
              </button>
              {manualOpen && (
                <div className="manual-panel" id="manual-barcode-panel">
                  <label className="sr-only" htmlFor="manual-barcode">Código de barras</label>
                  <input id="manual-barcode" inputMode="numeric" value={barcode} onChange={(event) => { setBarcode(event.target.value.replace(/\D/g, "")); setBarcodeError(""); }} placeholder="Ingresar código" aria-invalid={Boolean(barcodeError)} />
                  {barcodeError && <span className="form-error" role="alert">{barcodeError}</span>}
                  <button className="secondary" onClick={() => search()}>
                    Buscar
                  </button>
                </div>
              )}
              <button className="secondary" onClick={openCatalog}>
                Crear alimento
              </button>
              <button className="primary" onClick={() => setCameraOn((value) => !value)}>
                {cameraOn ? "Pausar cámara" : "Usar cámara"}
              </button>
            </>
          )}
        </section>
        {catalogOpen && CatalogComponent && (
          <CatalogComponent
            api={api}
            prefillBarcode={barcode}
            clearPrefillBarcode={() => setBarcode("")}
            onClose={closeCatalog}
          />
        )}
      </section>
    </ModalShell>
  );
}
