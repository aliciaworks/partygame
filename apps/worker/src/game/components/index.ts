import { Component } from "../ecs/component";

export class TransformComponent extends Component {
  readonly type = "transform";

  x = 0;
  y = 0;
  rotation = 0;
  scaleX = 1;
  scaleY = 1;

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

  fromJSON(data: Record<string, unknown>): void {
    this.x = (data.x as number) ?? 0;
    this.y = (data.y as number) ?? 0;
    this.rotation = (data.rotation as number) ?? 0;
    this.scaleX = (data.scaleX as number) ?? 1;
    this.scaleY = (data.scaleY as number) ?? 1;
  }
}

export class HealthComponent extends Component {
  readonly type = "health";

  hp = 100;
  maxHp = 100;
  isDead = false;

  constructor(maxHp = 100) {
    super();
    this.maxHp = maxHp;
    this.hp = maxHp;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.isDead = this.hp === 0;
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

  fromJSON(data: Record<string, unknown>): void {
    this.hp = (data.hp as number) ?? 100;
    this.maxHp = (data.maxHp as number) ?? 100;
    this.isDead = (data.isDead as boolean) ?? false;
  }
}

export class VelocityComponent extends Component {
  readonly type = "velocity";

  vx = 0;
  vy = 0;

  constructor(vx = 0, vy = 0) {
    super();
    this.vx = vx;
    this.vy = vy;
  }

  toJSON() {
    return { vx: this.vx, vy: this.vy };
  }

  fromJSON(data: Record<string, unknown>): void {
    this.vx = (data.vx as number) ?? 0;
    this.vy = (data.vy as number) ?? 0;
  }
}

export class InputComponent extends Component {
  readonly type = "input";

  moveX = 0;
  moveY = 0;
  isJumping = false;
  isSprinting = false;

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

  fromJSON(data: Record<string, unknown>): void {
    this.moveX = (data.moveX as number) ?? 0;
    this.moveY = (data.moveY as number) ?? 0;
    this.isJumping = (data.isJumping as boolean) ?? false;
    this.isSprinting = (data.isSprinting as boolean) ?? false;
  }
}
