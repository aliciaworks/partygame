import type { GamePlugin, Session } from "../game/plugin";

export class FpsPlugin implements GamePlugin {
  readonly tickIntervalMs = 50;

  onJoin(_session: Session) {}

  onInput(session: Session, inputType: string, data: any) {
    if (inputType === "MOVE") {
      const moveX = Number(data?.moveX || 0);
      const moveY = Number(data?.moveY || 0);
      // FPS movement might be faster or include Z-axis jumping
      session.transform.x += moveX * 3;
      session.transform.y += moveY * 3;
    }
  }

  onTick(_sessions: Map<string, Session>) {}
}
