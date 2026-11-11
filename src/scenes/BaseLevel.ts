import {
  getLevelByScene,
  type LevelContent,
  type LevelDef,
  type LevelSceneKey,
  type VoiceLine,
} from '@/config/levels';
import { findLevelActivity } from '@/config/rights';
import { GameState } from '@/core/GameState';
import { goTo } from '@/core/SceneTransition';
import { GameplayScene } from './GameplayScene';

/**
 * Base de los juegos completos con escena propia (casa segura, lonchera, clínica, rompecabezas…).
 * Cada uno pertenece a un derecho de la isla (ver config/rights.ts): al terminar, sus estrellas
 * cuentan para ese derecho y se vuelve a su pantalla.
 * Toda la lógica pedagógica vive en GameplayScene.
 */
export abstract class BaseLevel extends GameplayScene {
  protected readonly level: LevelDef;
  private rightId = '';
  private activityId = '';

  constructor(key: LevelSceneKey) {
    super(key);
    this.level = getLevelByScene(key);
  }

  override init(data?: unknown): void {
    super.init(data);
    const d = (data ?? {}) as { rightId?: string; activityId?: string };
    const found = findLevelActivity(this.level.sceneKey);
    this.rightId = d.rightId ?? found?.right.id ?? '';
    this.activityId = d.activityId ?? found?.activity.id ?? '';
  }

  protected headerTitle(): string {
    return this.level.title;
  }

  protected introLines(): VoiceLine[] {
    return this.level.dialog.intro;
  }

  protected backButton(): { label: string; go: () => void } {
    return {
      label: 'Volver',
      go: () =>
        void (this.rightId
          ? goTo(this, 'RightHub', { rightId: this.rightId })
          : goTo(this, 'WorldMap')),
    };
  }

  protected onFinished(): void {
    GameState.completeLevel(this.level.id, this.errors);
    if (!this.rightId) {
      void goTo(this, 'WorldMap');
      return;
    }
    const result = GameState.completeActivity(this.rightId, this.activityId, this.errors);
    void goTo(this, 'ActivityReward', result);
  }

  /** Contenido tipado del nivel. */
  protected contentOf<K extends LevelContent['kind']>(kind: K): Extract<LevelContent, { kind: K }> {
    const c = this.level.content;
    if (c.kind !== kind) throw new Error(`El nivel ${this.level.id} no es de tipo ${kind}`);
    return c as Extract<LevelContent, { kind: K }>;
  }
}
