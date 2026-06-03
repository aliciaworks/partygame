import type { GamePlugin, Session } from "../game/plugin";

export class CardGamePlugin implements GamePlugin {
  /** Disable the game loop — card games are fully event-driven. */
  readonly tickIntervalMs = 0;

  /** Draw a random card value between 1 and 13 inclusive. */
  private randomCard(): number {
    return Math.floor(Math.random() * 13) + 1;
  }

  onJoin(session: Session) {
    // Deal 5 random cards to the joining player
    const hand: number[] = [];
    for (let i = 0; i < 5; i++) {
      hand.push(this.randomCard());
    }
    session.state = { hand, playedCards: [] };
  }

  onInput(session: Session, inputType: string, data: any) {
    if (inputType === "PLAY_CARD") {
      const cardIndex = Number(data?.cardIndex ?? -1);
      const hand: number[] = session.state?.hand ?? [];
      if (cardIndex < 0 || cardIndex >= hand.length) return;

      // Remove the card from hand and record it as played
      const [card] = hand.splice(cardIndex, 1);
      session.state.playedCards.push(card);

      // Notify all other connected players about the played card
      const message = JSON.stringify({
        type: "card_played",
        playerId: session.playerId,
        card,
      });
      session.state._broadcasts = session.state._broadcasts ?? [];
      session.state._broadcasts.push({ exclude: session.playerId, message });
    } else if (inputType === "DRAW_CARD") {
      // Add a random card to the player's hand
      session.state.hand = session.state.hand ?? [];
      session.state.hand.push(this.randomCard());
    }
  }

  onTick(_sessions: Map<string, Session>) {
    // No-op: card games are event-driven, not tick-driven
  }
}
