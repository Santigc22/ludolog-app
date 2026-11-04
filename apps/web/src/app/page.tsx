import Link from "next/link";

import { ApiStatus } from "../components/ui/api-status";
import { getApiHealth } from "../lib/api/health";

export default async function HomePage() {
  const health = await getApiHealth();

  return (
    <main className="home-layout">
      <section className="hero">
        <div>
          <div className="eyebrow">Tu memoria sobre la mesa</div>
          <h1>Cada caja guarda una historia.</h1>
          <p className="hero-copy">
            Ludolog reúne tu colección, tus copias y tus partidas en un espacio
            pensado para quienes disfrutan tanto jugar como recordar.
          </p>
          <div className="hero-actions">
            <Link className="primary-action link-action" href="/acceso">
              Comenzar
            </Link>
            <Link className="secondary-action link-action" href="/perfil">
              Ver mi perfil
            </Link>
          </div>
        </div>
        <div className="hero-board" aria-hidden="true">
          <span className="piece piece-one">●</span>
          <span className="piece piece-two">▲</span>
          <span className="piece piece-three">◆</span>
          <div className="board-title">LUDOLOG</div>
          <div className="board-subtitle">PLAY · KEEP · REMEMBER</div>
        </div>
      </section>
      <div className="health-row">
        {health.available ? (
          <ApiStatus available service={health.service} />
        ) : (
          <ApiStatus available={false} />
        )}
      </div>
    </main>
  );
}
