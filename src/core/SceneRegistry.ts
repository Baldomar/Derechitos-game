import type Phaser from 'phaser';
import type { LevelSceneKey } from '@/config/levels';

type SceneModule = { default: new () => Phaser.Scene };

/**
 * Escenas cargadas bajo demanda: cada import() genera su propio chunk (división de código).
 * Boot y Preload van en el bundle inicial porque se necesitan de inmediato.
 */
export const SCENE_LOADERS = {
  Title: () => import('@/scenes/Title'),
  Intro: () => import('@/scenes/Intro'),
  WorldMap: () => import('@/scenes/WorldMap'),
  Reward: () => import('@/scenes/Reward'),
  Album: () => import('@/scenes/Album'),
  Final: () => import('@/scenes/Final'),
  Teacher: () => import('@/scenes/Teacher'),
  Lab: () => import('@/scenes/Lab'),
  Level01: () => import('@/scenes/Level01'),
  Level02: () => import('@/scenes/Level02'),
  Level03: () => import('@/scenes/Level03'),
  Level04: () => import('@/scenes/Level04'),
  Level05: () => import('@/scenes/Level05'),
  Level06: () => import('@/scenes/Level06'),
  Level07: () => import('@/scenes/Level07'),
  Level08: () => import('@/scenes/Level08'),
} satisfies Record<string, () => Promise<SceneModule>> &
  Record<LevelSceneKey, () => Promise<SceneModule>>;

export type LazySceneKey = keyof typeof SCENE_LOADERS;
export type SceneKey = LazySceneKey | 'Boot' | 'Preload';
