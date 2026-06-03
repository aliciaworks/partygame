import * as BABYLON from "@babylonjs/core";
import { BaseGame } from "../../core/base-game";
import { NetworkManager } from "../../core/network-manager";
import type { GameTickUpdate } from "@partygame/shared";

/**
 * Card Game - DOM overlay based game, no 3D scene rendering required.
 */
export class CardGame extends BaseGame {
  private uiContainer: HTMLDivElement | null = null;
  private hand: number[] = [];
  private playedCards: number[] = [];

  constructor(scene: BABYLON.Scene, networkManager: NetworkManager) {
    super(scene, networkManager);
  }

  async initialize(): Promise<void> {
    console.log("Initializing Card Game");

    // Hide 3D canvas
    const canvas = document.getElementById("renderCanvas");
    if (canvas) canvas.style.display = "none";
    
    // Hide HUD
    const ui = document.getElementById("ui");
    if (ui) ui.style.display = "none";

    this.setupUI();

    // Register network handlers
    this.networkManager.onMessage("init", (data) => {
      this.localPlayerId = data.playerId;
    });

    this.networkManager.onMessage("tick", (update: GameTickUpdate) => {
      this.processGameUpdate(update);
    });

    this.networkManager.onMessage("card_played", (data: any) => {
      this.playedCards.push(data.card);
      this.renderUI();
    });
  }

  start(): void {}

  stop(): void {
    const canvas = document.getElementById("renderCanvas");
    if (canvas) canvas.style.display = "block";
    const ui = document.getElementById("ui");
    if (ui) ui.style.display = "flex";

    if (this.uiContainer && this.uiContainer.parentNode) {
      this.uiContainer.parentNode.removeChild(this.uiContainer);
    }
    this.scene.dispose();
  }

  update(): void {}

  processGameUpdate(update: GameTickUpdate): void {
    const localEntity: any = update.entities[this.localPlayerId];
    if (localEntity && localEntity.hand) {
      this.hand = localEntity.hand;
      if (localEntity.playedCards) {
        // Sync local played cards with server, but don't overwrite if we have more
        if (localEntity.playedCards.length > this.playedCards.length) {
            this.playedCards = localEntity.playedCards;
        }
      }
      this.renderUI();
    }
  }

  private setupUI(): void {
    this.uiContainer = document.createElement("div");
    this.uiContainer.style.position = "absolute";
    this.uiContainer.style.inset = "0";
    this.uiContainer.style.backgroundColor = "#0f172a";
    this.uiContainer.style.zIndex = "5";
    this.uiContainer.style.display = "flex";
    this.uiContainer.style.flexDirection = "column";
    this.uiContainer.style.justifyContent = "space-between";
    this.uiContainer.style.padding = "40px";
    document.body.appendChild(this.uiContainer);
    this.renderUI();
  }

  private renderUI(): void {
    if (!this.uiContainer) return;
    this.uiContainer.innerHTML = "";

    const board = document.createElement("div");
    board.style.flex = "1";
    board.style.display = "flex";
    board.style.flexWrap = "wrap";
    board.style.gap = "10px";
    board.style.alignContent = "flex-start";
    
    board.innerHTML = `<h2 style="width: 100%; color: #fff; margin-bottom: 20px;">Global Played Cards</h2>`;
    this.playedCards.forEach(card => {
        const cardEl = this.createCardElement(card);
        board.appendChild(cardEl);
    });

    const handDiv = document.createElement("div");
    handDiv.style.display = "flex";
    handDiv.style.gap = "10px";
    handDiv.style.justifyContent = "center";
    handDiv.style.padding = "20px";
    handDiv.style.backgroundColor = "rgba(255,255,255,0.05)";
    handDiv.style.borderRadius = "16px";

    this.hand.forEach((card, idx) => {
        const cardEl = this.createCardElement(card, true);
        cardEl.onclick = () => this.playCard(idx);
        handDiv.appendChild(cardEl);
    });

    const drawBtn = document.createElement("button");
    drawBtn.innerText = "DRAW CARD";
    drawBtn.className = "primary-button";
    drawBtn.style.marginTop = "20px";
    drawBtn.onclick = () => this.drawCard();

    this.uiContainer.appendChild(board);
    this.uiContainer.appendChild(handDiv);
    this.uiContainer.appendChild(drawBtn);
  }

  private createCardElement(value: number, interactive: boolean = false): HTMLDivElement {
      const el = document.createElement("div");
      el.style.width = "80px";
      el.style.height = "120px";
      el.style.backgroundColor = "#fff";
      el.style.color = "#000";
      el.style.borderRadius = "8px";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontSize = "24px";
      el.style.fontWeight = "bold";
      el.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)";
      el.innerText = value.toString();
      if (interactive) {
          el.style.cursor = "pointer";
          el.onmouseenter = () => el.style.transform = "translateY(-10px)";
          el.onmouseleave = () => el.style.transform = "translateY(0)";
          el.style.transition = "transform 0.2s";
      }
      return el;
  }

  private playCard(index: number) {
      this.networkManager.sendRawInput("PLAY_CARD", { cardIndex: index });
  }

  private drawCard() {
      this.networkManager.sendRawInput("DRAW_CARD", {});
  }
}
