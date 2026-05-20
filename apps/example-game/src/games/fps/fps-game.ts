import * as BABYLON from "@babylonjs/core";
import { BaseGame } from "../../core/base-game";
import { NetworkManager } from "../../core/network-manager";
import type { GameTickUpdate } from "@partygame/shared";

/**
 * CyberArena - Fast-paced FPS multiplayer
 */
export class FPSGame extends BaseGame {
  private camera: BABYLON.UniversalCamera | null = null;
  private playerMeshes: Map<string, BABYLON.AbstractMesh> = new Map();
  private inputState = { moveX: 0, moveY: 0, isSprinting: false };
  private isJumping = false;
  // Jump physics value removed until used — keep jump behavior via `isJumping` flag
  private groundContact = false;

  constructor(scene: BABYLON.Scene, networkManager: NetworkManager) {
    super(scene, networkManager);
  }

  async initialize(): Promise<void> {
    console.log("Initializing FPS Game");

    // Setup scene
    this.setupLighting();
    this.setupEnvironment();
    this.setupCamera();
    this.setupPhysics();

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
    console.log("Starting FPS Game");
  }

  stop(): void {
    console.log("Stopping FPS Game");
    this.scene.dispose();
  }

  update(): void {
    // Send input to server
    this.networkManager.sendInput(
      this.inputState.moveX,
      this.inputState.moveY,
      this.inputState.isSprinting,
      this.isJumping,
    );

    this.isJumping = false; // Reset jump for next frame
  }

  processGameUpdate(update: GameTickUpdate): void {
    // Update entities based on game state
    for (const [entityId, components] of Object.entries(update.entities)) {
      const componentData = components as any;

      // Skip local player (camera handles it)
      if (entityId === this.localPlayerId) {
        if (componentData.transform && this.camera) {
          this.camera.position.x = componentData.transform.x;
          this.camera.position.z = componentData.transform.y;
        }
        continue;
      }

      // Get or create mesh for entity
      let mesh = this.playerMeshes.get(entityId);
      if (!mesh) {
        mesh = this.createEnemyMesh(entityId);
        this.playerMeshes.set(entityId, mesh);
      }

      // Update position
      if (componentData.transform) {
        mesh.position.x = componentData.transform.x;
        mesh.position.z = componentData.transform.y;
      }

      // Update health (visual feedback)
      if (componentData.health) {
        const health = componentData.health;
        const healthPercent = health.hp / health.maxHp;

        // Visual feedback
        const meshMaterial = mesh.material as BABYLON.StandardMaterial;
        if (meshMaterial) {
          meshMaterial.alpha = Math.max(0.3, healthPercent);
        }
      }
    }
  }

  private setupLighting(): void {
    // Neon-style lighting
    const ambientLight = new BABYLON.HemisphericLight(
      "ambient",
      new BABYLON.Vector3(0, 1, 0),
      this.scene,
    );
    ambientLight.intensity = 0.4;

    // Directional light
    const sunLight = new BABYLON.DirectionalLight(
      "sun",
      new BABYLON.Vector3(1, -1, 1),
      this.scene,
    );
    sunLight.intensity = 0.6;

    // Point lights for atmosphere
    const blueLight = new BABYLON.PointLight(
      "blueLight",
      new BABYLON.Vector3(50, 20, 50),
      this.scene,
    );
    blueLight.intensity = 0.4;
    blueLight.range = 150;
    // newer Babylon typings prefer setting diffuse color via 'diffuse' alias may be unavailable; set via 'diffuse' if present
    (blueLight as any).diffuse = new BABYLON.Color3(0, 0.5, 1);

    const redLight = new BABYLON.PointLight(
      "redLight",
      new BABYLON.Vector3(-50, 20, -50),
      this.scene,
    );
    redLight.intensity = 0.3;
    redLight.range = 150;
    (redLight as any).diffuse = new BABYLON.Color3(1, 0, 0.5);
  }

  private setupEnvironment(): void {
    // Floor
    const floor = BABYLON.MeshBuilder.CreateGround(
      "floor",
      { width: 200, height: 200 },
      this.scene,
    );

    const floorMat = new BABYLON.StandardMaterial("floorMat", this.scene);
    floorMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.15);
    (floorMat as any).roughness = 0.8;
    floor.material = floorMat;

    // Add physics
    floor.physicsImpostor = new BABYLON.PhysicsImpostor(
      floor,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 0, restitution: 0 },
      this.scene,
    );

    // Walls/obstacles
    const wall1 = BABYLON.MeshBuilder.CreateBox(
      "wall1",
      { width: 100, height: 20, depth: 2 },
      this.scene,
    );
    wall1.position = new BABYLON.Vector3(0, 10, -80);
    const wallMat = new BABYLON.StandardMaterial("wallMat", this.scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.3);
    wall1.material = wallMat;
    wall1.physicsImpostor = new BABYLON.PhysicsImpostor(
      wall1,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );

    // Central tower
    const tower = BABYLON.MeshBuilder.CreateCylinder(
      "tower",
      { height: 30, diameter: 15 },
      this.scene,
    );
    tower.position = new BABYLON.Vector3(0, 15, 0);
    const towerMat = new BABYLON.StandardMaterial("towerMat", this.scene);
    towerMat.diffuseColor = new BABYLON.Color3(0.5, 0.3, 0.8);
    towerMat.emissiveColor = new BABYLON.Color3(0.3, 0.1, 0.5);
    tower.material = towerMat;
    tower.physicsImpostor = new BABYLON.PhysicsImpostor(
      tower,
      BABYLON.PhysicsImpostor.CylinderImpostor,
      { mass: 0 },
      this.scene,
    );
  }

  private setupCamera(): void {
    this.camera = new BABYLON.UniversalCamera(
      "camera",
      new BABYLON.Vector3(0, 2, 0),
      this.scene,
    );
    this.camera.attachControl(
      this.scene.getEngine().getRenderingCanvas(),
      true,
    );

    // FPS controls
    this.camera.inertia = 0.7;
    // newer typings use angularSensibilityX/Y
    (this.camera as any).angularSensibilityX = 500;
    (this.camera as any).angularSensibilityY = 500;
    this.camera.speed = 0;
    this.camera.keysUp = [];
    this.camera.keysDown = [];
    this.camera.keysLeft = [];
    this.camera.keysRight = [];

    // Add physics to camera
    // Assigning a physics impostor to the camera has differing typings across Babylon versions.
    // Cast to any to avoid type errors while retaining runtime behavior for physics engines.
    (this.camera as any).physicsImpostor = new BABYLON.PhysicsImpostor(
      this.camera as any,
      BABYLON.PhysicsImpostor.SphereImpostor,
      { mass: 1, restitution: 0 },
      this.scene,
    );
  }

  private setupPhysics(): void {
    this.scene.enablePhysics(
      new BABYLON.Vector3(0, -9.81, 0),
      new BABYLON.CannonJSPlugin(),
    );
  }

  private setupInput(): void {
    const inputMap = {
      w: false,
      a: false,
      s: false,
      d: false,
      shift: false,
      space: false,
    };

    this.scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toLowerCase();
      const isDown = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;

      if (key === "w") inputMap.w = isDown;
      if (key === "a") inputMap.a = isDown;
      if (key === "s") inputMap.s = isDown;
      if (key === "d") inputMap.d = isDown;
      if (key === "shift") inputMap.shift = isDown;
      if (key === " ") {
        inputMap.space = isDown;
        if (isDown && this.groundContact) {
          this.isJumping = true;
        }
      }

      // Calculate movement
      let moveX = 0;
      let moveY = 0;

      if (inputMap.w) moveY += 1;
      if (inputMap.s) moveY -= 1;
      if (inputMap.d) moveX += 1;
      if (inputMap.a) moveX -= 1;

      this.inputState.moveX = moveX;
      this.inputState.moveY = moveY;
      this.inputState.isSprinting = inputMap.shift;
    });

    // Mouse look
    const canvas = this.scene.getEngine().getRenderingCanvas();
    let isMouseDown = false;
    let lastX = 0;
    let lastY = 0;

    canvas?.addEventListener("mousedown", () => {
      isMouseDown = true;
    });

    canvas?.addEventListener("mouseup", () => {
      isMouseDown = false;
    });

    canvas?.addEventListener("mousemove", (e) => {
      if (!isMouseDown || !this.camera) return;

      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;

      this.camera.rotation.y -= deltaX * 0.01;
      this.camera.rotation.x -= deltaY * 0.01;

      lastX = e.clientX;
      lastY = e.clientY;
    });
  }

  private createEnemyMesh(entityId: string): BABYLON.AbstractMesh {
    // Create capsule-like mesh
    const capsule = BABYLON.MeshBuilder.CreateCylinder(
      `enemy-${entityId}`,
      { height: 2, diameter: 0.8, subdivisions: 8 },
      this.scene,
    );
    capsule.position.y = 1;

    // Create material
    const material = new BABYLON.StandardMaterial(
      `mat-${entityId}`,
      this.scene,
    );
    material.diffuseColor = new BABYLON.Color3(1, 0.3, 0.3);
    material.specularColor = new BABYLON.Color3(1, 0, 0);
    capsule.material = material;

    return capsule;
  }
}
