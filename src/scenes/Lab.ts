import Phaser from 'phaser';
import { COLORS, CSS, GAME_WIDTH } from '@/config/theme';
import { GENERIC_HINT, pickPraise } from '@/config/phrases';
import type { VoiceLine } from '@/config/levels';
import { addBackdrop } from '@/components/Backdrop';
import { BigButton } from '@/components/BigButton';
import { DraggableItem } from '@/components/DraggableItem';
import { DropZone } from '@/components/DropZone';
import { Effects } from '@/components/Effects';
import { IdleHint } from '@/components/HelperHand';
import { SpeechBubble } from '@/components/SpeechBubble';
import { StarCounter, flyStars } from '@/components/StarReward';
import { addBody, addTitle } from '@/components/Text';
import { Tori, type ToriMood } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { vibrate } from '@/core/Device';
import { goTo } from '@/core/SceneTransition';

const SODA_HINT: VoiceLine = {
  id: 'lab_hint_soda',
  text: 'La soda tiene mucha azúcar. Busca algo que te haga crecer fuerte.',
};

/**
 * Laboratorio de componentes (solo modo maestro): prueba de Tori, globo, voz,
 * arrastrar y soltar, efectos, estrellas y ayuda automática.
 */
export default class LabScene extends Phaser.Scene {
  constructor() {
    super('Lab');
  }

  create(): void {
    addBackdrop(this);
    addTitle(this, GAME_WIDTH / 2, 40, 'Laboratorio de componentes', 40, {
      stroke: CSS.white,
      strokeThickness: 8,
    });

    const effects = new Effects(this);
    const tori = new Tori(this, 190, 400, 0.8);
    const bubble = new SpeechBubble(this, 560, 170, { width: 560, tail: 'left', tori });
    const counter = new StarCounter(this, GAME_WIDTH - 110, 60, 0);

    new BigButton(this, 90, 60, {
      label: 'Salir',
      width: 150,
      height: 88,
      fontSize: 34,
      color: COLORS.white,
      onClick: () => void goTo(this, 'Teacher'),
    });

    // ----- Estados de Tori -----
    const moods: [string, ToriMood | 'wave' | 'say'][] = [
      ['Hablar', 'say'],
      ['Feliz', 'happy'],
      ['Pensar', 'think'],
      ['Celebrar', 'celebrate'],
      ['Saludar', 'wave'],
    ];
    moods.forEach(([label, mood], i) => {
      new BigButton(this, 120 + i * 200, 660, {
        label,
        width: 186,
        height: 88,
        fontSize: 32,
        color:
          [COLORS.sun, COLORS.grass, COLORS.turquoise, COLORS.coral, COLORS.pink][i] ?? COLORS.sun,
        onClick: () => {
          if (mood === 'say') void bubble.say(pickPraise());
          else if (mood === 'wave') tori.wave();
          else {
            tori.setMood(mood);
            if (mood === 'celebrate') {
              effects.celebrate();
              AudioManager.sfx('fanfare');
            }
          }
        },
      });
    });
    new BigButton(this, 1120, 660, {
      label: 'Música',
      width: 186,
      height: 88,
      fontSize: 32,
      color: COLORS.grape,
      onClick: () => {
        musicOn = !musicOn;
        if (musicOn) AudioManager.playMusic();
        else AudioManager.stopMusic();
      },
    });
    let musicOn = false;

    // ----- Arrastrar y soltar -----
    const box = this.add.graphics();
    box.fillStyle(COLORS.coral).fillRoundedRect(880, 300, 260, 170, 28);
    box.lineStyle(6, COLORS.ink).strokeRoundedRect(880, 300, 260, 170, 28);
    box.fillStyle(COLORS.white, 0.3).fillRoundedRect(900, 316, 220, 30, 14);
    addBody(this, 1010, 500, 'Lonchera', 26, { stroke: CSS.white, strokeThickness: 6 });

    const zone = new DropZone(this, 1010, 385, {
      width: 260,
      height: 170,
      showOutline: true,
      slots: [
        { x: -70, y: 0 },
        { x: 0, y: 0 },
        { x: 70, y: 0 },
      ],
    });

    const fruit = (color: number, leaf: boolean): Phaser.GameObjects.GameObject[] => {
      const g = this.add.graphics();
      g.fillStyle(color).fillEllipse(0, 4, 74, 84);
      g.lineStyle(5, COLORS.ink).strokeEllipse(0, 4, 74, 84);
      if (leaf) g.fillStyle(COLORS.grassDark).fillEllipse(14, -40, 30, 16);
      return [g];
    };
    const soda = (): Phaser.GameObjects.GameObject[] => {
      const g = this.add.graphics();
      g.fillStyle(0xe8505b).fillRoundedRect(-30, -46, 60, 92, 12);
      g.lineStyle(5, COLORS.ink).strokeRoundedRect(-30, -46, 60, 92, 12);
      g.fillStyle(COLORS.white).fillRect(-30, -10, 60, 20);
      return [g, addBody(this, 0, 0, 'soda', 18)];
    };

    const good = new Set(['mango', 'jocote']);
    const items: DraggableItem[] = [];
    const onDrop = (item: DraggableItem, z: DropZone | null): 'accept' | 'reject' | 'ignore' => {
      if (!z) return 'ignore';
      if (good.has(item.itemId)) {
        AudioManager.sfx('success');
        vibrate(30);
        effects.successAt(z.x, z.y);
        tori.setMood('happy');
        void bubble.say(pickPraise());
        void flyStars(this, { x: z.x, y: z.y }, counter, 1, effects);
        return 'accept';
      }
      AudioManager.sfx('hint');
      tori.setMood('think');
      void bubble.say(SODA_HINT);
      return 'reject';
    };
    const add = (
      id: string,
      x: number,
      y: number,
      content: Phaser.GameObjects.GameObject[],
    ): void => {
      items.push(
        new DraggableItem(this, x, y, {
          id,
          content,
          zones: [zone],
          onDrop,
          width: 100,
          height: 110,
        }),
      );
    };
    add('mango', 560, 420, fruit(0xffb43c, true));
    add('soda', 700, 420, soda());
    add('jocote', 630, 540, fruit(0xe8505b, true));

    // ----- Ayuda automática (8 s sin tocar) -----
    new IdleHint(
      this,
      () => {
        const next = items.find((it) => good.has(it.itemId) && !it.isPlaced);
        return next
          ? { kind: 'drag', from: next.homePosition, to: { x: zone.x, y: zone.y } }
          : null;
      },
      { onHint: () => void bubble.say(GENERIC_HINT) },
    );

    this.time.delayedCall(
      400,
      () => void bubble.say({ id: 'lab_hello', text: 'Lleva la comida nutritiva a la lonchera.' }),
    );
  }
}
