import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import "../../styles/05-scanner.css";

export function Scanner({ api, setPage, setSelectedFoodId, setPrefillBarcode }) {
  const [barcode, setBarcode] = useState("");
  const [food, setFood] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [barcodeError, setBarcodeError] = useState("");
  const [status, setStatus] = useState("Alineá el código dentro del marco");
  const videoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  useEffect(() => {
    if (!cameraOn) return undefined;
    let cancelled = false;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return setStatus("Tu navegador no permite usar cámara acá. Usá ingreso manual.");
        setStatus("Escaneando código de barras...");
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
            setStatus("Código reconocido. Buscando producto...");
            api.notify("Código reconocido. Ya podés dejar de apuntar la cámara.");
            navigator.vibrate?.([80, 40, 80]);
            await search(detectedBarcode, true);
          },
        );
      } catch {
        if (!cancelled) setStatus("No se pudo acceder a la cámara. Revisá permisos o usá ingreso manual.");
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
      setStatus("Ingresá un código de barras.");
      return;
    }
    try {
      const found = await api.runAction(
        { title: "Buscando producto", description: "Estamos consultando el código de barras..." },
        () => api.request(`/api/foods/barcode/${encodeURIComponent(cleanCode)}`),
        { quiet: true },
      );
      setFood(found);
      setStatus("Producto encontrado. Ajustá la porción antes de agregarlo.");
      setBarcodeError("");
      setCameraOn(false);
      setSelectedFoodId(found.id);
      api.notify(`${found.name} reconocido. Revisá la porción antes de agregarlo.`);
      window.setTimeout(() => setPage("configure"), scanned ? 500 : 0);
    } catch (error) {
      setFood(null);
      setBarcodeError("No encontramos ese código en el catálogo. Podés registrarlo manualmente.");
      setCameraOn(false);
      setStatus("No encontramos ese código en el catálogo.");
      api.notify(error.message || "No encontramos ese código.", "error");
    }
  }
  return (
    <section className="scanner-page">
      <button className="back-button" onClick={() => setPage("foods")}>
        <Icon name="arrow_back" />Alimentos
      </button>
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
              Configurar porción
            </button>
          </>
        ) : (
          <>
            <button className="manual-toggle" onClick={() => setManualOpen((value) => !value)}>
              <span>Código manual</span>
              <Icon name={manualOpen ? "expand_more" : "chevron_right"} />
            </button>
            {manualOpen && (
              <div className="manual-panel">
                <label className="sr-only" htmlFor="manual-barcode">Código de barras</label>
                <input id="manual-barcode" inputMode="numeric" value={barcode} onChange={(event) => { setBarcode(event.target.value.replace(/\D/g, "")); setBarcodeError(""); }} placeholder="Ingresar código" aria-invalid={Boolean(barcodeError)} />
                {barcodeError && <span className="form-error" role="alert">{barcodeError}</span>}
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
              {cameraOn ? "Pausar cámara" : "Usar cámara"}
            </button>
          </>
        )}
      </section>
    </section>
  );
}
