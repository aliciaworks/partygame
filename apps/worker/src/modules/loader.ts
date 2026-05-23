import type { Hono } from "hono";
import { playerAuthModule } from "./player_auth/index";
import { playerProgressModule } from "./player_progress/index";
import { communicationModule } from "./communication/index";
import { hotfixModule } from "./hotfix/index";
import { playerManagementModule } from "./player_management/index";

export type ModuleManifest = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
};

export type WorkerModule<Bindings = Record<string, unknown>> = {
  manifest: ModuleManifest;
  init: (app: Hono<any>) => void;
};

const defaultModules = [
  playerAuthModule,
  playerProgressModule,
  communicationModule,
  hotfixModule,
  playerManagementModule,
] as const;

export function getModuleManifests(): ModuleManifest[] {
  return defaultModules.map((module) => module.manifest);
}

export function mountModules<Bindings = Record<string, unknown>>(
  app: Hono<any>,
  modules: readonly WorkerModule<Bindings>[] = defaultModules,
): void {
  for (const module of modules) {
    module.init(app);
  }
}
