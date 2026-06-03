import type { GamePlugin } from "../game/plugin";
import { MobaPlugin } from "./moba";
import { FpsPlugin } from "./fps";
import { CardGamePlugin } from "./card";
import { BattleRoyalePlugin } from "./battle-royale";
import { RacingPlugin } from "./racing";

/**
 * Maps gameType string to the corresponding plugin class instance.
 * Indie developers can simply import and add their custom plugins here.
 */
export function getGamePlugin(gameType: string): GamePlugin {
  switch (gameType) {
    case "fps":
      return new FpsPlugin();
    case "card":
      return new CardGamePlugin();
    case "battle_royale":
      return new BattleRoyalePlugin();
    case "racing":
      return new RacingPlugin();
    case "moba":
    default:
      return new MobaPlugin();
  }
}
