import type Phaser from 'phaser';
import { CARDS } from './cards';

type Graphic = Phaser.GameObjects.Graphics;
/** Small world-space pictograms use the same line weight and travel vocabulary as the HUD. */
export function cardGlyph(g: Graphic, id: number, x: number, y: number) {
  const rect = (a: number, b: number, w: number, h: number) => g.strokeRect(x + a, y + b, w, h);
  const line = (a: number, b: number, c: number, d: number) => g.lineBetween(x + a, y + b, x + c, y + d);
  switch (id) {
    case 0:
      g.strokeCircle(x, y - 2, 6);
      g.strokeCircle(x, y - 2, 2);
      line(-5, 2, 0, 10);
      line(5, 2, 0, 10);
      break;
    case 1:
      line(-10, 5, 10, 5);
      line(-8, -5, -8, 9);
      line(8, -5, 8, 9);
      line(-8, -3, 0, 1);
      line(0, 1, 8, -3);
      break;
    case 2:
    case 10:
      rect(-7, -9, 14, 18);
      for (let i = -4; i < 7; i += 4) line(-4, i, 4, i);
      if (id === 2) rect(-3, -13, 6, 5);
      break;
    case 3:
      rect(-8, -10, 16, 17);
      rect(-5, -7, 10, 6);
      line(-6, 10, 6, -10);
      break;
    case 4:
      line(-7, 8, -7, -4);
      line(-7, -4, 8, -4);
      line(3, -9, 8, -4);
      line(3, 1, 8, -4);
      break;
    case 5:
      for (const [a, b] of [
        [-6, 0],
        [0, -4],
        [6, 0],
      ])
        g.strokeCircle(x + a, y + b, 5);
      line(-10, 7, 10, 7);
      break;
    case 6:
      rect(-10, -5, 18, 10);
      rect(8, -2, 3, 4);
      line(-7, -2, -7, 2);
      break;
    case 7:
    case 20:
      g.strokeCircle(x, y, 9);
      line(0, -6, 0, 0);
      line(0, 0, 5, 3);
      if (id === 7) {
        line(-10, -10, -6, -13);
        line(6, -13, 10, -10);
      }
      break;
    case 8:
    case 19:
      for (let i = 0; i < 5; i++) g.strokeCircle(x + Math.cos(i * 1.256) * 6, y + Math.sin(i * 1.256) * 6, 3);
      g.strokeCircle(x, y, 2);
      break;
    case 9:
    case 21:
      rect(-9, -3, 18, 10);
      line(-9, -3, -4, -8);
      line(-4, -8, 5, -8);
      line(5, -8, 9, -3);
      if (id === 9) line(0, -8, 0, 7);
      break;
    case 11:
      rect(-9, -5, 18, 14);
      rect(-4, -10, 8, 5);
      line(-3, -5, -3, 9);
      line(3, -5, 3, 9);
      break;
    case 12:
      line(-7, -7, 7, 7);
      line(7, -7, -7, 7);
      g.strokeCircle(x, y, 11);
      break;
    case 13:
    case 18:
      line(-10, -4, 9, -4);
      line(4, -9, 9, -4);
      line(-9, 4, 10, 4);
      line(-9, 4, -4, 9);
      break;
    case 14:
    case 16:
      rect(-10, -8, 12, 16);
      rect(-2, -5, 12, 16);
      if (id === 16) line(4, -1, 4, 6);
      break;
    case 15:
      rect(-8, -6, 16, 12);
      line(-8, -6, 0, -1);
      line(0, -1, 8, -6);
      break;
    case 17:
      g.strokeCircle(x, y, 10);
      g.strokeCircle(x, y, 5);
      line(0, 0, 9, -8);
      break;
    case 22:
      rect(-7, -10, 14, 12);
      line(-4, 2, 0, 7);
      line(4, 2, 0, 7);
      line(0, 7, 0, 11);
      line(-5, 11, 5, 11);
      break;
    default:
      g.strokeTriangle(x, y - 11, x - 9, y + 4, x + 9, y + 4);
      line(-9, 4, 0, 11);
      line(9, 4, 0, 11);
  }
}
export class CardFeedback {
  private effects: { id: number; x: number; y: number; at: number; label: Phaser.GameObjects.Text }[] = [];
  private graphics: Graphic;
  constructor(private scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(10003);
  }
  play(id: number, x: number, y: number) {
    const card = CARDS[id];
    if (!card) return;
    if (this.effects.length >= 5) this.effects.shift()!.label.destroy();
    const label = this.scene.add
      .text(x, y - 48, card.title, {
        fontFamily: 'Atkinson, sans-serif',
        fontSize: 8,
        color: '#49364f',
        backgroundColor: '#faf7e8',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(10004);
    this.effects.push({ id, x, y, at: this.scene.time.now, label });
  }
  clear() {
    this.effects.forEach((e) => e.label.destroy());
    this.effects = [];
    this.graphics.clear();
  }
  update(reduced: boolean) {
    this.graphics.clear();
    this.effects = this.effects.filter((effect) => {
      const t = (this.scene.time.now - effect.at) / 1200;
      if (t >= 1) {
        effect.label.destroy();
        return false;
      }
      const color = CARDS[effect.id].type === 'curse' ? 0xf1c286 : 0xb6d8a9;
      const alpha = Math.min(1, (1 - t) * 3);
      const y = effect.y - 25 - (reduced ? 0 : (1 - Math.pow(1 - t, 3)) * 12);
      this.graphics.fillStyle(0x44334e, 0.95 * alpha).fillRoundedRect(effect.x - 15, y - 15, 30, 30, 5);
      this.graphics.lineStyle(1.5, color, alpha);
      cardGlyph(this.graphics, effect.id, effect.x, y);
      if (!reduced)
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 + effect.id,
            radius = 12 + t * 24;
          this.graphics
            .fillStyle(color, alpha * (1 - t))
            .fillRect(effect.x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 2, 2);
        }
      effect.label.setPosition(effect.x, y - 22).setAlpha(alpha);
      return true;
    });
  }
}
