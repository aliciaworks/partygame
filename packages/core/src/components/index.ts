import { Component } from '../ecs/component';

/**
 * TransformComponent represents position, rotation, and scale in the game world.
 */
export class TransformComponent extends Component {
  readonly type = 'transform';

  x: number = 0;
  y: number = 0;
  rotation: number = 0; // radians
  scaleX: number = 1;
  scaleY: number = 1;

  constructor(x = 0, y = 0, rotation = 0) {
    super();
    this.x = x;
    this.y = y;
    this.rotation = rotation;
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      rotation: this.rotation,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
    };
  }

  fromJSON(data: Record<string, unknown>) {
    this.x = (data.x as number) ?? 0;
    this.y = (data.y as number) ?? 0;
    this.rotation = (data.rotation as number) ?? 0;
    this.scaleX = (data.scaleX as number) ?? 1;
    this.scaleY = (data.scaleY as number) ?? 1;
  }
}

/**
 * HealthComponent tracks entity HP and death state.
 */
export class HealthComponent extends Component {
  readonly type = 'health';

  hp: number = 100;
  maxHp: number = 100;
  isDead: boolean = false;

  constructor(maxHp = 100) {
    super();
    this.maxHp = maxHp;
    this.hp = maxHp;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.isDead = true;
    }
  }

  heal(amount: number): void {
    if (this.isDead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  toJSON() {
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      isDead: this.isDead,
    };
  }

  fromJSON(data: Record<string, unknown>) {
    this.hp = (data.hp as number) ?? 100;
    this.maxHp = (data.maxHp as number) ?? 100;
    this.isDead = (data.isDead as boolean) ?? false;
  }
}

/**
 * VelocityComponent tracks movement velocity.
 */
export class VelocityComponent extends Component {
  readonly type = 'velocity';

  vx: number = 0;
  vy: number = 0;

  constructor(vx = 0, vy = 0) {
    super();
    this.vx = vx;
    this.vy = vy;
  }

  toJSON() {
    return { vx: this.vx, vy: this.vy };
  }

  fromJSON(data: Record<string, unknown>) {
    this.vx = (data.vx as number) ?? 0;
    this.vy = (data.vy as number) ?? 0;
  }
}

/**
 * InputComponent stores player input commands.
 * Each frame, fresh input is added. Systems consume it.
 */
export class InputComponent extends Component {
  readonly type = 'input';

  moveX: number = 0;
  moveY: number = 0;
  isJumping: boolean = false;
  isSprinting: boolean = false;

  constructor() {
    super();
  }

  reset(): void {
    this.moveX = 0;
    this.moveY = 0;
    this.isJumping = false;
    this.isSprinting = false;
  }

  toJSON() {
    return {
      moveX: this.moveX,
      moveY: this.moveY,
      isJumping: this.isJumping,
      isSprinting: this.isSprinting,
    };
  }

  fromJSON(data: Record<string, unknown>) {
    this.moveX = (data.moveX as number) ?? 0;
    this.moveY = (data.moveY as number) ?? 0;
    this.isJumping = (data.isJumping as boolean) ?? false;
    this.isSprinting = (data.isSprinting as boolean) ?? false;
  }
}
