import Phaser from 'phaser';
import { COLORS, CSS, FONTS, GAME_WIDTH, TEXT_RESOLUTION } from '@/config/theme';
import { addBackdrop } from '@/components/Backdrop';
import { BigButton } from '@/components/BigButton';
import { addBody, addTitle } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { GameState, type Settings } from '@/core/GameState';
import { goTo } from '@/core/SceneTransition';

type Channel = 'music' | 'sfx' | 'voice';
const CHANNELS: { key: Channel; mute: 'musicMuted' | 'sfxMuted' | 'voiceMuted'; label: string }[] =
  [
    { key: 'music', mute: 'musicMuted', label: 'Música' },
    { key: 'sfx', mute: 'sfxMuted', label: 'Efectos' },
    { key: 'voice', mute: 'voiceMuted', label: 'Voz de Tori' },
  ];

/**
 * Modo maestro (oculto: pulsación larga de 3 s sobre el logo).
 * Desbloquear todo, reiniciar progreso, volumen por canal, prueba de sonido y diagnóstico.
 */
export default class TeacherScene extends Phaser.Scene {
  constructor() {
    super('Teacher');
  }

  create(): void {
    addBackdrop(this, { sky: COLORS.cream, grass: false, clouds: false });
    addTitle(this, GAME_WIDTH / 2, 48, 'Modo maestro', 52);
    const status = addBody(this, GAME_WIDTH / 2, 104, this.statusText(), 22);

    // ---- Columna izquierda: acciones ----
    const lx = 250;
    new BigButton(this, lx, 190, {
      label: GameState.unlockAll ? 'Bloquear niveles' : 'Desbloquear todo',
      width: 400,
      height: 90,
      fontSize: 34,
      color: COLORS.turquoise,
      onClick: () => {
        GameState.setUnlockAll(!GameState.unlockAll);
        this.scene.restart();
      },
    });
    let armed = false;
    new BigButton(this, lx, 300, {
      label: 'Reiniciar progreso',
      width: 400,
      height: 90,
      fontSize: 34,
      color: COLORS.coral,
      onClick: () => {
        if (!armed) {
          armed = true;
          status.setText('Toca otra vez "Reiniciar progreso" para confirmar.');
          this.time.delayedCall(4000, () => {
            armed = false;
            status.setText(this.statusText());
          });
          return;
        }
        GameState.resetProgress();
        this.scene.restart();
      },
    });
    new BigButton(this, lx, 410, {
      label: 'Probar sonido',
      width: 400,
      height: 90,
      fontSize: 34,
      color: COLORS.grass,
      onClick: () => {
        AudioManager.playMusic();
        AudioManager.sfx('success');
        void AudioManager.speak({ id: 'test_voice', text: '¡Hola! Así suena la voz de Tori.' });
      },
    });
    new BigButton(this, lx - 105, 520, {
      label: 'Laboratorio',
      width: 190,
      height: 90,
      fontSize: 28,
      color: COLORS.grape,
      onClick: () => void goTo(this, 'Lab'),
    });
    new BigButton(this, lx + 105, 520, {
      label: 'Salir',
      width: 190,
      height: 90,
      fontSize: 34,
      color: COLORS.sun,
      onClick: () => void goTo(this, 'Title'),
    });

    // ---- Columna derecha: volumen por canal ----
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.white).fillRoundedRect(500, 145, 750, 430, 28);
    panel.lineStyle(5, COLORS.ink).strokeRoundedRect(500, 145, 750, 430, 28);
    addTitle(this, 875, 182, 'Volumen', 34);
    CHANNELS.forEach((ch, i) => this.volumeRow(ch, 270 + i * 110));

    // ---- Diagnóstico ----
    const diag = addBody(this, GAME_WIDTH / 2, 650, this.audioText(), 20, { wrap: 1180 });
    this.time.addEvent({ delay: 1000, loop: true, callback: () => diag.setText(this.audioText()) });
  }

  private volumeRow(ch: (typeof CHANNELS)[number], y: number): void {
    const get = (): Settings => GameState.settings;
    this.add
      .text(530, y, ch.label, {
        fontFamily: FONTS.title,
        fontSize: '32px',
        fontStyle: '800',
        color: CSS.ink,
        resolution: TEXT_RESOLUTION,
        padding: { top: 6 },
      })
      .setOrigin(0, 0.5);
    const value = addTitle(this, 925, y, '', 34);
    const refresh = (): void => {
      const s = get();
      value.setText(s[ch.mute] ? 'Silencio' : `${Math.round(s[ch.key] * 100)}%`);
      muteBtnLabel.setText(s[ch.mute] ? 'Activar' : 'Silenciar');
    };
    const change = (delta: number): void => {
      const s = get();
      const v = Math.round(Math.min(1, Math.max(0, s[ch.key] + delta)) * 10) / 10;
      GameState.updateSettings({ [ch.key]: v, [ch.mute]: false } as Partial<Settings>);
      if (ch.key === 'sfx') AudioManager.sfx('pop');
      refresh();
    };
    new BigButton(this, 815, y, {
      label: '−',
      width: 96,
      height: 88,
      fontSize: 48,
      color: COLORS.sky,
      onClick: () => change(-0.1),
    });
    new BigButton(this, 1035, y, {
      label: '+',
      width: 96,
      height: 88,
      fontSize: 48,
      color: COLORS.sky,
      onClick: () => change(0.1),
    });
    const mute = new BigButton(this, 1165, y, {
      label: 'Silenciar',
      width: 150,
      height: 88,
      fontSize: 26,
      color: COLORS.pink,
      onClick: () => {
        GameState.updateSettings({ [ch.mute]: !get()[ch.mute] } as Partial<Settings>);
        refresh();
      },
    });
    const muteBtnLabel = mute.labelText;
    refresh();
  }

  private statusText(): string {
    return `Estrellas: ${GameState.totalStars}/${GameState.maxStars} · Niveles completados: ${GameState.completedCount}/8 · ${
      GameState.unlockAll ? 'Todo desbloqueado' : 'Desbloqueo secuencial'
    }`;
  }

  private audioText(): string {
    const s = AudioManager.status();
    const voice = !s.tts
      ? 'este navegador no tiene voz sintética'
      : s.spanishVoice
        ? `voz: ${s.spanishVoice}`
        : `sin voz en español (${s.voices} voces instaladas)`;
    const state = s.audio === 'running' ? 'activo' : s.audio;
    return `Audio: ${state} · ${voice} · grabaciones encontradas: ${s.recordings}`;
  }
}
