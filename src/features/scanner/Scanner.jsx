import React, { useEffect, useRef, useState } from "react";

export function Scanner({ api, setPage, setSelectedFoodId, setPrefillBarcode }) {
  const [barcode, setBarcode] = useState("");
  const [food, setFood] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [status, setStatus] = useState("Alinea el codigo dentro del marco");
  const videoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  useEffect(() => {
    if (!cameraOn) return undefined;
    let cancelled = false;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return setStatus("Tu navegador no permite usar camara aca. Usa ingreso manual.");
        setStatus("Escaneando codigo de barras...");
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader();
        scannerControlsRef.current = await reader.decodeFromConstraints(
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
            setStatus("Codigo reconocido. Buscando producto...");
            api.notify("Codigo reconocido. Ya podes dejar de apuntar la camara.");
            navigator.vibrate?.([80, 40, 80]);
            await search(detectedBarcode, true);
          },
        );
      } catch {
        if (!cancelled) setStatus("No se pudo acceder a la camara. Revisa permisos o usa ingreso manual.");
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, [cameraOn]);
  async function search(code = barcode, scanned = false) {
    const cleanCode = String(code || "").trim();
    if (!cleanCode) {
      setStatus("Ingresa un codigo de barras.");
      return;
    }
    try {
      const found = await api.request(`/api/foods/barcode/${encodeURIComponent(cleanCode)}`);
      setFood(found);
      setStatus("Producto encontrado. Ajusta la porcion antes de agregarlo.");
      setCameraOn(false);
      setSelectedFoodId(found.id);
      api.notify(`${found.name} reconocido. Revisa la porcion antes de agregarlo.`);
      window.setTimeout(() => setPage("configure"), scanned ? 500 : 0);
    } catch (error) {
      setFood(null);
      setCameraOn(false);
      setStatus("No encontramos ese codigo en el catalogo.");
      api.notify("No encontramos ese codigo.", "error");
    }
  }
  return (
    <section className="scanner-page">
      <button className="back-button" onClick={() => setPage("foods")}>
        <span className="material-symbols-outlined">arrow_back</span>Alimentos
      </button>
      <div className="scanner-stage">
        <video ref={videoRef} muted playsInline />
        {!cameraOn && <div className="scanner-fallback" />}
        <div className={`scan-frame ${status.startsWith("Codigo reconocido") ? "recognized" : ""}`}>
          <i />
          <i />
          <i />
          <i />
          <div className="scan-line" />
          <span className="material-symbols-outlined">{status.startsWith("Codigo reconocido") ? "check_circle" : "barcode_scanner"}</span>
        </div>
        <p aria-live="polite">{status}</p>
      </div>
      <section className={`scanner-result ${food ? "show" : ""}`}>
        {food ? (
          <>
            <div>
              <strong>{food.name}</strong>
              <span>{food.calories} kcal / 100g</span>
            </div>
            <button
              className="primary"
              onClick={() => {
                setSelectedFoodId(food.id);
                setPage("configure");
              }}
            >
              Configurar porcion
            </button>
          </>
        ) : (
          <>
            <button className="manual-toggle" onClick={() => setManualOpen((value) => !value)}>
              <span>Codigo manual</span>
              <span className="material-symbols-outlined">{manualOpen ? "expand_more" : "chevron_right"}</span>
            </button>
            {manualOpen && (
              <div className="manual-panel">
                <input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))} placeholder="Ingresar codigo" />
                <button className="secondary" onClick={() => search()}>
                  Buscar
                </button>
              </div>
            )}
            <button
              className="secondary"
              onClick={() => {
                setPrefillBarcode?.(barcode);
                setPage("create");
              }}
            >
              Registrar producto
            </button>
            <button className="primary" onClick={() => setCameraOn((value) => !value)}>
              {cameraOn ? "Pausar camara" : "Usar camara"}
            </button>
          </>
        )}
      </section>
    </section>
  );
}
