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
      if (a.look === 'plate') keys.push('nino-sano', 'nino-enfermo');
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
    case 'catch':
      keys.push(a.catcher);
      [...a.good, ...a.bad].forEach((t) => keys.push(t.art));
      break;
    case 'pop':
      a.rounds.forEach((r) => [...r.good, ...r.bad].forEach((t) => keys.push(t.art)));
      break;
    case 'place':
      a.items.forEach((t) => keys.push(t.art));
      if (a.theme === 'storm') keys.push('sol');
      break;
    case 'give':
      a.friends.forEach((f) => keys.push(f.art, f.wants.art));
      a.extras.forEach((t) => keys.push(t.art));
      break;
    case 'vote':
      keys.push('urna', 'boleta', 'nino-a', 'nina-b', 'nino-c', 'nina-silla');
      a.rounds.forEach((r) => r.options.forEach((o) => keys.push(o.art)));
      break;
    case 'scrub':
      keys.push(a.tool);
      a.rounds.forEach((r) => keys.push(r.art));
      break;
    case 'runner':
      keys.push(a.runner);
      [...a.good, ...a.bad].forEach((t) => keys.push(t.art));
      break;
    case 'dots':
      a.rounds.forEach((r) => keys.push(r.art));
      break;
    case 'hidden':
      [...a.find, ...a.decoys].forEach((t) => keys.push(t.art));
      break;
    case 'maze':
      keys.push(a.walker, a.goal.art);
      Object.values(a.dangers).forEach((t) => keys.push(t.art));
      Object.values(a.props ?? {}).forEach((t) => keys.push(t.art));
      a.legend?.items.forEach((t) => keys.push(t.art));
      // En el tablero, la silla de ruedas va con la rueda aparte (para que gire).
      if (a.walker === 'nina-silla') keys.push('nina-silla-cuerpo', 'rueda-silla');
      break;
    case 'thumbs':
      keys.push('cara-feliz', 'cara-triste');
      a.cards.forEach((c) => keys.push(c.art));
      break;
    case 'fish':
      keys.push('nino-a');
      a.rounds.forEach((r) => [...r.good, ...r.bad].forEach((t) => keys.push(t.art)));
      break;
    case 'match':
      a.pairs.forEach((p) => keys.push(p.left.art, p.right.art));
      break;
    case 'stack':
      a.pieces.forEach((p) => keys.push(p.art));
      break;
    case 'simon':
      a.pads.forEach((p) => keys.push(p.art));
      break;
    case 'share':
      a.friends.forEach((f) => keys.push(f.art));
      a.rounds.forEach((r) => keys.push(r.item.art));
      break;
    case 'cross':
      keys.push('carrito', 'pelota', 'mama', 'nino');
      break;
    case 'talk':
      keys.push(...a.kids, 'mano-arriba', 'cara-triste');
      a.hands.ideas.forEach((i) => keys.push(i.art));
      a.speak.rounds.forEach((rd) => rd.options.forEach((o) => keys.push(o.art)));
      break;
    case 'board':
      keys.push('nino-a');
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
    this.mistakeKeys = new Set();
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

  private mistakeKeys = new Set<string>();

  /** Error amable que cuenta para las estrellas solo la primera vez (por clave). */
  protected mistakeOnce(key: string, hint: VoiceLine): void {
    if (this.mistakeKeys.has(key)) {
      void this.say(hint);
      return;
    }
    this.mistakeKeys.add(key);
    this.mistake(hint);
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
