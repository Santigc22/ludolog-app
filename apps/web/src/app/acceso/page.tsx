import Link from "next/link";

import { AccessPanel } from "../../components/auth/access-panel";

export default function AccessPage() {
  return (
    <main className="access-layout">
      <div className="access-context">
        <Link className="brand-mark" href="/">
          LUDOLOG
        </Link>
        <p className="context-kicker">Coleccionar también es recordar</p>
        <h2>Una casa digital para cada juego que llega a tu mesa.</h2>
        <p>
          Organiza tu colección, conserva la historia de tus copias y prepara el
          registro de cada partida.
        </p>
        <div className="game-markers" aria-hidden="true">
          <span>●</span>
          <span>▲</span>
          <span>■</span>
          <span>◆</span>
        </div>
      </div>
      <AccessPanel />
    </main>
  );
}
