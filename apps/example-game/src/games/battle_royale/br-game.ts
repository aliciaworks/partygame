import * as BABYLON from "@babylonjs/core";
import { BaseGame } from "../../core/base-game";
import { NetworkManager } from "../../core/network-manager";
import type { GameTickUpdate } from "@partygame/shared";

export class BattleRoyaleGame extends BaseGame {
  private groundMaterial: BABYLON.Material | null = null;
  private playerMeshes: Map<string, BABYLON.AbstractMesh> = new Map();
  private inputState = { moveX: 0, moveY: 0 };
  private zoneMesh: BABYLON.Mesh | null = null;

  constructor(scene: BABYLON.Scene, networkManager: NetworkManager) {
    super(scene, networkManager);
  }

  async initialize(): Promise<void> {
    this.setupLighting();
    this.setupGround();
    this.setupCamera();
    this.setupZone();

    this.networkManager.onMessage("init", (data) => {
      this.localPlayerId = data.playerId;
    });

    this.networkManager.onMessage("tick", (update: GameTickUpdate) => {
      this.processGameUpdate(update);
    });

    this.setupInput();
  }

  start(): void {}

  stop(): void {
    this.scene.dispose();
  }

  update(): void {
    this.networkManager.sendInput(this.inputState.moveX, this.inputState.moveY, false, false);
  }

  processGameUpdate(update: GameTickUpdate): void {
    for (const [entityId, components] of Object.entries(update.entities)) {
      const componentData = components as any;

      if (componentData.__zoneTick && this.zoneMesh) {
          const z = componentData.__zoneTick;
          this.zoneMesh.position.x = z.cx;
          this.zoneMesh.position.z = z.cy;
          this.zoneMesh.scaling.x = z.radius * 2;
          this.zoneMesh.scaling.z = z.radius * 2;
      }

      if (componentData.transform) {
          let mesh = this.playerMeshes.get(entityId);
          if (!mesh) {
            mesh = this.createPlayerMesh(entityId);
            this.playerMeshes.set(entityId, mesh);
          }
          mesh.position.x = componentData.transform.x;
          mesh.position.z = componentData.transform.y;
      }
    }
  }

  private setupLighting(): void {
    const light = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-1, -2, -1), this.scene);
    light.intensity = 0.8;
  }

  private setupGround(): void {
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 1000, height: 1000 }, this.scene);
    this.groundMaterial = new BABYLON.StandardMaterial("groundMat", this.scene);
    (this.groundMaterial as BABYLON.StandardMaterial).diffuseColor = new BABYLON.Color3(0.1, 0.4, 0.1);
    ground.material = this.groundMaterial;
  }

  private setupZone(): void {
      this.zoneMesh = BABYLON.MeshBuilder.CreateCylinder("zone", { height: 50, diameter: 1, tessellation: 64 }, this.scene);
      const mat = new BABYLON.StandardMaterial("zoneMat", this.scene);
      mat.diffuseColor = new BABYLON.Color3(0, 0.5, 1);
      mat.alpha = 0.3;
      this.zoneMesh.material = mat;
      this.zoneMesh.position.y = 25;
  }

  private setupCamera(): void {
    const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 4, Math.PI / 4, 150, BABYLON.Vector3.Zero(), this.scene);
    camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
  }

  private setupInput(): void {
    const inputMap = { w: false, a: false, s: false, d: false };
    this.scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toLowerCase();
      if (key === "w") inputMap.w = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;
      if (key === "a") inputMap.a = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;
      if (key === "s") inputMap.s = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;
      if (key === "d") inputMap.d = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;

      let moveX = 0, moveY = 0;
      if (inputMap.w) moveY += 1;
      if (inputMap.s) moveY -= 1;
      if (inputMap.d) moveX += 1;
      if (inputMap.a) moveX -= 1;

      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      if (len > 0) { moveX /= len; moveY /= len; }
      this.inputState.moveX = moveX;
      this.inputState.moveY = moveY;
    });
  }

  private createPlayerMesh(entityId: string): BABYLON.AbstractMesh {
    const sphere = BABYLON.MeshBuilder.CreateSphere(`player-${entityId}`, { diameter: 4 }, this.scene);
    sphere.position.y = 2;
    const material = new BABYLON.StandardMaterial(`mat-${entityId}`, this.scene);
    material.diffuseColor = entityId === this.localPlayerId ? new BABYLON.Color3(0, 1, 0) : new BABYLON.Color3(1, 0, 0);
    sphere.material = material;
    return sphere;
  }
}
