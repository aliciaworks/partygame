import * as BABYLON from "@babylonjs/core";
import { NetworkManager } from "./network-manager";
import type { GameTickUpdate } from "@partygame/shared";

/**
 * Base class for all game types
 */
export abstract class BaseGame {
  protected scene: BABYLON.Scene;
  protected networkManager: NetworkManager;
  protected entities: Map<string, any> = new Map();
  protected localPlayerId: string = "";

  constructor(scene: BABYLON.Scene, networkManager: NetworkManager) {
    this.scene = scene;
    this.networkManager = networkManager;
  }

  /**
   * Initialize game (async setup)
   */
  abstract initialize(): Promise<void>;

  /**
   * Start game
   */
  abstract start(): void;

  /**
   * Stop game
   */
  abstract stop(): void;

  /**
   * Update game logic
   */
  abstract update(): void;

  /**
   * Handle game tick update from server
   */
  abstract processGameUpdate(update: GameTickUpdate): void;

  /**
   * Set local player ID
   */
  setLocalPlayer(playerId: string): void {
    this.localPlayerId = playerId;
  }
}
