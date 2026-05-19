import * as BABYLON from "@babylon/core";

/**
 * Manages Babylon.js scene and engine setup
 */
export class GameManager {
  private engine: BABYLON.Engine;

  constructor(engine: BABYLON.Engine) {
    this.engine = engine;
  }

  /**
   * Create a new scene
   */
  createScene(): BABYLON.Scene {
    const scene = new BABYLON.Scene(this.engine);
    scene.collisionsEnabled = true;

    // Lighting
    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      scene,
    );
    light.intensity = 0.7;

    return scene;
  }

  /**
   * Get engine reference
   */
  getEngine(): BABYLON.Engine {
    return this.engine;
  }
}
