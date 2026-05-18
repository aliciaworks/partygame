import type { GamePlugin, Session } from "../game/plugin";

export class BattleRoyalePlugin implements GamePlugin {
  readonly tickIntervalMs = 50;

  /** Shrinking safe zone. cx/cy are the center, radius shrinks each tick. */
  private zone = { cx: 0, cy: 0, radius: 500 };

  onJoin(session: Session) {
    // Place the player at a random spawn position within the current zone
    const angle = Math.random() * 2 * Math.PI;
    const dist = Math.random() * this.zone.radius;
    session.transform.x = this.zone.cx + Math.cos(angle) * dist;
    session.transform.y = this.zone.cy + Math.sin(angle) * dist;
    session.state = { health: 100, items: [] };
  }

  onInput(session: Session, inputType: string, data: any) {
    if (inputType === "MOVE") {
      const moveX = Number(data?.moveX || 0);
      const moveY = Number(data?.moveY || 0);
      session.transform.x += moveX;
      session.transform.y += moveY;
    } else if (inputType === "PICKUP") {
      session.state.items = session.state.items ?? [];
      session.state.items.push(data?.item ?? "ammo");
    }
  }

  onTick(sessions: Map<string, Session>) {
    // Shrink the zone slightly every tick
    if (this.zone.radius > 0) {
      this.zone.radius = Math.max(0, this.zone.radius - 0.1);
    }

    // Attach zone snapshot to a special __zone key so GameRoom can include it
    for (const session of sessions.values()) {
      session.state = session.state ?? {};
      session.state.__zoneTick = { ...this.zone };
    }
  }
}
