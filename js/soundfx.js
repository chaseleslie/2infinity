/* exported SoundFX */

class SoundFX {
  constructor() {
    this.ctx = new AudioContext();
    this._generateSounds();
  }

  _generateSounds() {
    this._generateBlaster();
  }

  _generateBlaster() {
    const ctx = this.ctx;
    const duration = 0.4;
    const sampleRate = ctx.sampleRate;
    const numSamples = duration * sampleRate;
    const numChannels = 1;
    const floatArray = new Float32Array(numSamples * numChannels);
    const arrayBuffer = ctx.createBuffer(numChannels, numSamples, sampleRate);
    this.blasterProps = Object.freeze(Object.assign(Object.create(null), {
      "floatArray":   floatArray,
      "duration":     duration,
      "numSamples":   numSamples,
      "numChannels":  numChannels,
      "arrayBuffer":  arrayBuffer
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

  blaster() {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.blasterProps.arrayBuffer;
    source.connect(ctx.destination);
    source.start();
  }
}
