export interface Session {
  playerId: string;
  ws: WebSocket;
  transform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
  state?: any; // Game-specific state
}

export interface GamePlugin {
  onJoin(session: Session): void;
  onInput(session: Session, inputType: string, data: any): void;
  onBinaryInput?(session: Session, data: ArrayBuffer): void;
  onTick(sessions: Map<string, Session>): void;
  /** Milliseconds between each tick. 0 means ticking is disabled for this plugin. */
  readonly tickIntervalMs: number;
}
