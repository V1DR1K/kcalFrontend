import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { APP_NAME } from "../../config/app";

const scenes = [
  {
    id: "day",
    label: "Tu día",
    accent: "#4edea3",
    icon: "monitoring",
    title: "Un día que se entiende de un vistazo.",
    description: "Comidas, agua y objetivos conviven en una bitácora clara para decidir qué sigue sin perder el hilo.",
    action: "Ver el registro diario",
  },
  {
    id: "photo",
    label: "Foto asistida",
    accent: "#89ceff",
    icon: "photo_camera",
    title: "Una foto te da un punto de partida.",
    description: "Cuando la estimación asistida está habilitada, identifica alimentos y macros para que revises porciones, supuestos y ajustes antes de guardar.",
    action: "Entender la estimación",
  },
  {
    id: "training",
    label: "Entrenamiento",
    accent: "#c7a6ff",
    icon: "fitness_center",
    title: "Entrená con estructura, no de memoria.",
    description: "Armá planes de gimnasio o calistenia, registrá cada serie y mantené visible tu ritmo semanal.",
    action: "Explorar tus sesiones",
  },
  {
    id: "cardio",
    label: "Cardio",
    accent: "#ffd166",
    icon: "trending_up",
    title: "Cada kilómetro también cuenta.",
    description: "Guardá distancia, tiempo e inclinación de tu caminadora y sabé cuándo revisar el próximo service.",
    action: "Ver el control de cardio",
  },
];

export function Landing() {
  const chapterRefs = useRef([]);
  const [story, setStory] = useState({ active: 0, progress: 0.5 });

  useEffect(() => {
    let frame = 0;

    const updateStory = () => {
      frame = 0;
      const viewportCenter = window.innerHeight * 0.48;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      chapterRefs.current.forEach((chapter, index) => {
        if (!chapter) return;
        const bounds = chapter.getBoundingClientRect();
        const distance = Math.abs(bounds.top + bounds.height / 2 - viewportCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      const current = chapterRefs.current[closestIndex];
      if (!current) return;
      const bounds = current.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (viewportCenter - bounds.top) / bounds.height + 0.5));
      setStory((previous) => previous.active === closestIndex && Math.abs(previous.progress - progress) < 0.01
        ? previous
        : { active: closestIndex, progress });
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateStory);
    };

    updateStory();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const activeScene = scenes[story.active];
  const sceneStyle = {
    "--landing-scene-accent": activeScene.accent,
  };

  return (
    <main className="landing-page">
      <a className="landing-skip-link" href="#landing-title">Saltar al contenido</a>
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label={`${APP_NAME}, inicio`}>
          <span><Icon name="scale" /></span>
          <strong>{APP_NAME}</strong>
        </a>
        <nav className="landing-nav" aria-label="Navegación de la página">
          <a href="#recorrido">Conocer la app</a>
          <a href="#capacidades">Qué incluye</a>
        </nav>
        <a className="landing-login" href="/ingresar">Ingresar <Icon name="arrow_forward" /></a>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <h1 id="landing-title">Tu plan, en contexto.</h1>
          <p>ScaleGrams conecta lo que comés, cómo entrenás y el cardio que registrás para que cada día tenga una referencia clara.</p>
          <div className="landing-actions">
            <a className="landing-primary" href="/ingresar">Ingresar a ScaleGrams <Icon name="arrow_forward" /></a>
            <a className="landing-secondary" href="#recorrido">Ver cómo funciona <Icon name="expand_more" /></a>
          </div>
          <div className="landing-hero-meta">
            <span><Icon name="verified" /> Registro cotidiano</span>
            <span><Icon name="today" /> Datos en un solo lugar</span>
          </div>
        </div>

        <div className="landing-hero-board" aria-label="Demo ilustrativa del día en ScaleGrams">
          <div className="landing-board-topbar">
            <div><span>MIÉRCOLES, 04 DE SEPTIEMBRE</span><strong>Mi día</strong></div>
            <span className="landing-board-status"><i /> En curso</span>
          </div>
          <div className="landing-board-focus">
            <div className="landing-board-focus-main">
              <span>Tu registro de hoy</span>
              <strong>1.040 <small>kcal</small></strong>
              <div className="landing-board-track"><i /></div>
              <small>de 2.120 kcal de referencia</small>
            </div>
            <div className="landing-board-focus-ring"><b>49%</b><span>del día</span></div>
          </div>
          <div className="landing-board-grid">
            <div className="landing-board-meals">
              <div className="landing-board-heading"><strong>Comidas</strong><span>3 de 4 registradas</span></div>
              <div className="landing-board-row is-complete"><span className="landing-row-icon"><Icon name="restaurant" /></span><div><strong>Desayuno</strong><small>Yogur, avena y fruta</small></div><b>428 kcal</b><Icon name="check" /></div>
              <div className="landing-board-row is-complete"><span className="landing-row-icon"><Icon name="restaurant" /></span><div><strong>Almuerzo</strong><small>Pollo, arroz y vegetales</small></div><b>612 kcal</b><Icon name="check" /></div>
              <div className="landing-board-row is-next"><span className="landing-row-icon"><Icon name="add" /></span><div><strong>Merienda</strong><small>Lista para registrar</small></div><Icon name="arrow_forward" /></div>
            </div>
            <div className="landing-board-side">
              <div className="landing-board-side-item"><span><Icon name="fitness_center" /> Último entreno</span><strong>Gimnasio <small>· 42 min</small></strong></div>
              <div className="landing-board-side-item"><span><Icon name="water_drop" /> Hidratación</span><strong>1,2 <small>/ 2,0 L</small></strong></div>
            </div>
          </div>
          <span className="landing-board-caption">Demo ilustrativa</span>
        </div>
      </section>

      <section className="landing-story" id="recorrido" aria-label="Recorrido por las capacidades de ScaleGrams">
        <div className="landing-story-intro">
          <h2>Del plato al movimiento, todo queda en contexto.</h2>
          <p>Una sola bitácora para registrar lo que hacés durante el día y volver a encontrarlo cuando lo necesitás.</p>
        </div>
        <div className="landing-story-grid">
          <div className="landing-chapters">
            {scenes.map((scene, index) => (
              <article
                className={`landing-chapter${story.active === index ? " is-active" : ""}`}
                key={scene.id}
                ref={(element) => { chapterRefs.current[index] = element; }}
                style={{ "--chapter-accent": scene.accent }}
              >
                <p className="landing-chapter-label"><Icon name={scene.icon} /><span>{scene.label}</span></p>
                <h3>{scene.title}</h3>
                <p>{scene.description}</p>
                <a className="landing-chapter-action" href="#capacidades">{scene.action} <Icon name="arrow_forward" /></a>
                <div className="landing-chapter-mobile-demo"><DemoWindow active={index} progress={0.5} /></div>
              </article>
            ))}
          </div>
          <div className="landing-stage-wrap">
            <div className="landing-stage" style={sceneStyle} aria-hidden="true">
              <div className="landing-stage-glow" aria-hidden="true" />
              <DemoWindow active={story.active} progress={story.progress} />
              <div className="landing-stage-caption"><span /><strong>{activeScene.label}</strong><b>demo ilustrativa</b></div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-capabilities" id="capacidades" aria-labelledby="capabilities-title">
        <div className="landing-capabilities-copy">
          <h2 id="capabilities-title">Una referencia para seguir, no una lista para cumplir.</h2>
          <p>ScaleGrams ordena tus registros para que puedas mirar el día completo, entender qué pasó y decidir el próximo paso con menos fricción.</p>
          <a className="landing-primary" href="/ingresar">Entrar a mi cuenta <Icon name="arrow_forward" /></a>
        </div>
        <dl className="landing-capabilities-list">
          <div><dt><Icon name="photo_camera" /> Estimación desde una foto</dt><dd>Identificá alimentos y macros estimados, revisá los supuestos y corregí antes de guardar.</dd></div>
          <div><dt><Icon name="fitness_center" /> Gimnasio y calistenia</dt><dd>Armá planes, registrá series, repeticiones, cargas, tiempos y tu progreso semanal.</dd></div>
          <div><dt><Icon name="trending_up" /> Cardio de caminadora</dt><dd>Guardá kilómetros, minutos e inclinación y llevá el contador hasta el próximo service.</dd></div>
        </dl>
      </section>

      <section className="landing-close" aria-labelledby="close-title">
        <h2 id="close-title">Que tu día no dependa de la memoria.</h2>
        <p>Registrá, revisá y seguí desde un mismo lugar.</p>
        <a className="landing-primary" href="/ingresar">Ingresar a ScaleGrams <Icon name="arrow_forward" /></a>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="/" aria-label={`${APP_NAME}, inicio`}><span><Icon name="scale" /></span><strong>{APP_NAME}</strong></a>
        <p>Una bitácora cotidiana para seguir tu plan con precisión.</p>
        <a href="/ingresar">Ingresar</a>
      </footer>
    </main>
  );
}

function DemoWindow({ active, progress }) {
  const scene = scenes[active];
  return (
    <div className="demo-window" aria-hidden="true" style={{ "--scene-tilt": `${(0.5 - progress) * 3}deg` }}>
      <div className="demo-window-topbar">
        <div className="demo-window-brand"><Icon name="scale" /> <strong>ScaleGrams</strong></div>
        <div className="demo-window-section"><Icon name={scene.icon} /> {scene.label}</div>
        <div className="demo-window-actions"><Icon name="search" /><Icon name="more_vert" /><span /></div>
      </div>
      <div className="demo-window-viewport">
        <DayDemo active={active === 0} />
        <PhotoDemo active={active === 1} />
        <TrainingDemo active={active === 2} />
        <CardioDemo active={active === 3} />
      </div>
    </div>
  );
}

function DemoScene({ active, className, children }) {
  return <div className={`demo-scene ${className}${active ? " is-visible" : ""}`} aria-hidden={!active}>{children}</div>;
}

function DemoWindowTitle({ label, title, description, icon }) {
  return <div className="demo-window-title"><div><span>{label}</span><h3>{title}</h3><p>{description}</p></div><strong><Icon name={icon} /></strong></div>;
}

function DemoToolbar({ action, icon }) {
  return <div className="demo-toolbar"><span><Icon name="search" /> Buscar en tu registro</span><b><Icon name={icon} /> {action}</b></div>;
}

function DayDemo({ active }) {
  return <DemoScene active={active} className="demo-scene-day">
    <DemoWindowTitle label="HOY · MIÉRCOLES 04" title="Tu día, en una sola vista." description="Lo que ya registraste y lo que todavía sigue." icon="monitoring" />
    <div className="demo-day-summary"><div><span>Energía registrada</span><strong>1.040 <small>kcal</small></strong></div><div className="demo-day-progress"><span>49% del objetivo</span><i><b /></i></div></div>
    <DemoToolbar action="Agregar" icon="add" />
    <div className="demo-section-heading"><span>COMIDAS DE HOY</span><b>3 / 4</b></div>
    <div className="demo-record-list">
      <div className="demo-record is-complete"><span><Icon name="restaurant" /></span><div><strong>Desayuno</strong><small>Yogur, avena y fruta</small></div><b>428 kcal</b><Icon name="check" /></div>
      <div className="demo-record is-complete"><span><Icon name="restaurant" /></span><div><strong>Almuerzo</strong><small>Pollo, arroz y vegetales</small></div><b>612 kcal</b><Icon name="check" /></div>
      <div className="demo-record is-next"><span><Icon name="add" /></span><div><strong>Merienda</strong><small>Lista para registrar</small></div><Icon name="arrow_forward" /></div>
    </div>
    <div className="demo-macro-strip"><span><i /><strong>Proteínas</strong><b>76 / 125 g</b></span><span><i /><strong>Carbos</strong><b>110 / 190 g</b></span><span><i /><strong>Grasas</strong><b>32 / 65 g</b></span></div>
  </DemoScene>;
}

function PhotoDemo({ active }) {
  return <DemoScene active={active} className="demo-scene-photo">
    <DemoWindowTitle label="CAPTURA ASISTIDA" title="La foto es el comienzo." description="Revisá la estimación antes de sumar el registro a tu día." icon="photo_camera" />
    <div className="demo-photo-layout"><div className="demo-photo-preview"><div className="demo-photo-plate"><i /><b /><em /></div><span><Icon name="verified" /> Foto recibida</span></div><div className="demo-ai-panel"><span className="demo-ai-status"><i /> ESTIMACIÓN LISTA</span><strong>Tu plato tiene</strong><div className="demo-ai-item"><span>Pollo grillado</span><b>150 g</b></div><div className="demo-ai-item"><span>Arroz blanco</span><b>120 g</b></div><div className="demo-ai-item"><span>Vegetales</span><b>80 g</b></div><div className="demo-ai-total"><span>Estimado</span><strong>612 <small>kcal</small></strong></div></div></div>
    <div className="demo-ai-note"><Icon name="edit" /><span>Podés ajustar cantidades y eliminar alimentos antes de confirmar.</span></div>
    <div className="demo-photo-actions"><span><Icon name="mic" /> Agregar contexto</span><b>Revisar registro <Icon name="arrow_forward" /></b></div>
  </DemoScene>;
}

function TrainingDemo({ active }) {
  return <DemoScene active={active} className="demo-scene-training">
    <DemoWindowTitle label="ENTRENAMIENTO · HOY" title="Seguí el plan que elegiste." description="Una sesión clara para registrar lo que hiciste." icon="fitness_center" />
    <DemoToolbar action="Registrar día" icon="play_arrow" />
    <div className="demo-training-focus"><div><span>PLAN DE HOY</span><strong>Fuerza · Día B</strong><small>Gimnasio · 5 ejercicios</small></div><b><Icon name="play_arrow" /> Abrir día</b></div>
    <div className="demo-section-heading"><span>ESTA SEMANA</span><b>ÚLTIMOS 7 DÍAS</b></div>
    <div className="demo-training-stats"><div><strong>3</strong><span>sesiones</span></div><div><strong>2 h 18</strong><span>entrenado</span></div><div><strong>24</strong><span>series</span></div></div>
    <div className="demo-session-line"><span><Icon name="check_circle" /></span><div><strong>Tren superior · Día A</strong><small>Completado ayer · 8 ejercicios</small></div><b>42 min</b></div>
  </DemoScene>;
}

function CardioDemo({ active }) {
  return <DemoScene active={active} className="demo-scene-cardio">
    <DemoWindowTitle label="CARDIO · CAMINADORA" title="Tu ritmo también se registra." description="Distancia, tiempo e inclinación en el mismo lugar." icon="trending_up" />
    <div className="demo-cardio-service"><div><span>PRÓXIMO SERVICE</span><strong>16 h 20 min</strong><small>restantes de 20 horas</small></div><div className="demo-cardio-meter"><i><b /></i><span>18% usado</span></div></div>
    <div className="demo-cardio-record"><div className="demo-cardio-record-head"><span><Icon name="today" /> ÚLTIMO REGISTRO</span><b>HOY, 07:42</b></div><div className="demo-cardio-values"><div><strong>4,50</strong><span>km</span></div><div><strong>35</strong><span>minutos</span></div><div><strong>Incl.</strong><span>inclinada</span></div></div></div>
    <div className="demo-cardio-footer"><span><Icon name="history" /> Historial de cardio</span><b>Registrar otro <Icon name="arrow_forward" /></b></div>
  </DemoScene>;
}
