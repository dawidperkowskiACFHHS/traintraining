import Phaser from 'phaser';
import type { State } from './types';
import {
  townCanvas,
  characterCanvas,
  playerCanvas,
  coverCanvas,
  buildingCanvas,
  treeCanvas,
  marketCanvas,
  residentCanvas,
  CHARACTER_POSES,
} from './art';
import { actorPose, poseFrame } from './animation';
import { canTag, stealthState } from './stealth';
import { CardFeedback } from './card-feedback';
import { CARDS } from './cards';
import { canSeeActor, coverAt, TAG_RANGE } from './local';
import { distance } from './random';
import { residentAt } from './residents';
import { inTransit } from './transit';
import { serviceCanvas } from './service-art';
import { SpeechBubbles } from './speech-bubbles';
import { captureMoment } from './capture-presentation';
export class TownScene extends Phaser.Scene {
  getState: () => State;
  onWalk: (x: number, y: number) => void;
  private terrain?: Phaser.GameObjects.Image;
  private people: Phaser.GameObjects.Image[] = [];
  private silhouette?: Phaser.GameObjects.Image;
  private resident: Phaser.GameObjects.Image[] = [];
  private coverSprites: Phaser.GameObjects.Image[] = [];
  private foreground: Phaser.GameObjects.Image[] = [];
  private signs: Phaser.GameObjects.Text[] = [];
  private last = '';
  private appearanceKey = '';
  private playerTexturePrefix = 'player-a';
  private focus?: Phaser.GameObjects.Zone;
  private markers?: Phaser.GameObjects.Graphics;
  private train?: Phaser.GameObjects.Container;
  private service?: Phaser.GameObjects.Image;
  private serviceLabel?: Phaser.GameObjects.Text;
  private status?: Phaser.GameObjects.Text;
  private feedback?: CardFeedback;
  private captureEffect?: Phaser.GameObjects.Graphics;
  private speech?: SpeechBubbles;
  private lastEvent = 0;
  private lastPositions = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  private walkUntil = [0, 0, 0];
  constructor(getState: () => State, onWalk: (x: number, y: number) => void) {
    super('town');
    this.getState = getState;
    this.onWalk = onWalk;
  }
  create() {
    for (const kind of ['local', 'express', 'bus', 'ferry'] as const)
      for (const open of [true, false])
        this.textures.addCanvas(`service-${kind}-${open}`, serviceCanvas(kind, open));
    this.service = this.add.image(0, 0, 'service-local-true').setOrigin(0.5, 0).setVisible(false);
    this.serviceLabel = this.add
      .text(0, 0, '', {
        fontFamily: 'Atkinson, sans-serif',
        fontSize: 8,
        color: '#694b39',
        backgroundColor: '#faf3da',
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setResolution(4)
      .setDepth(10001);
    for (const kind of ['bush', 'crate', 'hedge'] as const)
      this.textures.addCanvas(`cover-${kind}`, coverCanvas(kind));
    this.textures.addCanvas('tree-round', treeCanvas(false));
    this.textures.addCanvas('tree-pine', treeCanvas(true));
    for (let i = 0; i < 3; i++) this.textures.addCanvas(`market-${i}`, marketCanvas(i));
    for (let id = 0; id < 3; id++)
      for (const pose of CHARACTER_POSES)
        for (let d = 0; d < 4; d++)
          for (let f = 0; f < 3; f++) {
            this.textures.addCanvas(
              `person-${id}-${pose}-${d}-${f}`,
              characterCanvas(
                ['#db9763', '#669b99', '#a77c99', '#89975e', '#9e8970', '#638f83'][id],
                id === 2 ? '#b98564' : '#e2ba85',
                d,
                f,
                id === 0 || id === 2,
                undefined,
                pose,
              ),
            );
          }
    for (let id = 0; id < 3; id++)
      for (const pose of ['idle', 'walk', 'interact'] as const)
        for (let dir = 0; dir < 4; dir++)
          for (let frame = 0; frame < 3; frame++)
            this.textures.addCanvas(
              `resident-${id}-${pose}-${dir}-${frame}`,
              residentCanvas(id, dir, frame, pose),
            );
    this.status = this.add
      .text(0, 0, '', {
        fontFamily: 'Atkinson, sans-serif',
        fontSize: 8,
        color: '#43354e',
        backgroundColor: '#fff6d9',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setResolution(4)
      .setDepth(10002);
    this.feedback = new CardFeedback(this);
    this.captureEffect = this.add.graphics().setDepth(10004);
    this.speech = new SpeechBubbles(document.getElementById('speech-layer')!);
    this.focus = this.add.zone(0, 0, 1, 1);
    this.cameras.main.setBounds(0, 0, 960, 704);
    const fitPixels = () =>
      this.cameras.main.setZoom(
        Math.max(2, Math.ceil(this.scale.width / 960), Math.ceil(this.scale.height / 704)),
      );
    fitPixels();
    this.scale.on(Phaser.Scale.Events.RESIZE, fitPixels);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, fitPixels),
    );
    this.cameras.main.startFollow(this.focus, false, 0.13, 0.13);
    this.people = [0, 1, 2].map((id) => this.add.image(0, 0, `person-${id}-idle-2-0`).setOrigin(0.5, 0.92));
    this.silhouette = this.add
      .image(0, 0, 'person-0-idle-2-0')
      .setOrigin(0.5, 0.92)
      .setTint(0xc9eeff)
      .setAlpha(0.28)
      .setDepth(9999)
      .setVisible(false);
    this.resident = [3, 4, 5].map((id) => this.add.image(0, 0, `person-${id}-2-0`).setOrigin(0.5, 0.92));
    this.markers = this.add.graphics().setDepth(10000);
    const g = this.add.graphics();
    g.fillStyle(0x3d685f);
    g.fillRoundedRect(0, 0, 210, 35, 7);
    g.fillStyle(0xe5dbb4);
    g.fillRect(4, 5, 202, 8);
    g.fillStyle(0x82aaa6);
    for (let x = 9; x < 195; x += 28) g.fillRect(x, 17, 20, 10);
    g.fillStyle(0x354d45);
    g.fillCircle(27, 36, 6);
    g.fillCircle(178, 36, 6);
    this.train = this.add.container(0, 40 * 16, [g]).setDepth(40 * 16);
    this.train.setAlpha(0.65);
    this.train.add(
      this.add
        .text(70, 6, 'NON-STOP', { fontFamily: 'Atkinson, sans-serif', fontSize: 7, color: '#193b47' })
        .setResolution(4),
    );
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown()) {
        const pos = this.cameras.main.getWorldPoint(p.x, p.y);
        this.onWalk(pos.x / 16, pos.y / 16);
      }
    });
    this.lastEvent = this.getState().events.length;
  }
  update() {
    const s = this.getState(),
      a = s.actors[0];
    const capture = captureMoment(s),
      age = capture ? performance.now() - capture.at : 0;
    if (!a || !this.focus) return;
    const appearanceKey = JSON.stringify(s.appearance);
    if (appearanceKey !== this.appearanceKey) {
      const previousPrefix = this.playerTexturePrefix;
      this.playerTexturePrefix = previousPrefix === 'player-a' ? 'player-b' : 'player-a';
      for (const pose of CHARACTER_POSES)
        for (let direction = 0; direction < 4; direction++)
          for (let frame = 0; frame < 3; frame++)
            this.textures.addCanvas(
              `${this.playerTexturePrefix}-${pose}-${direction}-${frame}`,
              playerCanvas(s.appearance, direction, frame, pose),
            );
      this.people[0].setTexture(`${this.playerTexturePrefix}-idle-${a.dir}-0`);
      for (const pose of CHARACTER_POSES)
        for (let direction = 0; direction < 4; direction++)
          for (let frame = 0; frame < 3; frame++) {
            const key = `${previousPrefix}-${pose}-${direction}-${frame}`;
            if (this.textures.exists(key)) this.textures.remove(key);
          }
      this.appearanceKey = appearanceKey;
    }
    const station = s.world.stations[a.station],
      key = `${s.world.seed}:${a.station}:${a.inside}`;
    if (this.last !== key) {
      const arriving = !!this.last;
      this.last = key;
      this.feedback?.clear();
      this.speech?.clear();
      if (arriving && !s.settings.reducedMotion) this.cameras.main.fadeIn(180, 15, 35, 50);
      this.terrain?.destroy();
      if (this.textures.exists('town-current')) this.textures.remove('town-current');
      this.textures.addCanvas('town-current', townCanvas(station, a.inside, false, true));
      this.terrain = this.add.image(0, 0, 'town-current').setOrigin(0).setDepth(-1);
      this.foreground.forEach((sprite) => sprite.destroy());
      this.signs.forEach((sign) => sign.destroy());
      this.foreground = [];
      this.signs = [];
      const sign = (text: string, x: number, y: number, size: number, maxWidth: number) => {
        const label = this.add
          .text(x, y, text, {
            fontFamily: 'Atkinson, sans-serif',
            fontSize: size,
            color: '#f7edcf',
            backgroundColor: '#29483f',
            padding: { x: 2, y: 1 },
          })
          .setResolution(4)
          .setOrigin(0, 0.5)
          .setDepth(y + 35);
        if (label.width > maxWidth) label.setScale(maxWidth / label.width, 1);
        label.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        this.signs.push(label);
      };
      station.local.buildings.forEach((b, i) => {
        const texture = `building-${i}`;
        if (this.textures.exists(texture)) this.textures.remove(texture);
        this.textures.addCanvas(texture, buildingCanvas(b, a.inside === i));
        this.foreground.push(
          this.add
            .image(b.x * 16 - 10, b.y * 16 - 12, texture)
            .setOrigin(0)
            .setDepth(a.inside === i ? -0.5 : (b.y + b.h) * 16 + 30),
        );
        if (['cafe', 'library'].includes(b.kind) && a.inside !== i)
          sign(b.kind === 'cafe' ? 'CAFÉ' : 'BOOKS', b.x * 16 + 8, (b.y + b.h) * 16 - 11, 7, 29);
      });
      for (let y = 0; y < station.local.height - 2; y++)
        for (let x = 0; x < station.local.width; x++)
          if (station.local.tiles[y * station.local.width + x] === 7)
            this.foreground.push(
              this.add
                .image(
                  x * 16 - 24,
                  y * 16 - 54,
                  station.kind === 'forest' && (x + y) % 3 === 0 ? 'tree-pine' : 'tree-round',
                )
                .setOrigin(0)
                .setDepth(y * 16 + 29),
            );
      station.local.props.forEach((p) => {
        if (p.kind === 'market')
          this.foreground.push(
            this.add
              .image(p.x * 16 - 6, p.y * 16 - 28, `market-${(p.x + p.y) % 3}`)
              .setOrigin(0)
              .setDepth((p.y + 1) * 16 + 30),
          );
        if (p.kind === 'station') sign(station.name, p.x * 16 + 6, p.y * 16 + 9, 9, 74);
        if (p.kind === 'sign') sign('RAIL', p.x * 16 - 7, p.y * 16 - 9, 7, 25);
      });
      this.coverSprites.forEach((sprite) => sprite.destroy());
      this.coverSprites = (station.local.cover ?? []).map((cover) =>
        this.add
          .image(cover.x * 16, cover.y * 16, `cover-${cover.kind}`)
          .setOrigin(0.5, 0.8)
          .setDepth(cover.y * 16 + 31),
      );
    }
    this.focus.setPosition(a.x * 16, a.y * 16);
    this.cameras.main.setLerp(s.settings.reducedMotion ? 1 : 0.13, s.settings.reducedMotion ? 1 : 0.13);
    const t = station.local;
    this.people.forEach((sprite, id) => {
      const actor = s.actors[id],
        visible =
          actor.station === a.station &&
          !inTransit(actor, s.time) &&
          (id === 0 ||
            (capture?.hider === id && capture.station === a.station) ||
            (id !== s.hider && s.hider !== 0) ||
            canSeeActor(t, a, actor, id === s.hider ? (s.rules.sightRange ?? 7) : 7));
      sprite.setVisible(visible);
      sprite.setAlpha(!capture && id === 0 && actor.hiding ? 0.78 : 1).setScale(1);
      if (visible) {
        if (distance(actor, this.lastPositions[id]) > 0.001) this.walkUntil[id] = s.time + 0.12;
        this.lastPositions[id] = { x: actor.x, y: actor.y };
        const basePose =
          capture?.tagger === id
            ? 'interact'
            : actorPose(s, actor, !!actor.path.length || s.time < this.walkUntil[id]);
        const pose =
          !s.settings.reducedMotion && this.speech?.talking(id) && basePose === 'idle'
            ? 'interact'
            : basePose;
        const f = poseFrame(pose, capture ? performance.now() / 1000 : s.time, s.settings.reducedMotion);
        sprite
          .setTexture(
            id === 0
              ? `${this.playerTexturePrefix}-${pose}-${actor.dir}-${f}`
              : `person-${id}-${pose}-${actor.dir}-${f}`,
          )
          .setPosition(Math.round(actor.x * 16), Math.round(actor.y * 16) + (this.speech?.nod(id, s) ?? 0))
          .setDepth(capture && [capture.tagger, capture.hider].includes(id) ? 10003 : actor.y * 16 + 30);
        if (capture && !s.settings.reducedMotion) {
          const p = Math.min(1, age / 320);
          if (id === capture.hider) {
            sprite.y -= Math.sin(p * Math.PI) * 5;
            const stretch = Math.sin(Math.min(1, age / 240) * Math.PI) * 0.12;
            sprite.setScale(1 + stretch, 1 - stretch);
          } else if (id === capture.tagger) {
            const dx = capture.x - actor.x,
              dy = capture.y - actor.y,
              d = Math.hypot(dx, dy) || 1;
            const reach = Math.sin(p * Math.PI) * 3;
            sprite.x += (dx / d) * reach;
            sprite.y += (dy / d) * reach;
          }
        }
      }
    });
    const player = this.people[0],
      playerBounds = player.getBounds();
    let occluded = false;
    for (const sprite of [...this.foreground, ...this.coverSprites]) {
      const bounds = sprite.getBounds();
      const overlap =
        player.visible &&
        sprite.depth > player.depth &&
        bounds.left < playerBounds.right - 4 &&
        bounds.right > playerBounds.left + 4 &&
        bounds.top < playerBounds.bottom - 5 &&
        bounds.bottom > playerBounds.top + 5;
      const target = overlap ? 0.35 : 1;
      sprite.setAlpha(
        s.settings.reducedMotion
          ? target
          : Phaser.Math.Linear(sprite.alpha, target, Math.min(1, this.game.loop.delta / 90)),
      );
      occluded ||= overlap;
    }
    this.silhouette!.setTexture(player.texture.key)
      .setPosition(player.x, player.y)
      .setVisible(occluded && player.visible);
    this.resident.forEach((sprite, i) => {
      const resident = residentAt(s, i);
      const pose =
        !s.settings.reducedMotion && this.speech?.talking(i + 3) && resident.pose !== 'walk'
          ? 'interact'
          : resident.pose;
      const frame = poseFrame(pose, s.time + i, s.settings.reducedMotion);
      sprite
        .setVisible(resident.visible)
        .setTexture(`resident-${i}-${pose}-${resident.dir}-${frame}`)
        .setPosition(
          Math.round(resident.x * 16),
          Math.round(resident.y * 16) + (this.speech?.nod(i + 3, s) ?? 0),
        )
        .setDepth(resident.y * 16 + 20);
    });
    this.train?.setPosition(((s.time * 25 + 80) % 1300) - 220, 40 * 16 + 1);
    const leg = a.journey[0],
      wait = leg ? leg.depart - s.time : Infinity;
    const serving = !!leg && wait > 0 && wait <= 7 && leg.kind !== 'walk';
    this.service!.setVisible(serving && leg?.kind !== 'ferry');
    this.serviceLabel!.setVisible(serving);
    // Timetable service stops by the party. Through trains remain on the far track.
    if (serving) {
      const approach = Math.max(0, (wait - 4) / 3),
        x = t.platform.x * 16 - approach * 650;
      const y = leg.kind === 'bus' ? 37.5 * 16 : 39 * 16;
      this.service!.setTexture(`service-${leg.kind}-${wait <= 4}`)
        .setPosition(x, y)
        .setDepth(y + 55);
      this.serviceLabel!.setPosition(t.platform.x * 16, y - 7).setText(
        `${leg.kind === 'ferry' ? 'FERRY BOARDING' : wait > 4 ? 'YOUR SERVICE ARRIVING' : 'BOARD HERE'} · ${s.world.stations[leg.to].name}`,
      );
    }
    this.markers!.clear();
    if (!inTransit(a, s.time)) {
      this.markers!.lineStyle(1, 0xfff1bf, 0.8);
      this.markers!.strokeEllipse(a.x * 16, a.y * 16 + 1, 14, 6);
      this.markers!.fillStyle(0xfff1bf, 0.9);
      this.markers!.fillTriangle(
        a.x * 16 - 3,
        a.y * 16 - 35,
        a.x * 16 + 3,
        a.y * 16 - 35,
        a.x * 16,
        a.y * 16 - 31,
      );
    }
    const cover = s.hider === 0 ? coverAt(t, a) : null;
    const stealth = stealthState(s),
      tagging = canTag(s);
    let status = '';
    if (!inTransit(a, s.time) && ['headstart', 'search'].includes(s.phase)) {
      if (s.hider === 0 && cover) {
        this.markers!.lineStyle(2.5, 0x112a3a, 0.75);
        this.markers!.strokeRoundedRect(cover.x * 16 - 9, cover.y * 16 - 9, 18, 18, 3);
        this.markers!.lineStyle(1, stealth === 'spotted' ? 0xf0ad87 : 0xbee4d5, 0.85);
        this.markers!.strokeRoundedRect(cover.x * 16 - 9, cover.y * 16 - 9, 18, 18, 3);
      }
      if (tagging) {
        const hider = s.actors[s.hider];
        this.markers!.lineStyle(2.5, 0x112a3a, 0.65).strokeCircle(hider.x * 16, hider.y * 16, TAG_RANGE * 16);
        this.markers!.lineStyle(1, 0xf1d3a0, 0.85).strokeCircle(hider.x * 16, hider.y * 16, TAG_RANGE * 16);
        status = s.settings.bindings.interact.replace('Key', '') + ' / A · TAG';
      } else if (s.hider === 0)
        status =
          stealth === 'spotted'
            ? 'SPOTTED · BREAK SIGHT'
            : stealth === 'concealed'
              ? 'CONCEALED · KEEP STILL'
              : cover
                ? s.settings.bindings.hide.replace('Key', '') + ' / X · COVER'
                : '';
    }
    const lowInView = (a.y * 16 - this.cameras.main.worldView.y) * this.cameras.main.zoom < 125;
    this.status!.setText(status)
      .setVisible(!!status)
      .setFontSize(8 * s.settings.textScale)
      .setColor(stealth === 'spotted' ? '#9b3f33' : '#43354e')
      .setPosition(a.x * 16, a.y * 16 + (lowInView ? 26 : -37));
    if (a.path.length) {
      this.markers!.lineStyle(1, 0xf9edb9, 0.7);
      this.markers!.beginPath();
      this.markers!.moveTo(a.x * 16, a.y * 16);
      for (const p of a.path) this.markers!.lineTo(p.x * 16, p.y * 16);
      this.markers!.strokePath();
      const p = a.path.at(-1)!;
      this.markers!.strokeCircle(p.x * 16, p.y * 16, 4);
    }
    for (const e of s.effects)
      if (e.target?.station === a.station) {
        this.markers!.lineStyle(2, 0xf5df93);
        this.markers!.strokeCircle(e.target.x * 16, e.target.y * 16, 8);
        if (e.card === 11) {
          const x = e.target.x * 16,
            y = e.target.y * 16;
          this.markers!.fillStyle(0xb17e55);
          this.markers!.fillRoundedRect(x - 6, y - 4, 12, 10, 2);
          this.markers!.lineStyle(1, 0x4b6150);
          this.markers!.strokeRect(x - 2, y - 7, 5, 4);
          this.markers!.fillStyle(0x4b6150);
          this.markers!.fillCircle(x - 4, y + 7, 1.5);
          this.markers!.fillCircle(x + 4, y + 7, 1.5);
        }
        if (e.card === 8) {
          const x = e.target.x * 16,
            y = e.target.y * 16;
          this.markers!.fillStyle(0xf4e3ad);
          for (let i = 0; i < 5; i++)
            this.markers!.fillCircle(
              x + Math.sin((i * Math.PI * 2) / 5) * 4,
              y + Math.cos((i * Math.PI * 2) / 5) * 4,
              2.5,
            );
          this.markers!.fillStyle(0xd19c5b);
          this.markers!.fillCircle(x, y, 2);
        }
      }
    if (s.hider === 0 && s.hideSpot) {
      this.markers!.lineStyle(1, 0xf9edb9);
      this.markers!.strokeCircle(s.hideSpot.x * 16, s.hideSpot.y * 16, 6);
    }
    if (this.lastEvent > s.events.length) this.lastEvent = 0;
    if (s.events.length > this.lastEvent) {
      const events = s.events.slice(this.lastEvent);
      this.lastEvent = s.events.length;
      for (const event of events) {
        this.speech?.observe(event, s);
        if (event.type === 'card' && event.card !== undefined) {
          const caster = s.actors[event.actor ?? s.hider];
          const visible =
            caster.id === 0 ||
            (caster.station === a.station && !inTransit(caster, s.time) && canSeeActor(t, a, caster));
          const origin = visible ? caster : a;
          const nearTop = (origin.y * 16 - this.cameras.main.worldView.y) * this.cameras.main.zoom < 200;
          const cueY = origin.y * 16 + (nearTop ? 85 : -42);
          if (visible) this.feedback?.play(event.card, caster.x * 16, cueY);
          else if (CARDS[event.card]?.type === 'curse') this.feedback?.play(event.card, a.x * 16, cueY);
        }
      }
      if (!s.settings.reducedMotion && events.some((e) => e.type === 'capture'))
        this.cameras.main.shake(110, 0.0015);
    }
    this.feedback?.update(s.settings.reducedMotion);
    const burst = this.captureEffect!;
    burst.clear();
    if (capture && capture.station === a.station) {
      const x = capture.x * 16,
        y = capture.y * 16 - 13;
      const p = s.settings.reducedMotion ? 0 : Math.min(1, age / 620),
        radius = 8 + (1 - Math.pow(1 - p, 3)) * 24;
      burst.lineStyle(2, 0xf6d47b, s.settings.reducedMotion ? 0.9 : 1 - p);
      burst.strokeCircle(x, y, radius);
      if (!s.settings.reducedMotion && p < 1)
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          burst.fillStyle(i % 2 ? 0xfff8dc : 0xe8a35c, 1 - p);
          burst.fillRect(
            Math.round(x + Math.cos(angle) * radius) - 2,
            Math.round(y + Math.sin(angle) * radius) - 2,
            4,
            4,
          );
        }
    }
    this.speech?.update(
      s,
      [...this.people, ...this.resident].map((sprite, id) => ({
        id,
        x: sprite.x,
        y: sprite.y,
        visible: sprite.visible,
      })),
      { x: this.cameras.main.worldView.x, y: this.cameras.main.worldView.y, zoom: this.cameras.main.zoom },
    );
  }
}
