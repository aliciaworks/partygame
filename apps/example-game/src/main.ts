import * as BABYLON from "@babylon/core";
import { GameManager } from "./core/game-manager";
import { MOBAGame } from "./games/moba/moba-game";
import { FPSGame } from "./games/fps/fps-game";
import { NetworkManager } from "./core/network-manager";

/**
 * Main application entry point
 */
class PartyGameApp {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.Engine;
  private gameManager: GameManager;
  private networkManager: NetworkManager;
  private currentGame: MOBAGame | FPSGame | null = null;

  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error("Canvas not found");
    }

    this.engine = new BABYLON.Engine(this.canvas, true);
    this.gameManager = new GameManager(this.engine);
    this.networkManager = new NetworkManager();

    this.setupUI();
    this.setupEventListeners();
    this.handleWindowResize();
  }

  /**
   * Setup UI elements
   */
  private setupUI(): void {
    const gameMenu = document.getElementById("gameMenu");
    const gameCards = document.querySelectorAll(".game-card");
    const playButton = document.getElementById("playButton");
    const backButton = document.getElementById("backButton");
    const playerNameInput = document.getElementById(
      "playerNameInput"
    ) as HTMLInputElement;
    const backendUrlInput = document.getElementById(
      "backendUrlInput"
    ) as HTMLInputElement;

    // Load saved preferences
    const savedName = localStorage.getItem("partygame.playerName");
    const savedUrl = localStorage.getItem("partygame.backendUrl");

    if (savedName) playerNameInput.value = savedName;
    if (savedUrl) backendUrlInput.value = savedUrl;

    // Game card click handlers
    gameCards.forEach((card) => {
      card.addEventListener("click", () => {
        gameCards.forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
      });
    });

    // Play button
    playButton?.addEventListener("click", async () => {
      const playerName = playerNameInput.value.trim();
      const backendUrl = backendUrlInput.value.trim();
      const selectedCard = document.querySelector(".game-card.active");
      const gameType = selectedCard?.getAttribute("data-game");

      if (!playerName) {
        this.showError("Please enter a player name");
        return;
      }

      if (!backendUrl) {
        this.showError("Please enter a backend URL");
        return;
      }

      if (!gameType) {
        this.showError("Please select a game");
        return;
      }

      // Save preferences
      localStorage.setItem("partygame.playerName", playerName);
      localStorage.setItem("partygame.backendUrl", backendUrl);

      // Start game
      gameMenu?.classList.remove("active");
      backButton?.classList.remove("hidden");
      await this.startGame(playerName, backendUrl, gameType);
    });

    // Back button
    backButton?.addEventListener("click", () => {
      this.stopGame();
      gameMenu?.classList.add("active");
      backButton?.classList.add("hidden");
    });

    // Show menu initially
    gameMenu?.classList.add("active");
  }

  /**
   * Start the selected game
   */
  private async startGame(
    playerName: string,
    backendUrl: string,
    gameType: string,
  ): Promise<void> {
    try {
      // Update status
      this.updateStatus("Connecting...", false);

      // Initialize network manager
      await this.networkManager.connect(playerName, backendUrl);

      // Create and start game
      const scene = new BABYLON.Scene(this.engine);

      if (gameType === "moba") {
        this.currentGame = new MOBAGame(scene, this.networkManager);
      } else if (gameType === "fps") {
        this.currentGame = new FPSGame(scene, this.networkManager);
      }

      if (this.currentGame) {
        await this.currentGame.initialize();
        this.currentGame.start();
        this.updateStatus("Connected", true);
      }

      // Render loop
      this.engine.runRenderLoop(() => {
        scene.render();
        this.currentGame?.update();
      });
    } catch (error) {
      console.error("Failed to start game:", error);
      this.showError(
        `Failed to start game: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.networkManager.disconnect();
    }
  }

  /**
   * Stop current game
   */
  private stopGame(): void {
    this.engine.stopRenderLoop();

    if (this.currentGame) {
      this.currentGame.stop();
      this.currentGame = null;
    }

    this.networkManager.disconnect();
    this.updateStatus("Disconnected", false);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener("resize", () => this.handleWindowResize());
    window.addEventListener("beforeunload", () => this.stopGame());
  }

  /**
   * Handle window resize
   */
  private handleWindowResize(): void {
    this.engine.resize();
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    const errorEl = document.getElementById("error");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = "block";
    }
  }

  /**
   * Update status bar
   */
  private updateStatus(text: string, connected: boolean): void {
    const statusBar = document.getElementById("statusBar");
    const statusText = document.getElementById("statusText");
    const indicator = statusBar?.querySelector(".status-indicator");

    if (statusText) statusText.textContent = text;
    if (statusBar) {
      statusBar.classList.toggle("connected", connected);
      statusBar.classList.toggle("disconnected", !connected);
    }
    if (indicator) {
      indicator?.classList.toggle("connected", connected);
      indicator?.classList.toggle("disconnected", !connected);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new PartyGameApp();
  });
} else {
  new PartyGameApp();
}
