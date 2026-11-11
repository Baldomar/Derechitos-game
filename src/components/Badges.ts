import Phaser from 'phaser';
import { COLORS, CSS } from '@/config/theme';
import type { LevelDef } from '@/config/levels';
import type { RightArea } from '@/config/rights';
import { artImage } from '@/art/Art';
import { addLockIcon } from './Icons';
import { addBody } from './Text';

/** Medalla del nivel: cinta + disco de color + ícono del derecho (forma, no solo color). */
export function addMedal(
  scene: Phaser.Scene,
  x: number,
  y: number,
  level: LevelDef,
  scale = 1,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.coral).fillTriangle(-40, -90, -6, -90, -24, -20);
  g.fillStyle(COLORS.turquoise).fillTriangle(6, -90, 40, -90, 24, -20);
  g.lineStyle(4, COLORS.ink)
    .strokeTriangle(-40, -90, -6, -90, -24, -20)
    .strokeTriangle(6, -90, 40, -90, 24, -20);
  g.fillStyle(COLORS.ink, 0.25).fillCircle(0, 8, 60);
  g.fillStyle(level.medal.color).fillCircle(0, 0, 60);
  g.lineStyle(6, COLORS.ink).strokeCircle(0, 0, 60);
  g.fillStyle(COLORS.white, 0.45).fillCircle(0, 0, 46);
  g.lineStyle(3, COLORS.ink, 0.5).strokeCircle(0, 0, 46);
  const icon = artImage(scene, 0, 0, level.icon).setScale(0.72);
  return scene.add.container(x, y, [g, icon]).setScale(scale);
}

/** Estampa del álbum. Ganada: color + ícono + nombre. Pendiente: gris con candado. */
export function addSticker(
  scene: Phaser.Scene,
  x: number,
  y: number,
  level: LevelDef,
  earned: boolean,
  size = 200,
): Phaser.GameObjects.Container {
  const s = size;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-s / 2, -s / 2 + 8, s, s, 28);
  g.fillStyle(earned ? level.zone.color : COLORS.locked).fillRoundedRect(-s / 2, -s / 2, s, s, 28);
  g.lineStyle(5, COLORS.ink).strokeRoundedRect(-s / 2, -s / 2, s, s, 28);
  // borde "troquelado" de estampa
  g.lineStyle(3, COLORS.white, 0.8).strokeRoundedRect(-s / 2 + 10, -s / 2 + 10, s - 20, s - 20, 20);
  g.fillStyle(COLORS.white, earned ? 0.9 : 0.5).fillCircle(0, -s * 0.08, s * 0.3);
  const parts: Phaser.GameObjects.GameObject[] = [g];
  if (earned) {
    parts.push(artImage(scene, 0, -s * 0.08, level.icon).setScale((s * 0.5) / 100));
    parts.push(
      addBody(scene, 0, s * 0.33, level.sticker.label, Math.round(s * 0.11), {
        wrap: s - 24,
        color: CSS.ink,
      }),
    );
  } else {
    parts.push(addLockIcon(scene, 0, -s * 0.08, s / 140));
    parts.push(addBody(scene, 0, s * 0.33, `Zona ${level.number}`, Math.round(s * 0.11)));
  }
  return scene.add.container(x, y, parts);
}

/** Medalla de un derecho de la Villa (color e ícono del derecho). Sin ganar: gris con "?". */
export function addRightMedal(
  scene: Phaser.Scene,
  x: number,
  y: number,
  right: RightArea,
  earned: boolean,
  scale = 1,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const color = earned ? right.color : COLORS.locked;
  g.fillStyle(earned ? COLORS.coral : 0x9aa5b8).fillTriangle(-40, -90, -6, -90, -24, -20);
  g.fillStyle(earned ? COLORS.turquoise : 0x9aa5b8).fillTriangle(6, -90, 40, -90, 24, -20);
  g.lineStyle(4, COLORS.ink)
    .strokeTriangle(-40, -90, -6, -90, -24, -20)
    .strokeTriangle(6, -90, 40, -90, 24, -20);
  g.fillStyle(COLORS.ink, 0.25).fillCircle(0, 8, 60);
  g.fillStyle(color).fillCircle(0, 0, 60);
  g.lineStyle(6, COLORS.ink).strokeCircle(0, 0, 60);
  g.fillStyle(COLORS.white, 0.45).fillCircle(0, 0, 46);
  const parts: Phaser.GameObjects.GameObject[] = [g];
  if (earned) parts.push(artImage(scene, 0, 0, right.icon).setScale(0.72));
  else parts.push(addBody(scene, 0, 2, '?', 56, { color: CSS.ink }));
  return scene.add.container(x, y, parts).setScale(scale);
}
