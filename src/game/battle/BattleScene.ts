// The battle scene (00-master-design §13, 08-art-pipeline §18): a Phaser scene drawn over the map
// that plays one combat as a split-screen cutscene, then hands control back. It only shows what the
// engine already decided. Z, X, Enter, Space, Escape or a click skips it.

import Phaser from "phaser";
import { packColorNumber } from "../artPack";
import { SCENE } from "./backdrops";
import type { BattlePlan } from "./plan";
import { BattleRenderer } from "./renderer";

const TEXTURE_KEY = "battle-scene";
const SKIP_KEYS = new Set(["z", "Z", "x", "X", "Enter", " ", "Escape"]);
/** Ignore skips for a moment, so the key press that ordered the attack can't skip its scene. */
const SKIP_GRACE_MS = 200;

export interface BattlePlayer {
  play(plan: BattlePlan): Promise<void>;
}

interface Playing {
  readonly renderer: BattleRenderer;
  t: number;
  readonly resolve: () => void;
}

export class BattleScene extends Phaser.Scene implements BattlePlayer {
  private texture: Phaser.Textures.CanvasTexture | null = null;
  private image?: Phaser.GameObjects.Image;
  private dim?: Phaser.GameObjects.Rectangle;
  private playing: Playing | null = null;

  private markReady: () => void = () => undefined;
  /** Resolves once Phaser has created the scene and its canvas. */
  readonly ready = new Promise<void>((resolve) => {
    this.markReady = resolve;
  });

  constructor() {
    super({ key: "battle", active: true });
  }

  create(): void {
    this.texture = this.textures.createCanvas(TEXTURE_KEY, SCENE.width, SCENE.height);
    this.dim = this.add.rectangle(0, 0, 1, 1, packColorNumber("uiBg")).setOrigin(0).setVisible(false);
    this.image = this.add.image(0, 0, TEXTURE_KEY).setVisible(false);
    window.addEventListener("keydown", (event) => {
      if (!SKIP_KEYS.has(event.key) || !this.playing) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.skip();
    }, { capture: true });
    this.input.on("pointerdown", () => this.skip());
    this.markReady();
  }

  async play(plan: BattlePlan): Promise<void> {
    await this.ready;
    this.finish();
    const canvas = this.texture?.getSourceImage();
    if (!(canvas instanceof HTMLCanvasElement)) return Promise.resolve();
    return new Promise((resolve) => {
      this.playing = { renderer: new BattleRenderer(plan, canvas), t: 0, resolve };
      this.scene.bringToTop();
      this.dim?.setVisible(true);
      this.image?.setVisible(true);
      this.draw();
    });
  }

  override update(_time: number, delta: number): void {
    const playing = this.playing;
    if (!playing) return;
    playing.t += Math.min(delta, 100);
    if (playing.t >= playing.renderer.total) {
      this.finish();
      return;
    }
    this.draw();
  }

  private skip(): void {
    if (this.playing && this.playing.t > SKIP_GRACE_MS) this.finish();
  }

  private finish(): void {
    const playing = this.playing;
    this.playing = null;
    this.dim?.setVisible(false);
    this.image?.setVisible(false);
    playing?.resolve();
  }

  private draw(): void {
    const playing = this.playing;
    if (!playing || !this.texture || !this.image || !this.dim) return;
    playing.renderer.render(playing.t);
    this.texture.refresh();
    // Fit the screen at a whole-number scale when it can, so battle pixels stay square.
    const { width, height } = this.scale;
    const fit = Math.min(width / SCENE.width, height / SCENE.height);
    const scale = fit >= 1 ? Math.floor(fit) : fit;
    const alpha = playing.renderer.opacity(playing.t);
    this.cameras.main.setZoom(1).setScroll(0, 0);
    this.image.setScale(scale).setPosition(Math.round(width / 2), Math.round(height / 2)).setAlpha(alpha);
    this.dim.setSize(width, height).setAlpha(alpha * 0.85);
  }
}
