import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { playerAuthModule } from "./player_auth/index";
import { playerProgressModule } from "./player_progress/index";

import { hotfixModule } from "./hotfix/index";
import { playerManagementModule } from "./player_management/index";
import { matchmakingModule } from "./matchmaking/index";
import { voiceModule } from "./voice/index";
import { friendsModule } from "./friends/index";
import { chatModule } from "./chat/index";
import { leaderboardModule } from "./leaderboard/index";
import { playerProfileModule } from "./player_profile/index";
// import { economyModule } from "./economy/index";
// import { guildsModule } from "./guilds/index";
import { seasonsModule } from "./seasons/index";
import { assetsModule } from "./assets/index";

export type ModuleManifest = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
};

export type WorkerModule<Bindings = AppEnv> = {
  manifest: ModuleManifest;
  init: (app: Hono<AppEnv>) => void;
};

const defaultModules = [
  playerAuthModule,
  playerProgressModule,

  hotfixModule,
  playerManagementModule,
  matchmakingModule,
  voiceModule,
  friendsModule,
  chatModule,
  leaderboardModule,
  playerProfileModule,
  // economyModule,
  // guildsModule,
  seasonsModule,
  assetsModule,
] as const;

export function getModuleManifests(): ModuleManifest[] {
  return defaultModules.map((module) => module.manifest);
}

export function mountModules(
  app: Hono<AppEnv>,
  modules: readonly WorkerModule[] = defaultModules,
): void {
  for (const module of modules) {
    module.init(app);
  }
}
