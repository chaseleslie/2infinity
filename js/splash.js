/* exported Splash */
/* global Utils */

var Splash = (function(glob) {
  const global = glob;
  const doc = global.document;

  /* Intro Display */

  const commonState = Object.seal({
    "KEY_MAP": null,
    "aspect": 0
  });

  const introState = Object.seal({
    "canvasOverlayCtx": null,
    "callback": null,
    "KEY_MAP": null
  });

  function init(args) {
    commonState.KEY_MAP = args.KEY_MAP;
    commonState.aspect = args.aspect;
  }

  function handleIntroKey(e) {
    var keyHandled = true;
    const key = commonState.KEY_MAP[e.key];

    switch (key || e.which || e.keyCode) {
      // F5 / Alt
      case 116:
      case 18:
        keyHandled = false;
      break;
      // Tab
      case 0x09:
        if (e.altKey) {
          keyHandled = false;
        }
      break;
      default:
        keyHandled = true;
      break;
    }

    if (keyHandled) {
      e.preventDefault();
      introEnd();
    }
  }

  function introEnd() {
    const ctx = introState.canvasOverlayCtx;
    doc.body.removeEventListener("keydown", handleIntroKey, false);
    doc.body.removeEventListener("click", handleIntroKey, false);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    introState.callback();
  }

  function preIntro(args) {
    introState.canvasOverlayCtx = args.canvasOverlayCtx;
    introState.callback = args.callback;
    doc.body.addEventListener("keydown", handleIntroKey, false);
    doc.body.addEventListener("click", handleIntroKey, false);
    setupIntro();
  }

  function setupIntro() {
    const ctx = introState.canvasOverlayCtx;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);

    /* Draw logo */
    var logoTextHeight = height / 10;
    logoTextHeight += (logoTextHeight % 8) ? 8 - logoTextHeight % 8 : 0;
    const logoFontNormal = `${logoTextHeight}px sans-serif`;
    const logoFontItalic = `italic ${logoTextHeight}px sans-serif`;
    ctx.save();
    ctx.fillStyle = "#FFF";
    ctx.textBaseline = "middle";

    const logoTextPrefix = "2";
    const logoTextSuffix = "Infinity";
    const logoTextYOffset = height / 10;
    ctx.font = logoFontNormal;
    const logoTextPrefixProps = ctx.measureText(logoTextPrefix);
    ctx.font = logoFontItalic;
    const logoTextSuffixProps = ctx.measureText(logoTextSuffix);
    const logoTextWidth = logoTextPrefixProps.width + logoTextSuffixProps.width;

    ctx.font = logoFontNormal;
    ctx.fillText(
      logoTextPrefix,
      0.5 * width - 0.5 * logoTextWidth,
      logoTextYOffset + 0.25 * logoTextHeight,
      0.4 * width
    );
    ctx.font = logoFontItalic;
    ctx.fillText(
      logoTextSuffix,
      0.5 * width - 0.5 * logoTextWidth + logoTextPrefixProps.width,
      logoTextYOffset - 0.25 * logoTextHeight,
      0.4 * width
    );

    /* Draw key map */
    var keyTextHeight = height / 20;
    keyTextHeight += (keyTextHeight % 8) ? 8 - keyTextHeight % 8 : 0;
    var keyHeight = keyTextHeight + 4;
    keyHeight += (keyHeight % 8) ? 8 - keyHeight % 8 : 0;
    const spacing = 16;
    const keyMapYOffset = 0.25 * height;
    ctx.font = `${keyTextHeight}px monospace`;
    ctx.strokeStyle = "#DDD";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#DDD";
    ctx.fillText(
      "Keyboard Controls",
      0.5 * width,
      0.5 * ((logoTextYOffset + logoTextHeight) + keyMapYOffset)
    );
    ctx.fillStyle = "#FFF";
    const keys = [
      {"keys": ["a", "\u2190"], "msg": "left",        "fixY": 0},
      {"keys": ["w", "\u2191"], "msg": "up",          "fixY": 0},
      {"keys": ["d", "\u2192"], "msg": "right",       "fixY": 0},
      {"keys": ["s", "\u2193"], "msg": "down",        "fixY": 0},
      {"keys": ["\u2423"],      "msg": "shoot",       "fixY": 0},
      {"keys": ["c"],           "msg": "dive",        "fixY": 0},
      {"keys": ["m"],           "msg": "mute/unmute", "fixY": 0},
      {"keys": ["`"],           "msg": "console",     "fixY": 0.25 * keyHeight}
    ];

    for (let k = 0, n = keys.length; k < n; k += 1) {
      const key = keys[k];
      const xOff = width / 6 - 0.5 * (2 * keyHeight + spacing + 4 * ctx.lineWidth);
      const yOff = keyMapYOffset + k * keyHeight + k * spacing;

      for (let iK = 0, iN = key.keys.length; iK < iN; iK += 1) {
        const x = xOff + iK * keyHeight + iK * spacing;
        const y = yOff;
        const w = keyHeight;
        const h = keyHeight;
        const d = 10;
        ctx.moveTo(x + d, y);
        ctx.lineTo(x + w - d, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + d);
        ctx.lineTo(x + w, y + h - d);
        ctx.quadraticCurveTo(x + w, y + h, x + w - d, y + h);
        ctx.lineTo(x + d, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - d);
        ctx.lineTo(x, y + d);
        ctx.quadraticCurveTo(x, y, x + d, y);
        ctx.stroke();

        const chr = key.keys[iK];
        ctx.fillStyle = "#FFF";
        ctx.fillText(chr, x + 0.5 * keyHeight, y + 0.5 * keyHeight + key.fixY);
      }

      ctx.save();
      ctx.textAlign = "right";
      ctx.fillText(
        key.msg,
        width - width / 6 + 0.5 * (keyTextHeight + 2 * ctx.lineWidth) + spacing,
        yOff + 0.5 * keyHeight
      );
      ctx.restore();
    }

    /* Put border around keymap */
    const margin = 20;
    const x = (
      width / 6 -
      0.5 * (2 * keyHeight + spacing + 4 * ctx.lineWidth) -
      margin
    );
    const y = (
      0.5 * ((logoTextYOffset + logoTextHeight) + keyMapYOffset) -
      0.5 * keyTextHeight - margin
    );
    const w = width - 2 * x;
    const h = (
      keys.length * (keyHeight + spacing + 2 * ctx.lineWidth) -
      spacing + keyTextHeight + 2 * margin
    );
    const d = 10;
    ctx.moveTo(x + d, y);
    ctx.lineTo(x + w - d, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + d);
    ctx.lineTo(x + w, y + h - d);
    ctx.quadraticCurveTo(x + w, y + h, x + w - d, y + h);
    ctx.lineTo(x + d, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - d);
    ctx.lineTo(x, y + d);
    ctx.quadraticCurveTo(x, y, x + d, y);
    ctx.stroke();

    ctx.fillStyle = "#DDD";
    const msg = "Press any key to continue";
    ctx.fillText(msg, 0.5 * width, height - 0.5 * keyTextHeight);
    ctx.restore();
  }

  /* Splash Animation */

  const SplashState = Object.freeze({
    "CANCEL":      -1,
    "MATERIALIZE": 0,
    "MOVE":        1,
    "HYPERSPACE":  2
  });

  const splashState = Object.seal({
    "canvasOverlay": null,
    "canvasOverlayCtx": null,
    "state": 0,
    "animFrame": null,
    "frame": 0,
    "img": null,
    "imgImageData": null,
    "imgImageDataOpac": null,
    "materializeFrameCount": 62,
    "moveEndPos": 0,
    "text": null,
    "isTextDrawn": false,
    "left": 0,
    "top": 0,
    "width": 0,
    "height": 0,
    "canvasWidth": 0,
    "canvasHeight": 0,
    "aspect": 0,
    "hyperspaceBarsImgData": null,
    "callback": null
  });

  function splashHandleKeyDown(e) {
    var keyHandled = true;
    const key = commonState.KEY_MAP[e.key];

    switch (key || e.keyCode || e.which) {
      // F5 / Alt
      case 116:
      case 18:
        keyHandled = false;
      break;
      // Tab
      case 0x09:
        if (e.altKey) {
          keyHandled = false;
        }
      break;
      default:
        keyHandled = true;
      break;
    }

    if (keyHandled) {
      splashState.state = SplashState.CANCEL;
      e.preventDefault();
      return false;
    }
  }

  function splashEnd() {
    delete splashState.hyperspaceBarsImgData;
    splashState.hyperspaceBarsImgData = null;
    splashState.img = null;
    splashState.imgImageData = null;
    splashState.imgImageDataOpac = null;
    const ctx = splashState.canvasOverlayCtx;
    ctx.clearRect(0, 0, splashState.canvasWidth, splashState.canvasHeight);
    doc.body.removeEventListener("click", splashHandleKeyDown, false);
    doc.body.removeEventListener("keydown", splashHandleKeyDown, false);

    splashState.callback();
  }

  function preSplash(args) {
    splashState.canvasOverlay = args.canvasOverlay;
    splashState.canvasOverlayCtx = args.canvasOverlayCtx;
    splashState.hyperspaceBarsImgData = args.canvasOverlayCtx.createImageData(
      splashState.canvasOverlay.width, splashState.canvasOverlay.height
    );
    splashState.canvasWidth = splashState.canvasOverlay.width;
    splashState.canvasHeight = splashState.canvasOverlay.height;
    splashState.img = args.img;
    splashState.text = args.text;
    splashState.callback = args.callback;
    splashState.state = SplashState.MATERIALIZE;
    splashState.frame = 0;

    doc.body.addEventListener("click", splashHandleKeyDown, false);
    doc.body.addEventListener("keydown", splashHandleKeyDown, false);

    splashState.aspect = splashState.canvasWidth / splashState.canvasHeight;
    splashState.width = args.imgWidth / splashState.aspect;
    splashState.height = args.imgHeight;
    splashState.left = 0;
    splashState.top = 0.5 * splashState.canvasHeight - 0.5 * splashState.height;
    splashState.moveEndPos = splashState.canvasWidth / 3;

    /* Prerender hyperspace bars */
    for (let k = 0, n = splashState.canvasOverlay.height; k < n; k += 1) {
      for (let iK = 0, iN = splashState.canvasOverlay.width; iK < iN; iK += 1) {
        const buff = splashState.hyperspaceBarsImgData.data;
        const pixel = k * splashState.canvasOverlay.width * 4 + iK * 4;
        buff[pixel] = 220;
        buff[pixel + 1] = 220;
        buff[pixel + 2] = 255;
        buff[pixel + 3] = 255;
      }
    }

    /* Get image data from prerendered image */
    const offscreenCanvas = doc.createElement("canvas");
    const width = splashState.width;
    const height = splashState.height;
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const ctx = offscreenCanvas.getContext("2d");
    ctx.drawImage(
      splashState.img, args.imgX, args.imgY,
      args.imgWidth, args.imgHeight,
      0, 0, width, height
    );
    splashState.imgImageData = ctx.getImageData(0, 0, width, height);
    splashState.imgImageDataOpac = new Uint8Array(width * height);
    const imageData = splashState.imgImageData.data;
    const imgImageDataOpac = splashState.imgImageDataOpac;
    for (let k = 3, n = width*height*4, m = 0; k < n; k += 4, m += 1) {
      imgImageDataOpac[m] = imageData[k];
      imageData[k] = 0;
    }

    splash();
  }

  function splash() {
    splashState.animFrame = global.requestAnimationFrame(splash);
    const ctx = splashState.canvasOverlayCtx;

    ctx.clearRect(
      splashState.left,
      splashState.top,
      splashState.width,
      splashState.height
    );

    switch (splashState.state) {
      case SplashState.CANCEL:
        // Cancel splash
        global.cancelAnimationFrame(splashState.animFrame);
        return splashEnd();
      case SplashState.MATERIALIZE: {
        // Part 1: Ship materializes
        const imageData = splashState.imgImageData.data;
        const width = splashState.width;
        const height = splashState.height;
        const frame = splashState.frame;
        const imgImageDataOpac = splashState.imgImageDataOpac;
        const materializeFrameCount = splashState.materializeFrameCount;
        for (let k = 0, n = width * height; k < n; k += 1) {
          if ((k - frame) % materializeFrameCount === 0) {
            imageData[k * 4 + 3] = imgImageDataOpac[k];
          }
        }
      }
      break;
      case SplashState.MOVE:
        // Part 2: Ship moves to the center
        splashState.left += 4;
      break;
      case SplashState.HYPERSPACE: {
        // Part 3: Ship jumps to hyperspace
        splashState.width -= 4;
        if (splashState.width <= 0) {
          splashState.width = 1;
        }

        const halfHeight = 0.5 * splashState.height;
        const left = splashState.left;

        for (let k = 0, n = splashState.height; k < n; k += 8) {
          let x = 0;
          if (k <= halfHeight) {
            x = Math.trunc(left + k);
          } else {
            x = Math.trunc(left + (splashState.height - k));
          }

          const y = splashState.top + k;
          ctx.putImageData(
            splashState.hyperspaceBarsImgData,
            x, y, 0, 0,
            splashState.canvasWidth, 1
          );
        }
      }
      break;
    }

    if (splashState.frame > splashState.materializeFrameCount) {
      splashState.state = SplashState.MOVE;
    }
    if (splashState.left >= splashState.moveEndPos) {
      splashState.state = SplashState.HYPERSPACE;
    }
    if (splashState.width <= 1) {
      splashState.state = SplashState.CANCEL;
    }

    if (!splashState.isTextDrawn) {
      ctx.save();
      ctx.font = "36 monospace`";
      ctx.textBaseline = "bottom";
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFF";
      ctx.fillText(
        splashState.text,
        0.5 * splashState.canvasWidth,
        splashState.canvasHeight
      );
      ctx.restore();
      splashState.isTextDrawn = true;
    }

    ctx.putImageData(
      splashState.imgImageData,
      splashState.left,
      splashState.top,
      0, 0,
      splashState.width,
      splashState.height
    );
    splashState.frame += 1;
  }

  /* Boss Intro Animation */

  const BossState = Object.freeze({
    "CANCEL":      -1,
    "MATERIALIZE": 0,
    "FOCUS":       1
  });
  const bossIntroState = Object.seal({
    "canvasOverlay": null,
    "canvasOverlayCtx": null,
    "state": 0,
    "animFrame": null,
    "frame": 0,
    "img": null,
    "imgImageData": null,
    "imgImageDataOpac": null,
    "imgRotation": 0,
    "materializeFrameCount": 124,
    "focusFrameCountMax": 400,
    "focusFrameCount": 400,
    "focusRingLast": 0,
    "focusNumRings": 32,
    "focusOuterRingRadiusMult": 1,
    "text": null,
    "isTextDrawn": false,
    "left": 0,
    "top": 0,
    "width": 0,
    "height": 0,
    "canvasWidth": 0,
    "canvasHeight": 0,
    "aspect": 0,
    "callback": null
  });

  function bossIntroHandleKeyDown(e) {
    var keyHandled = true;
    const key = commonState.KEY_MAP[e.key];

    switch (key || e.keyCode || e.which) {
      // F5 / Alt
      case "F5":
      case 116:
      case 18:
        keyHandled = false;
      break;
      // Tab
      case 0x09:
        if (e.altKey) {
          keyHandled = false;
        }
      break;
      default:
        keyHandled = true;
      break;
    }

    if (keyHandled) {
      bossIntroState.state = BossState.CANCEL;
      e.preventDefault();
      return false;
    }
  }

  function preBossIntro(args) {
    bossIntroState.canvasOverlay = args.canvasOverlay;
    bossIntroState.canvasOverlayCtx = args.canvasOverlayCtx;
    bossIntroState.state = BossState.MATERIALIZE;
    bossIntroState.frame = 0;
    bossIntroState.img = args.img;
    bossIntroState.imgRotation = args.imgRotation;
    bossIntroState.text = args.text;
    bossIntroState.isTextDrawn = false;
    bossIntroState.canvasWidth = args.canvasOverlay.width;
    bossIntroState.canvasHeight = args.canvasOverlay.height;
    bossIntroState.aspect = args.canvasOverlay.width / args.canvasOverlay.height;
    bossIntroState.width = args.destWidth;
    bossIntroState.height = args.destHeight;
    bossIntroState.left = args.canvasX;
    bossIntroState.top = args.canvasY;
    bossIntroState.callback = args.callback;
    bossIntroState.focusFrameCount = bossIntroState.focusFrameCountMax;
    bossIntroState.focusRingLast = 0;

    doc.body.addEventListener("click", bossIntroHandleKeyDown, false);
    doc.body.addEventListener("keydown", bossIntroHandleKeyDown, false);

    bossIntroState.canvasOverlayCtx.clearRect(
      0, 0,
      bossIntroState.canvasWidth,
      bossIntroState.canvasHeight
    );

    /* Get image data from prerendered image */
    const offscreenCanvas = doc.createElement("canvas");
    const width = bossIntroState.width;
    const height = bossIntroState.height;
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const ctx = offscreenCanvas.getContext("2d");
    const rot = args.imgRotation;
    const cos = Math.cos;
    const sin = Math.sin;
    ctx.save();
    const midX = 0.5 * width;
    const midY = 0.5 * height;
    ctx.setTransform(
      cos(rot), sin(rot), -sin(rot), cos(rot), midX, midY
    );
    ctx.drawImage(
      bossIntroState.img, args.srcX, args.srcY,
      args.srcWidth, args.srcHeight,
      -0.5 * width, -0.5 * height, width, height
    );
    ctx.restore();
    bossIntroState.imgImageData = ctx.getImageData(0, 0, width, height);
    bossIntroState.imgImageDataOpac = new Uint8Array(width * height);
    var imageData = bossIntroState.imgImageData.data;
    var imgImageDataOpac = bossIntroState.imgImageDataOpac;
    for (let k = 3, n = width*height*4, m = 0; k < n; k += 4, m += 1) {
      imgImageDataOpac[m] = imageData[k];
      imageData[k] = 0;
    }

    bossIntro();
  }
  function bossIntro() {
    bossIntroState.animFrame = global.requestAnimationFrame(bossIntro);
    const ctx = bossIntroState.canvasOverlayCtx;
    const TWO_PI = Utils.TWOPI;
    const trunc = Math.trunc;
    const acos = Math.acos;
    const sqrt = Math.sqrt;

    switch (bossIntroState.state) {
      case BossState.CANCEL:
        // Cancel animation
        global.cancelAnimationFrame(bossIntroState.animFrame);
        return bossIntroEnd();

      case BossState.MATERIALIZE: {
        // Part 1: Ship materializes
        const imageData = bossIntroState.imgImageData.data;
        const width = bossIntroState.width;
        const height = bossIntroState.height;
        const frame = bossIntroState.frame;
        const imgImageDataOpac = bossIntroState.imgImageDataOpac;
        const materializeFrameCount = bossIntroState.materializeFrameCount;
        const x = 0.5 * width;
        const y = 0.5 * height;
        const frac = frame / materializeFrameCount;
        const angle = frac * TWO_PI;
        const vecX = -1;
        const vecY = 0;

        for (let k = 0, m = 0; k < height; k += 1) {
          for (let iK = 0; iK < width; iK += 1, m += 1) {
            const px = iK - x;
            const py = k - y;
            const dot = vecX * px + vecY * py;
            let dAngle = acos(dot / sqrt(px * px + py * py)) || 0;

            if (py < 0) {
              dAngle = TWO_PI - dAngle;
            }
            if (0 <= dAngle && dAngle <= angle) {
              imageData[m * 4 + 3] = imgImageDataOpac[m];
            }
          }
        }
      }
      break;
      case BossState.FOCUS: {
        // Part 2: Draw focus around ship
        ctx.save();
        ctx.strokeStyle = "#400";
        const width = bossIntroState.width;
        const height = bossIntroState.height;
        const x = bossIntroState.left + 0.5 * width;
        const y = bossIntroState.top + 0.5 * height;
        const windowAspect = global.innerWidth / global.innerHeight;
        const aspect = bossIntroState.aspect;
        const rx = 2 * trunc(width / aspect);
        const ry = rx * windowAspect / aspect;
        const rxry = ry / rx;
        const numRings = bossIntroState.focusNumRings;
        const frac = bossIntroState.focusFrameCount / bossIntroState.focusFrameCountMax;
        const offset = trunc(
          bossIntroState.focusOuterRingRadiusMult * (rx + numRings) * frac
        );
        const rxOuter = rx + numRings + offset;
        const ryOuter = trunc(rxOuter * rxry);
        ctx.clearRect(
          x - rxOuter - 10,
          y - ryOuter - 10,
          2 * rxOuter + 20,
          2 * ryOuter + 20
        );

        ctx.lineWidth = numRings;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, TWO_PI, false);
        ctx.stroke();

        ctx.strokeStyle = "#AAF";
        ctx.lineWidth = 3;
        const rxFocus = rx + bossIntroState.focusRingLast;
        const ryFocus = trunc(rxFocus * rxry);
        ctx.beginPath();
        ctx.ellipse(x, y, rxFocus, ryFocus, 0, 0, TWO_PI, false);
        ctx.stroke();
        if (bossIntroState.focusRingLast < numRings) {
          bossIntroState.focusRingLast += 1;
        } else {
          bossIntroState.focusRingLast = 0;
        }

        ctx.beginPath();
        ctx.ellipse(x, y, rxOuter, ryOuter, 0, 0, TWO_PI, false);
        ctx.stroke();

        ctx.restore();
        bossIntroState.focusFrameCount -= 1;
      }
      break;
    }

    const frame = bossIntroState.frame;
    const matFrameCount = bossIntroState.materializeFrameCount;
    const focusFrameCount = bossIntroState.focusFrameCount;
    if (frame >= matFrameCount) {
      bossIntroState.state = BossState.FOCUS;
    }
    if (focusFrameCount <= 0) {
      bossIntroState.state = BossState.CANCEL;
    }

    if (!bossIntroState.isTextDrawn) {
      ctx.save();
      ctx.font = "36 monospace`";
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      ctx.fillStyle = "#FFF";
      ctx.fillText(
        bossIntroState.text,
        5,
        bossIntroState.canvasHeight - 5
      );
      ctx.restore();
      bossIntroState.isTextDrawn = true;
    }

    ctx.putImageData(
      bossIntroState.imgImageData,
      bossIntroState.left,
      bossIntroState.top,
      0, 0,
      bossIntroState.width,
      bossIntroState.height
    );
    bossIntroState.frame += 1;
  }
  function bossIntroEnd() {
    bossIntroState.imgImageData = null;
    bossIntroState.imgImageDataOpac = null;
    bossIntroState.canvasOverlayCtx.clearRect(
      0, 0,
      bossIntroState.canvasWidth, bossIntroState.canvasHeight
    );
    doc.body.removeEventListener("click", bossIntroHandleKeyDown, false);
    doc.body.removeEventListener("keydown", bossIntroHandleKeyDown, false);
    bossIntroState.callback();
  }

  return {
    "init": init,
    "intro": preIntro,
    "start": preSplash,
    "bossIntro": preBossIntro
  };
})(window);
