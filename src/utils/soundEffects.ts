// Lightweight synthetic sound effects using Web Audio API (works offline, zero external dependencies)
class SoundFX {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Bid placed chime
  playBidChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }

  // Heavy physical gavel slam with deep bass impact and glass crack shatter snap
  playHeavyGavelSlam() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      // 1. Heavy wooden impact
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.95, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);

      // 2. Sub-bass boom
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();

      sub.type = 'sine';
      sub.frequency.setValueAtTime(90, ctx.currentTime);
      sub.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.55);

      subGain.gain.setValueAtTime(0.9, ctx.currentTime);
      subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

      sub.connect(subGain);
      subGain.connect(ctx.destination);

      sub.start();
      sub.stop(ctx.currentTime + 0.55);
    } catch {}
  }


  // Gavel / Warning knock (Going once / twice)
  playGavel() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  }

  // SOLD celebration fanfare
  playSoldFanfare() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

        gain.gain.setValueAtTime(0.3, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.4);
      });
    } catch {}
  }
}

export const sounds = new SoundFX();
