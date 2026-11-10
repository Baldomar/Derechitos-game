import Phaser from 'phaser';
import { COLORS, CSS, FONTS, GAME_WIDTH, TEXT_RESOLUTION } from '@/config/theme';
import { ensureArt, tex } from '@/art/Art';
import { addBackdrop } from '@/components/Backdrop';
import { BigButton } from '@/components/BigButton';
import { IdleHint } from '@/components/HelperHand';
import { addBody, addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { goTo } from '@/core/SceneTransition';

const TEACHER_HOLD_MS = 3000;
const LETTER_COLORS = [
  COLORS.coral,
  COLORS.sun,
  COLORS.turquoise,
  COLORS.grape,
  COLORS.grass,
  COLORS.orange,
  COLORS.pink,
];

/** Título: logo animado letra por letra, Tori saluda y botón "¡Jugar!". Pulsación larga de 3 s en el logo → modo maestro. */
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    ensureArt(this, ['sol', 'nube', 'izote', 'palmera', 'arbol']);
    addBackdrop(this, { clouds: false });
    this.addScenery();

    const logo = this.buildLogo();
    this.setupTeacherGesture(logo);

    const tori = new Tori(this, 230, 470, 0.72);
    this.time.delayedCall(1000, () => tori.wave());
    this.time.addEvent({ delay: 6000, loop: true, callback: () => tori.wave() });
    AudioManager.playMusic();

    const play = new BigButton(this, GAME_WIDTH / 2, 520, {
      label: '¡Jugar!',
      width: 340,
      height: 120,
      fontSize: 58,
      color: COLORS.sun,
      pulse: true,
      onClick: () => void goTo(this, GameState.introSeen ? 'WorldMap' : 'Intro'),
    });
    new IdleHint(this, () => ({ kind: 'tap', x: play.x, y: play.y }));

    addBody(this, GAME_WIDTH - 16, 706, 'v1.0', 16)
      .setOrigin(1, 1)
      .setAlpha(0.5);
  }

  private addScenery(): void {
    const sun = this.add.image(1150, 110, tex('sol')).setScale(0.75);
    if (!prefersReducedMotion())
      this.tweens.add({ targets: sun, angle: 360, duration: 30000, repeat: -1 });
    [
      [140, 90, 0.9, 70000],
      [620, 60, 0.7, 90000],
      [980, 150, 0.8, 80000],
    ].forEach(([x, y, s, d]) => {
      const c = this.add.image(x ?? 0, y ?? 0, tex('nube')).setScale(s ?? 1);
      if (!prefersReducedMotion()) {
        this.tweens.add({
          targets: c,
          x: GAME_WIDTH + 200,
          duration: d ?? 80000,
          repeat: -1,
          onRepeat: () => c.setX(-200),
        });
      }
    });
    this.add.image(1060, 560, tex('izote')).setScale(0.8);
    this.add.image(1190, 540, tex('palmera')).setScale(0.7);
    this.add.image(930, 590, tex('arbol')).setScale(0.55);
  }

  /** "Derechitos" con letras de colores que caen y ondulan. */
  private buildLogo(): Phaser.GameObjects.Container {
    const logo = this.add.container(GAME_WIDTH / 2, 190);
    const word = 'Derechitos';
    const letters = [...word].map((ch, i) =>
      this.add
        .text(0, 0, ch, {
          fontFamily: FONTS.title,
          fontSize: '132px',
          fontStyle: '800',
          color: `#${(LETTER_COLORS[i % LETTER_COLORS.length] ?? COLORS.sun).toString(16).padStart(6, '0')}`,
          stroke: CSS.ink,
          strokeThickness: 16,
          resolution: TEXT_RESOLUTION,
          padding: { top: 20, bottom: 6 },
        })
        .setOrigin(0.5),
    );
    const total = letters.reduce((s, l) => s + l.width - 22, 0);
    let x = -total / 2;
    letters.forEach((l, i) => {
      l.setX(x + (l.width - 22) / 2);
      x += l.width - 22;
      logo.add(l);
      if (prefersReducedMotion()) return;
      l.setY(-400);
      this.tweens.add({
        targets: l,
        y: 0,
        delay: 150 + i * 70,
        duration: 700,
        ease: 'Bounce.easeOut',
      });
      this.tweens.add({
        targets: l,
        y: -10,
        delay: 1300 + i * 90,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
    const subtitle = addTitle(this, 0, 110, 'la aventura de Tori', 50, {
      stroke: CSS.white,
      strokeThickness: 8,
    });
    logo.add(subtitle);
    if (!prefersReducedMotion()) {
      subtitle.setScale(0);
      this.tweens.add({
        targets: subtitle,
        scale: 1,
        delay: 1000,
        duration: motion(500),
        ease: 'Back.easeOut',
      });
    }
    return logo;
  }

  /** Mantener presionado el logo 3 s abre el modo maestro (oculto para los niños). */
  private setupTeacherGesture(logo: Phaser.GameObjects.Container): void {
    logo.setSize(820, 280).setInteractive();
    let timer: Phaser.Time.TimerEvent | null = null;
    const cancel = (): void => {
      timer?.remove();
      timer = null;
    };
    logo.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      cancel();
      timer = this.time.delayedCall(TEACHER_HOLD_MS, () => {
        timer = null;
        void goTo(this, 'Teacher');
      });
    });
    logo.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, cancel);
    logo.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, cancel);
  }
}
