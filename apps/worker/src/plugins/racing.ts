import type { GamePlugin, Session } from "../game/plugin";

export class RacingPlugin implements GamePlugin {
  readonly tickIntervalMs = 50;

  /** Four fixed checkpoint positions forming a rectangular circuit. */
  private readonly checkpoints = [
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
    { x: 0, y: 0 },
  ];

  private readonly CHECKPOINT_RADIUS = 15;
  private readonly TOTAL_LAPS = 3;
  private readonly MOVE_SPEED = 4;

  onJoin(session: Session) {
    session.state = { checkpoint: 0, lap: 0, finished: false };
  }

  onInput(session: Session, inputType: string, data: any) {
    if (inputType === "MOVE") {
      if (session.state?.finished) return; // No movement after finish
      const moveX = Number(data?.moveX || 0);
      const moveY = Number(data?.moveY || 0);
      session.transform.x += moveX * this.MOVE_SPEED;
      session.transform.y += moveY * this.MOVE_SPEED;
    }
  }

  onTick(sessions: Map<string, Session>) {
    for (const session of sessions.values()) {
      if (!session.state || session.state.finished) continue;

      const nextCheckpointIndex = session.state.checkpoint % this.checkpoints.length;
      const target = this.checkpoints[nextCheckpointIndex];

      const dx = session.transform.x - target.x;
      const dy = session.transform.y - target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.CHECKPOINT_RADIUS) {
        // Player reached the next checkpoint
        session.state.checkpoint++;

        // Check whether a full lap has been completed
        if (session.state.checkpoint % this.checkpoints.length === 0) {
          session.state.lap++;

          if (session.state.lap >= this.TOTAL_LAPS) {
            // Player finished the race
            session.state.finished = true;

            const finishMsg = JSON.stringify({
              type: "race_finish",
              playerId: session.playerId,
              lap: this.TOTAL_LAPS,
            });

            // Broadcast finish event to all connected players
            for (const s of sessions.values()) {
              if (s.ws.readyState === WebSocket.OPEN) {
                s.ws.send(finishMsg);
              }
            }
          }
        }
      }
    }
  }
}
