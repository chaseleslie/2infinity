/* exported SoundFX */
/* global Utils */

class SoundFX {
  constructor(vol = 0.4) {
    if (typeof vol !== "number") {
      throw new TypeError(`Volume argument must be a number`);
    }

    this.ctx = new AudioContext();
    this._gainNode = new GainNode(this.ctx);
    this._gainNode.gain.value = Utils.clamp(vol, 0, 1) || 0.4;
    this._generateSounds();
    this._coolDown = 150;
  }

  set gain(newGain) {
    if (newGain > 1) {
      newGain = 1;
    } else if (newGain < 0) {
      newGain = 0;
    }

    const gainNode = this._gainNode;
    gainNode.gain.value = newGain;
    return newGain;
  }

  get gain() {
    return this._gainNode.gain.value;
  }

  _generateSounds() {
    this._generateBlaster();
    this._generateStrike();
  }

  _generateBlaster() {
    const ctx = this.ctx;
    const duration = 0.4;
    const sampleRate = ctx.sampleRate;
    const numSamples = duration * sampleRate;
    const numChannels = 1;
    const floatArray = new Float32Array(numSamples * numChannels);
    const arrayBuffer = ctx.createBuffer(numChannels, numSamples, sampleRate);
    this._blasterProps = Object.seal(Object.assign(Object.create(null), {
      "floatArray":   floatArray,
      "duration":     duration,
      "numSamples":   numSamples,
      "numChannels":  numChannels,
      "arrayBuffer":  arrayBuffer,
      "lastBuffSrc":  null,
      "lastStartTS":  0
    }));

    const freqs = [
      1484, 1482, 1480,
      742, 741, 740, 739, 738, 737, 736, 735, 734,
      370, 369, 368
    ];
    const w = Math.PI * 2 / sampleRate;
    const exp = Math.exp;
    const sin = Math.sin;

    for (let t = 0; t < numSamples; t++) {
      floatArray[t] = 0;
      const a = w * t;
      const frac = t / numSamples;

      for (let k = 0, n = freqs.length; k < n; k += 1) {
        const ampRange = Math.E - 1.0;
        const amp = 0.25 * (exp(1 - t / numSamples) - 1.0) / ampRange;
        const freq = exp(1 - 0.90 * frac) * freqs[k];
        floatArray[t] += amp * sin(a * freq);
      }
    }

    const channel = arrayBuffer.getChannelData(0);

    for (let k = 0; k < numSamples; k += 1) {
      channel[k] = floatArray[k];
    }
  }

  _generateStrike() {
    const ctx = this.ctx;
    const duration = 0.4;
    const sampleRate = ctx.sampleRate;
    const numSamples = duration * sampleRate;
    const numChannels = 1;
    const floatArray = new Float32Array(numSamples * numChannels);
    const arrayBuffer = ctx.createBuffer(numChannels, numSamples, sampleRate);
    this._strikeProps = Object.seal(Object.assign(Object.create(null), {
      "floatArray":   floatArray,
      "duration":     duration,
      "numSamples":   numSamples,
      "numChannels":  numChannels,
      "arrayBuffer":  arrayBuffer,
      "lastBuffSrc":  null,
      "lastStartTS":  0
    }));
    const freqs = [64, 94, 101, 129, 261, 287, 444];
    const max = Math.max;
    const pow = Math.pow;
    const sin = Math.sin;
    const w = Math.PI * 2 / sampleRate;

    for (let t = 0; t < floatArray.length; t++) {
      floatArray[t] = 0;
      const a = w * t;

      for (let k = 0, n = freqs.length; k < n; k += 1) {
        const freq = freqs[k];
        const samp = sin(a * freq);
        floatArray[t] += samp;
      }
    }

    /* Adjust amplitudes in arch shape */
    for (let t = 0; t < floatArray.length; t++) {
      let frac = t / numSamples;
      floatArray[t] *= max(0.25 - pow(frac - 0.5, 2), 0);
    }

    const channel = arrayBuffer.getChannelData(0);

    for (let k = 0; k < numSamples; k += 1) {
      channel[k] = floatArray[k];
    }
  }

  blaster() {
    const ctx = this.ctx;
    const blasterProps = this._blasterProps;
    const coolDown = this._coolDown;

    if (performance.now() <= blasterProps.lastStartTS + coolDown) {
      return;
    }

    const lastBuffSrc = blasterProps.lastBuffSrc;
    const source = ctx.createBufferSource();
    source.buffer = blasterProps.arrayBuffer;
    source.connect(this._gainNode).connect(ctx.destination);
    
    try {
      lastBuffSrc.stop();
    } catch (e) {}
    
    source.start();
    blasterProps.lastBuffSrc = source;
    blasterProps.lastStartTS = performance.now();
  }

  strike() {
    const ctx = this.ctx;
    const strikeProps = this._strikeProps;
    const coolDown = this._coolDown;

    if (performance.now() <= strikeProps.lastStartTS + coolDown) {
      return;
    }

    const lastBuffSrc = strikeProps.lastBuffSrc;
    const source = ctx.createBufferSource();
    source.buffer = strikeProps.arrayBuffer;
    source.connect(this._gainNode).connect(ctx.destination);
    
    try {
      lastBuffSrc.stop();
    } catch(e) {}
    
    source.start();
    strikeProps.lastBuffSrc = source;
    strikeProps.lastStartTS = performance.now();
  }
}
