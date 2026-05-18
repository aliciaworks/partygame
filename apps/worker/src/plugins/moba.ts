import type { GamePlugin, Session } from "../game/plugin";

export class MobaPlugin implements GamePlugin {
  readonly tickIntervalMs = 50;

  onJoin(_session: Session) {}

  onInput(session: Session, inputType: string, data: any) {
    if (inputType === "MOVE") {
      const moveX = Number(data?.moveX || 0);
      const moveY = Number(data?.moveY || 0);
      const speed = Boolean(data?.isSprinting) ? 2 : 1;
      session.transform.x += moveX * speed;
      session.transform.y += moveY * speed;
    }
  }

  onTick(_sessions: Map<string, Session>) {
    // Basic MOBA logic (e.g. cooldowns, lane pressure) could go here
  }
}
