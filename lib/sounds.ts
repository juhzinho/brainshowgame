'use client'

// Sound effects using Web Audio API - no external files needed
class SoundEngine {
  private ctx: AudioContext | null = null
  private enabled = true
  private bgGain: GainNode | null = null
  private bgOscillators: OscillatorNode[] = []
  private bgPlaying = false

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  toggle() {
    this.enabled = !this.enabled
    if (!this.enabled) {
      this.stopBgMusic()
    }
    return this.enabled
  }

  isEnabled() {
    return this.enabled
  }

  // Generate a beep tone
  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
    if (!this.enabled) return
    try {
      const ctx = this.getCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      // ignore audio errors
    }
  }

  // Play a sequence of notes
  private playSequence(notes: { freq: number; delay: number; duration: number; type?: OscillatorType }[], volume = 0.2) {
    if (!this.enabled) return
    notes.forEach(n => {
      setTimeout(() => this.playTone(n.freq, n.duration, n.type || 'sine', volume), n.delay * 1000)
    })
  }

  // Play a chord (multiple notes at once)
  private playChord(freqs: number[], duration: number, type: OscillatorType = 'sine', volume = 0.1) {
    if (!this.enabled) return
    freqs.forEach(f => this.playTone(f, duration, type, volume / freqs.length))
  }

  // --- Background Music ---
  startBgMusic() {
    if (!this.enabled || this.bgPlaying) return
    try {
      const ctx = this.getCtx()
      this.bgGain = ctx.createGain()
      this.bgGain.gain.setValueAtTime(0.04, ctx.currentTime)
      this.bgGain.connect(ctx.destination)

      // Create a subtle ambient pad with slow-moving notes
      const baseFreqs = [130.81, 164.81, 196] // C3, E3, G3 major chord
      this.bgOscillators = baseFreqs.map((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime)
        // Gentle detuning for richness
        osc.detune.setValueAtTime(i * 3, ctx.currentTime)

        const oscGain = ctx.createGain()
        oscGain.gain.setValueAtTime(0.3, ctx.currentTime)

        // Slow tremolo effect
        const lfo = ctx.createOscillator()
        lfo.type = 'sine'
        lfo.frequency.setValueAtTime(0.3 + i * 0.1, ctx.currentTime)
        const lfoGain = ctx.createGain()
        lfoGain.gain.setValueAtTime(0.1, ctx.currentTime)
        lfo.connect(lfoGain)
        lfoGain.connect(oscGain.gain)
        lfo.start()

        osc.connect(oscGain)
        oscGain.connect(this.bgGain!)
        osc.start()
        return osc
      })
      this.bgPlaying = true
    } catch {
      // ignore
    }
  }

  stopBgMusic() {
    try {
      this.bgOscillators.forEach(osc => {
        try { osc.stop() } catch {}
      })
      this.bgOscillators = []
      this.bgGain = null
      this.bgPlaying = false
    } catch {
      // ignore
    }
  }

  // --- Game SFX ---

  // Correct answer - ascending cheerful notes
  correct() {
    this.playSequence([
      { freq: 523, delay: 0, duration: 0.12 },
      { freq: 659, delay: 0.1, duration: 0.12 },
      { freq: 784, delay: 0.2, duration: 0.25 },
      { freq: 1047, delay: 0.35, duration: 0.3 },
    ], 0.25)
  }

  // Wrong answer - descending buzzer
  wrong() {
    this.playSequence([
      { freq: 400, delay: 0, duration: 0.15, type: 'sawtooth' },
      { freq: 300, delay: 0.12, duration: 0.2, type: 'sawtooth' },
      { freq: 200, delay: 0.3, duration: 0.3, type: 'sawtooth' },
    ], 0.15)
  }

  // Timer tick (last 5 seconds)
  tick() {
    this.playTone(800, 0.08, 'square', 0.1)
  }

  // Timer almost done (last 3 seconds)
  tickUrgent() {
    this.playTone(1000, 0.05, 'square', 0.15)
    setTimeout(() => this.playTone(1000, 0.05, 'square', 0.15), 100)
  }

  // Round start fanfare
  roundStart() {
    this.playSequence([
      { freq: 392, delay: 0, duration: 0.15 },
      { freq: 440, delay: 0.12, duration: 0.12 },
      { freq: 523, delay: 0.24, duration: 0.12 },
      { freq: 659, delay: 0.36, duration: 0.15 },
      { freq: 784, delay: 0.5, duration: 0.35 },
    ], 0.22)
  }

  // Game over / victory
  victory() {
    this.playSequence([
      { freq: 523, delay: 0, duration: 0.15 },
      { freq: 523, delay: 0.15, duration: 0.1 },
      { freq: 523, delay: 0.3, duration: 0.1 },
      { freq: 784, delay: 0.5, duration: 0.4 },
      { freq: 659, delay: 0.9, duration: 0.2 },
      { freq: 784, delay: 1.1, duration: 0.5 },
    ], 0.25)
    // Finish with a chord
    setTimeout(() => this.playChord([523, 659, 784, 1047], 0.8, 'sine', 0.15), 1600)
  }

  // Sabotage used
  sabotage() {
    this.playSequence([
      { freq: 200, delay: 0, duration: 0.1, type: 'sawtooth' },
      { freq: 150, delay: 0.1, duration: 0.15, type: 'sawtooth' },
      { freq: 300, delay: 0.2, duration: 0.1, type: 'square' },
    ], 0.2)
  }

  // Player joined
  playerJoin() {
    this.playSequence([
      { freq: 440, delay: 0, duration: 0.1 },
      { freq: 660, delay: 0.1, duration: 0.15 },
    ], 0.15)
  }

  // Question appear
  questionAppear() {
    this.playSequence([
      { freq: 500, delay: 0, duration: 0.08 },
      { freq: 700, delay: 0.08, duration: 0.12 },
    ], 0.15)
  }

  // Select option
  select() {
    this.playTone(500, 0.08, 'sine', 0.12)
  }

  // Elimination
  elimination() {
    this.playSequence([
      { freq: 350, delay: 0, duration: 0.2, type: 'sawtooth' },
      { freq: 250, delay: 0.2, duration: 0.3, type: 'sawtooth' },
      { freq: 180, delay: 0.5, duration: 0.4, type: 'sawtooth' },
    ], 0.15)
  }

  // Button click
  click() {
    this.playTone(700, 0.05, 'sine', 0.1)
  }

  // Steal vote phase
  stealAlert() {
    this.playSequence([
      { freq: 250, delay: 0, duration: 0.15, type: 'square' },
      { freq: 350, delay: 0.15, duration: 0.15, type: 'square' },
      { freq: 250, delay: 0.3, duration: 0.15, type: 'square' },
      { freq: 450, delay: 0.45, duration: 0.25, type: 'square' },
    ], 0.18)
  }

  // Counter-attack card flip
  cardFlip() {
    this.playSequence([
      { freq: 800, delay: 0, duration: 0.06 },
      { freq: 1200, delay: 0.06, duration: 0.08 },
      { freq: 600, delay: 0.14, duration: 0.1 },
    ], 0.15)
  }

  // Counter-attack card reveal
  cardReveal() {
    this.playSequence([
      { freq: 400, delay: 0, duration: 0.1 },
      { freq: 600, delay: 0.1, duration: 0.1 },
      { freq: 800, delay: 0.2, duration: 0.1 },
      { freq: 1200, delay: 0.35, duration: 0.4 },
    ], 0.2)
  }

  // Time running out warning (plays once when timer hits 5)
  timeWarning() {
    this.playSequence([
      { freq: 600, delay: 0, duration: 0.1, type: 'triangle' },
      { freq: 800, delay: 0.15, duration: 0.1, type: 'triangle' },
    ], 0.12)
  }

  // Scores reveal swoosh
  scoresReveal() {
    this.playSequence([
      { freq: 300, delay: 0, duration: 0.15 },
      { freq: 400, delay: 0.1, duration: 0.15 },
      { freq: 500, delay: 0.2, duration: 0.15 },
      { freq: 700, delay: 0.35, duration: 0.3 },
    ], 0.15)
  }

  // Streak bonus sound
  streak() {
    this.playSequence([
      { freq: 600, delay: 0, duration: 0.08 },
      { freq: 800, delay: 0.08, duration: 0.08 },
      { freq: 1000, delay: 0.16, duration: 0.08 },
      { freq: 1200, delay: 0.24, duration: 0.15 },
    ], 0.18)
  }
}

export const soundEngine = new SoundEngine()
