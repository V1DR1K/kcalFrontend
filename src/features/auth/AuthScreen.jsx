import React, { useState } from "react";
import { APP_NAME, REGISTRATION_ENABLED } from "../../config/app";
import { Icon } from "../../components/Icon";
import { Input, Select } from "../../components/FormControls";

export function AuthScreen({ api, page, setPage, saveSession, notify }) {
  const isRegister = REGISTRATION_ENABLED && page === "register";
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setLoading(true);
    try {
      const payload = await api.runAction(
        {
          title: isRegister ? "Creando tu cuenta" : "Iniciando sesion",
          description: isRegister ? "Estamos preparando tu perfil..." : "Estamos verificando tus datos...",
        },
        () => api.request(isRegister ? "/api/auth/register" : "/api/auth/login", { method: "POST", body: JSON.stringify(isRegister ? {
          fullName: data.fullName, email: data.email, password: data.password, weightKg: Number(data.weightKg), heightCm: Number(data.heightCm), birthDate: data.birthDate, gender: data.gender, goal: data.goal, activityLevel: data.activityLevel,
        } : { email: data.email, password: data.password }) }),
      );
      saveSession(payload);
      notify(isRegister ? "Cuenta creada." : "Sesion iniciada.");
    } catch { notify(isRegister ? "No se pudo crear la cuenta." : "No se pudo iniciar sesion.", "error"); }
    finally { setLoading(false); }
  }
  return <main className="auth-page"><section className="auth-card"><div className="brand auth-brand"><Icon name="vital_signs" className="fill" /><div><strong>{APP_NAME}</strong><span>{isRegister ? "Crear cuenta" : "Ingreso"}</span></div></div><form onSubmit={submit} className="form-grid">
    {isRegister && <Input name="fullName" label="Nombre completo" required />}
    <Input name="email" label="Email" type="email" defaultValue={!isRegister && import.meta.env.DEV ? "alex@kazadesarrollos.com" : ""} autoComplete="email" required />
    <Input name="password" label="Contraseña" type="password" defaultValue={!isRegister && import.meta.env.DEV ? "password123" : ""} autoComplete={isRegister ? "new-password" : "current-password"} minLength="8" required />
    {isRegister && <><div className="split"><Input name="weightKg" label="Peso kg" type="number" defaultValue="75" required /><Input name="heightCm" label="Altura cm" type="number" defaultValue="175" required /></div><Input name="birthDate" label="Fecha de nacimiento" type="date" defaultValue="1995-01-01" /><div className="split"><Select name="gender" label="Genero" options={["MALE", "FEMALE", "OTHER"]} /><Select name="activityLevel" label="Actividad" options={["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]} /></div><Select name="goal" label="Objetivo" options={["LOSE_WEIGHT", "MAINTAIN", "GAIN_MUSCLE"]} /></>}
    <button className="primary" disabled={loading}>{loading ? "Procesando..." : isRegister ? "Crear cuenta" : "Ingresar"}</button>
  </form>{REGISTRATION_ENABLED && <button className="link-button" onClick={() => setPage(isRegister ? "login" : "register")}>{isRegister ? "Ya tengo cuenta" : "Crear una cuenta nueva"}</button>}</section></main>;
}
