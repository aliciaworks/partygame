import * as BABYLON from "@babylon/core";
import { BaseGame } from "../core/base-game";
import { NetworkManager } from "../core/network-manager";
import type { GameTickUpdate } from "@partygame/shared";

/**
 * Arena Wars - 3v3 MOBA-style game
 */
export class MOBAGame extends BaseGame {
  private groundMaterial: BABYLON.Material | null = null;
  private playerMeshes: Map<string, BABYLON.AbstractMesh> = new Map();
  private inputState = { moveX: 0, moveY: 0, isSprinting: false };

  constructor(scene: BABYLON.Scene, networkManager: NetworkManager) {
    super(scene, networkManager);
  }

  async initialize(): Promise<void> {
    console.log("Initializing MOBA Game");

    // Setup scene
    this.setupLighting();
    this.setupGround();
    this.setupCamera();

    // Register network handlers
    this.networkManager.onMessage("init", (data) => {
      this.localPlayerId = data.playerId;
      console.log(`Local player ID: ${this.localPlayerId}`);
    });

    this.networkManager.onMessage("tick", (update: GameTickUpdate) => {
      this.processGameUpdate(update);
    });

    // Setup input
    this.setupInput();
  }

  start(): void {
    console.log("Starting MOBA Game");
  }

  stop(): void {
    console.log("Stopping MOBA Game");
    this.scene.dispose();
  }

  update(): void {
    // Send input to server
    this.networkManager.sendInput(
      this.inputState.moveX,
      this.inputState.moveY,
      this.inputState.isSprinting,
      false,
    );
  }

  processGameUpdate(update: GameTickUpdate): void {
    // Update entities based on game state
    for (const [entityId, components] of Object.entries(update.entities)) {
      const componentData = components as any;

      // Get or create mesh for entity
      let mesh = this.playerMeshes.get(entityId);
      if (!mesh) {
        mesh = this.createPlayerMesh(entityId);
        this.playerMeshes.set(entityId, mesh);
      }

      // Update position
      if (componentData.transform) {
        mesh.position.x = componentData.transform.x;
        mesh.position.z = componentData.transform.y; // Map Y to Z for 3D
      }

      // Update health (visual feedback)
      if (componentData.health) {
        const health = componentData.health;
        const healthPercent = health.hp / health.maxHp;

        // Visual feedback: scale based on health
        const meshMaterial = mesh.material as BABYLON.StandardMaterial;
        if (meshMaterial) {
          meshMaterial.alpha = Math.max(0.5, healthPercent);
        }
      }
    }
  }

  private setupLighting(): void {
    // Directional light
    const light = new BABYLON.DirectionalLight(
      "sun",
      new BABYLON.Vector3(-1, -2, -1),
      this.scene,
    );
    light.intensity = 0.8;
    light.shadowMinZ = 0;
    light.shadowMaxZ = 100;
  }

  private setupGround(): void {
    // Create arena ground
    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: 100, height: 100 },
      this.scene,
    );

    this.groundMaterial = new BABYLON.StandardMaterial("groundMat", this.scene);
    (this.groundMaterial as BABYLON.StandardMaterial).diffuse =
      new BABYLON.Color3(0.2, 0.3, 0.4);
    ground.material = this.groundMaterial;

    // Add grid texture
    const gridTexture = new BABYLON.DynamicTexture("gridTexture", 512, this.scene);
    const ctx = gridTexture.getContext();
    ctx.fillStyle = "rgb(50, 70, 90)";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgb(100, 120, 140)";
    ctx.lineWidth = 2;

    for (let i = 0; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 51.2, 0);
      ctx.lineTo(i * 51.2, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * 51.2);
      ctx.lineTo(512, i * 51.2);
      ctx.stroke();
    }

    gridTexture.update();
    (this.groundMaterial as BABYLON.StandardMaterial).emissiveTexture = gridTexture;
  }

  private setupCamera(): void {
    // Top-down isometric camera
    const camera = new BABYLON.UniversalCamera(
      "camera",
      new BABYLON.Vector3(0, 50, 50),
      this.scene,
    );
    camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
    camera.inertia = 0.8;
    camera.angularSensibility = 1000;

    // Lock vertical rotation for isometric view
    camera.lowerBetaLimit = Math.PI / 4;
    camera.upperBetaLimit = Math.PI / 4;
  }

  private setupInput(): void {
    const inputMap = {
      w: false,
      a: false,
      s: false,
      d: false,
      shift: false,
    };

    this.scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toLowerCase();

      if (key === "w") inputMap.w = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;
      if (key === "a") inputMap.a = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;
      if (key === "s") inputMap.s = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;
      if (key === "d") inputMap.d = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;
      if (key === "shift") inputMap.shift = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;

      // Calculate movement
      let moveX = 0;
      let moveY = 0;

      if (inputMap.w) moveY += 1;
      if (inputMap.s) moveY -= 1;
      if (inputMap.d) moveX += 1;
      if (inputMap.a) moveX -= 1;

      // Normalize diagonal movement
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      if (len > 0) {
        moveX /= len;
        moveY /= len;
      }

      this.inputState.moveX = moveX;
      this.inputState.moveY = moveY;
      this.inputState.isSprinting = inputMap.shift;
    });
  }

  private createPlayerMesh(entityId: string): BABYLON.AbstractMesh {
    // Create sphere for player
    const sphere = BABYLON.MeshBuilder.CreateSphere(
      `player-${entityId}`,
      16,
      2,
      this.scene,
    );
    sphere.position.y = 1;

    // Create material
    const material = new BABYLON.StandardMaterial(`mat-${entityId}`, this.scene);
    material.diffuse = this.getTeamColor(entityId);
    material.specularColor = new BABYLON.Color3(1, 1, 1);
    sphere.material = material;

    // Check if local player
    if (entityId === this.localPlayerId) {
      material.emissiveColor = new BABYLON.Color3(0, 1, 0);
    }

    return sphere;
  }

  private getTeamColor(entityId: string): BABYLON.Color3 {
    // Simple team assignment based on player index
    const hash = entityId.charCodeAt(0) % 3;
    if (hash === 0) return new BABYLON.Color3(0, 0.7, 1); // Blue
    if (hash === 1) return new BABYLON.Color3(1, 0.3, 0.3); // Red
    return new BABYLON.Color3(1, 1, 0); // Yellow
  }
}
