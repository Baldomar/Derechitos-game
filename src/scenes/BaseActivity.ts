import type { ArtKey } from '@/art/Art';
import type { VoiceLine } from '@/config/levels';
import { findActivity, getRightArea, type EngineActivity, type RightArea } from '@/config/rights';
import { GameState } from '@/core/GameState';
import { goTo } from '@/core/SceneTransition';
import { GameplayScene } from './GameplayScene';

export interface ActivityData {
  rightId: string;
  activityId: string;
}

/** Todos los dibujos que usa una actividad (para generarlos al entrar). */
function activityArt(a: EngineActivity): ArtKey[] {
  const keys: ArtKey[] = [a.icon];
  switch (a.kind) {
    case 'sort':
      a.bins.forEach((b) => keys.push(b.art));
      a.items.forEach((i) => keys.push(i.art));
      break;
    case 'sequence':
      a.steps.forEach((s) => keys.push(s.art));
      break;
    case 'memory':
      a.items.forEach((i) => keys.push(i.art));
      break;
    case 'choice':
      if (a.character) keys.push(a.character);
      a.rounds.forEach((r) => r.options.forEach((o) => keys.push(o.art)));
      break;
  }
  return [...new Set(keys)];
}

/**
 * Base de los minijuegos de la Villa de los Derechos. La misma escena sirve para cualquier
 * derecho: recibe { rightId, activityId } y lee el contenido de config/rights.ts.
 */
export abstract class BaseActivity<A extends EngineActivity> extends GameplayScene {
  protected right!: RightArea;
  protected activity!: A;
  protected art: readonly ArtKey[] = [];
  protected abstract readonly kind: A['kind'];

  override init(data: ActivityData): void {
    super.init();
    this.right = getRightArea(data.rightId);
    const { activity } = findActivity(this.right, data.activityId);
    if (activity.kind !== this.kind) {
      throw new Error(`La actividad ${data.activityId} no es de tipo ${this.kind}`);
    }
    this.activity = activity as A;
    this.art = activityArt(activity as A);
  }

  protected headerTitle(): string {
    return this.activity.title;
  }

  protected introLines(): VoiceLine[] {
    return this.activity.intro;
  }

  protected backButton(): { label: string; go: () => void } {
    return { label: 'Volver', go: () => void goTo(this, 'RightHub', { rightId: this.right.id }) };
  }

  protected onFinished(): void {
    const result = GameState.completeActivity(this.right.id, this.activity.id, this.errors);
    void goTo(this, 'ActivityReward', result);
  }
}

/** Ajusta una imagen para que quepa en un cuadro de w x h. */
export function fitImage<T extends { width: number; height: number; setScale: (s: number) => T }>(
  img: T,
  w: number,
  h: number,
  max = 1.4,
): T {
  return img.setScale(Math.min(max, w / img.width, h / img.height));
}
