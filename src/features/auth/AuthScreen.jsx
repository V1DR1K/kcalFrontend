import React, { useRef, useState } from "react";
import { APP_NAME, REGISTRATION_ENABLED } from "../../config/app";
import { Icon } from "../../components/Icon";
import { Input, Select } from "../../components/FormControls";

export function AuthScreen({ api, page, setPage, saveSession }) {
  const isRegister = REGISTRATION_ENABLED && page === "register";
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef(null);
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  function messageFor(error, fallback) {
    if (error?.fields && typeof error.fields === "object") {
      setFieldErrors(
        Object.fromEntries(
          Object.entries(error.fields)
            .filter(([key, value]) => value)
            .map(([key, value]) => [key, typeof value === "string" ? value : fallback]),
        ),
      );
      return error.message || fallback;
    }
    setFieldErrors({});
    return error?.message || fallback;
  }
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setLoading(true);
    setFieldErrors({});
    setFormError("");
    try {
      const payload = await api.runAction(
        {
          title: isRegister ? "Creando tu cuenta" : "Iniciando sesión",
          description: isRegister ? "Estamos preparando tu perfil..." : "Estamos verificando tus datos...",
        },
        () => api.request(isRegister ? "/api/auth/register" : "/api/auth/login", { method: "POST", body: JSON.stringify(isRegister ? {
          fullName: data.fullName, email: data.email, password: data.password, weightKg: Number(data.weightKg), heightCm: Number(data.heightCm), birthDate: data.birthDate, gender: data.gender, goal: data.goal, activityLevel: data.activityLevel,
        } : { username: data.username, password: data.password }) }),
      );
      saveSession(payload);
    } catch (error) {
      const message = messageFor(error, isRegister ? "No se pudo crear la cuenta." : "No se pudo iniciar sesión.");
      setFormError(message);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }
  return <main className="auth-page"><section className="auth-card"><a className="auth-back" href="/"><Icon name="arrow_back" />Volver a ScaleGrams</a><div className="brand auth-brand"><Icon name="scale" className="fill" /><div><strong>{APP_NAME}</strong><span>{isRegister ? "Crear cuenta" : "Ingreso"}</span></div></div><h1>{isRegister ? "Crear cuenta" : "Ingresar a ScaleGrams"}</h1><p className="auth-intro">Registrá tus comidas y mantené tu plan bajo control.</p><p className="auth-access-note">El acceso está disponible para cuentas existentes.</p><form onSubmit={submit} className="form-grid">
    {isRegister && <Input name="fullName" label="Nombre completo" required />}
    <Input name="username" label="Usuario" autoComplete="username" required error={fieldErrors.username} />
    <Input ref={passwordRef} id="auth-password" name="password" label="Contraseña" type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 8 : undefined} required error={fieldErrors.password} />
    <button type="button" className="secondary auth-password-toggle" aria-pressed={showPassword} aria-controls="auth-password" onPointerDown={event => event.preventDefault()} onClick={() => { const input=passwordRef.current; const start=input.selectionStart; const end=input.selectionEnd; setShowPassword(value => !value); requestAnimationFrame(() => { input.focus({preventScroll:true}); input.setSelectionRange(start,end); }); }}>{showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}</button>
    {isRegister && <><div className="split"><Input name="weightKg" label="Peso kg" type="number" inputMode="decimal" step="0.1" defaultValue="75" required /><Input name="heightCm" label="Altura cm" type="number" inputMode="decimal" step="0.1" defaultValue="175" required /></div><Input name="birthDate" label="Fecha de nacimiento" type="date" defaultValue="1995-01-01" /><div className="split"><Select name="gender" label="Género" options={["MALE", "FEMALE", "OTHER"]} /><Select name="activityLevel" label="Actividad" options={["SEDENTARY", "LIGHTLY_ACTIVE", "MODERATELY_ACTIVE", "VERY_ACTIVE"]} /></div><Select name="goal" label="Objetivo" options={["LOSE", "MAINTAIN", "GAIN"]} /></>}
    {formError && <p className="form-error" role="alert">{formError}</p>}
    <button className="primary" disabled={loading}>{loading ? "Procesando..." : isRegister ? "Crear cuenta" : "Ingresar"}</button>
   </form><details className="auth-help"><summary>Ayuda para ingresar</summary><p>Usá el usuario de tu cuenta existente. Revisá mayúsculas y espacios, y comprobá la contraseña con el botón Mostrar. Si no recordás tus datos, consultá a quien habilitó tu cuenta.</p></details>{REGISTRATION_ENABLED && <button className="link-button" onClick={() => { setFieldErrors({}); setPage(isRegister ? "login" : "register"); }}>{isRegister ? "Ya tengo cuenta" : "Crear una cuenta nueva"}</button>}</section></main>;
}
