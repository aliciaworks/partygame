import * as BABYLON from "@babylonjs/core";
import { BaseGame } from "../../core/base-game";
import { NetworkManager } from "../../core/network-manager";
import type { GameTickUpdate } from "@partygame/shared";

export class RacingGame extends BaseGame {
  private groundMaterial: BABYLON.Material | null = null;
  private playerMeshes: Map<string, BABYLON.AbstractMesh> = new Map();
  private inputState = { moveX: 0, moveY: 0 };
  private lapCounterEl: HTMLDivElement | null = null;

  constructor(scene: BABYLON.Scene, networkManager: NetworkManager) {
    super(scene, networkManager);
  }

  async initialize(): Promise<void> {
    this.setupLighting();
    this.setupGround();
    this.setupCamera();
    this.setupCheckpoints();
    this.setupUI();

    this.networkManager.onMessage("init", (data) => {
      this.localPlayerId = data.playerId;
    });

    this.networkManager.onMessage("tick", (update: GameTickUpdate) => {
      this.processGameUpdate(update);
    });

    this.networkManager.onMessage("race_finish", (data: any) => {
      if (data.playerId === this.localPlayerId && this.lapCounterEl) {
        this.lapCounterEl.innerHTML = `RACE FINISHED! You completed ${data.lap} laps!`;
        this.lapCounterEl.style.color = "#10b981";
      }
    });

    this.setupInput();
  }

  start(): void {}

  stop(): void {
    if (this.lapCounterEl && this.lapCounterEl.parentNode) {
      this.lapCounterEl.parentNode.removeChild(this.lapCounterEl);
    }
    this.scene.dispose();
  }

  update(): void {
    this.networkManager.sendInput(this.inputState.moveX, this.inputState.moveY, false, false);
  }

  processGameUpdate(update: GameTickUpdate): void {
    for (const [entityId, components] of Object.entries(update.entities)) {
      const componentData = components as any;

      if (componentData.transform) {
          let mesh = this.playerMeshes.get(entityId);
          if (!mesh) {
            mesh = this.createPlayerMesh(entityId);
            this.playerMeshes.set(entityId, mesh);
          }
          mesh.position.x = componentData.transform.x;
          mesh.position.z = componentData.transform.y;
      }

      if (entityId === this.localPlayerId && componentData.lap !== undefined && this.lapCounterEl) {
          if (!componentData.finished) {
            this.lapCounterEl.innerText = `LAP: ${componentData.lap} / 3 | CHECKPOINT: ${componentData.checkpoint}`;
          }
      }
    }
  }

  private setupUI(): void {
    this.lapCounterEl = document.createElement("div");
    this.lapCounterEl.style.position = "absolute";
    this.lapCounterEl.style.top = "100px";
    this.lapCounterEl.style.left = "50%";
    this.lapCounterEl.style.transform = "translateX(-50%)";
    this.lapCounterEl.style.color = "#fff";
    this.lapCounterEl.style.fontSize = "32px";
    this.lapCounterEl.style.fontWeight = "bold";
    this.lapCounterEl.style.textShadow = "0 2px 4px rgba(0,0,0,0.8)";
    this.lapCounterEl.style.zIndex = "10";
    document.body.appendChild(this.lapCounterEl);
  }

  private setupLighting(): void {
    const light = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-1, -2, -1), this.scene);
    light.intensity = 0.8;
  }

  private setupGround(): void {
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 400, height: 400 }, this.scene);
    this.groundMaterial = new BABYLON.StandardMaterial("groundMat", this.scene);
    (this.groundMaterial as BABYLON.StandardMaterial).diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    ground.material = this.groundMaterial;
  }

  private setupCheckpoints(): void {
    const checkpoints = [
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 0, y: 0 },
      ];
    
    checkpoints.forEach((cp, i) => {
        const marker = BABYLON.MeshBuilder.CreateCylinder(`cp-${i}`, { height: 20, diameter: 10 }, this.scene);
        marker.position.x = cp.x;
        marker.position.z = cp.y;
        marker.position.y = 10;
        const mat = new BABYLON.StandardMaterial(`cpMat-${i}`, this.scene);
        mat.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
        mat.alpha = 0.6;
        marker.material = mat;
    });
  }

  private setupCamera(): void {
    const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 4, Math.PI / 4, 250, BABYLON.Vector3.Zero(), this.scene);
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
    const box = BABYLON.MeshBuilder.CreateBox(`player-${entityId}`, { size: 4 }, this.scene);
    box.position.y = 2;
    const material = new BABYLON.StandardMaterial(`mat-${entityId}`, this.scene);
    material.diffuseColor = entityId === this.localPlayerId ? new BABYLON.Color3(0, 1, 0) : new BABYLON.Color3(1, 0, 0);
    box.material = material;
    return box;
  }
}
