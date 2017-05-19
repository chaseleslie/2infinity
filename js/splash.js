/* exported Splash */
/* global Utils */

var Splash = (function(glob) {
  var global = glob;
  var doc = global.document;
  const ROOT_TWO_OVER_TWO = Utils.ROOT_TWO_OVER_TWO;
  const SPLASH_CANCEL = -1;
  const SPLASH_SHIP_MATERIALIZE = 0;
  const SPLASH_SHIP_MOVE = 1;
  const SPLASH_SHIP_JUMP_HYPERSPACE = 2;

  var splashState = {
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
    "srcWidth": 0,
    "srcHeight": 0,
    "canvasWidth": 0,
    "canvasHeight": 0,
    "aspect": 0,
    "canvasImageData": null,
    "callback": null
  };

  function splashHandleKeyDown(e) {
    switch (e.key || e.keyCode || e.which) {
      case "F5":
      case 116:
      break;
      default:
        splashState.state = -1;
        e.preventDefault();
        return false;
    }
  }

  function splashEnd() {
    delete splashState.canvasImageData;
    splashState.canvasImageData = null;
    splashState.img = null;
    splashState.imgImageData = null;
    splashState.imgImageDataOpac = null;
    var ctx = splashState.canvasOverlayCtx;
    ctx.clearRect(0, 0, splashState.canvasWidth, splashState.canvasHeight);
    doc.body.removeEventListener("keydown", splashHandleKeyDown, false);

    splashState.callback();
  }

  function preSplash(args) {
    splashState.canvasOverlay = args.canvasOverlay;
    splashState.canvasOverlayCtx = args.canvasOverlayCtx;
    splashState.canvasImageData = args.canvasOverlayCtx.createImageData(
      splashState.canvasOverlay.width, splashState.canvasOverlay.height
    );
    splashState.canvasWidth = splashState.canvasOverlay.width;
    splashState.canvasHeight = splashState.canvasOverlay.height;
    splashState.img = args.img;
    splashState.text = args.text;
    splashState.callback = args.callback;
    splashState.state = SPLASH_SHIP_MATERIALIZE;
    splashState.frame = 0;

    doc.body.addEventListener("keydown", splashHandleKeyDown, false);
    splashState.width = args.imgWidth;
    splashState.height = args.imgHeight;
    splashState.srcWidth = splashState.width;
    splashState.srcHeight = splashState.height;
    splashState.left = 0;
    splashState.top = 0.5 * splashState.canvasHeight - 0.5 * splashState.height;
    splashState.aspect = splashState.canvasWidth / splashState.canvasHeight;
    splashState.moveEndPos = splashState.canvasWidth / 3;

    /* Prerender hyperspace bars */
    for (let k = 0; k < splashState.canvasOverlay.height; k += 1) {
      for (let iK = 0; iK < splashState.canvasOverlay.width; iK += 1) {
        let buff = splashState.canvasImageData.data;
        let pixel = k * splashState.canvasOverlay.width * 4 + iK * 4;
        buff[pixel] = 220;
        buff[pixel + 1] = 220;
        buff[pixel + 2] = 255;
        buff[pixel + 3] = 255;
      }
    }

    /* Get image data from prerendered image */
    var offscreenCanvas = doc.createElement("canvas");
    var width = splashState.width;
    var height = splashState.height;
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    var ctx = offscreenCanvas.getContext("2d");
    ctx.drawImage(
      splashState.img, args.imgX, args.imgY,
      args.imgWidth, args.imgHeight,
      0, 0, width, height
    );
    splashState.imgImageData = ctx.getImageData(0, 0, width, height);
    splashState.imgImageDataOpac = new Uint8Array(width * height);
    var imageData = splashState.imgImageData.data;
    var imgImageDataOpac = splashState.imgImageDataOpac;
    for (let k = 3, n = width*height*4, m = 0; k < n; k += 4, m += 1) {
      imgImageDataOpac[m] = imageData[k];
      imageData[k] = 0;
    }
    offscreenCanvas = null;
    ctx = null;

    splash();
  }

  function splash() {
    splashState.animFrame = global.requestAnimationFrame(splash);
    var ctx = splashState.canvasOverlayCtx;

    if (splashState.state <= SPLASH_SHIP_MOVE) {
      ctx.clearRect(
        splashState.left,
        splashState.top,
        splashState.width,
        splashState.height
      );
    } else {
      ctx.clearRect(
        splashState.left,
        splashState.top,
        splashState.width,
        splashState.height
      );
    }

    switch (splashState.state) {
      case SPLASH_CANCEL:
        // Cancel splash
        global.cancelAnimationFrame(splashState.animFrame);
        return splashEnd();
      case SPLASH_SHIP_MATERIALIZE: {
        // Part 1: Ship materializes
        let imageData = splashState.imgImageData.data;
        let width = splashState.width;
        let height = splashState.height;
        let frame = splashState.frame;
        let imgImageDataOpac = splashState.imgImageDataOpac;
        let materializeFrameCount = splashState.materializeFrameCount;
        for (let k = 0, n = width * height; k < n; k += 1) {
          if ((k - frame) % materializeFrameCount === 0) {
            imageData[k * 4 + 3] = imgImageDataOpac[k];
          }
        }
      }
      break;
      case SPLASH_SHIP_MOVE:
        // Part 2: Ship moves to the center
        splashState.left += 4;
      break;
      case SPLASH_SHIP_JUMP_HYPERSPACE: {
        // Part 3: Ship jumps to hyperspace
        splashState.srcWidth -= 4;
        splashState.width = splashState.srcWidth;
        if (splashState.srcWidth <= 0) {
          splashState.srcWidth = 1;
        }

        let halfHeight = splashState.height / 2;
        let aspect = splashState.aspect * ROOT_TWO_OVER_TWO;
        let left = splashState.left;

        for (let k = 0, n = splashState.height; k < n; k += 8) {
          let x = 0;
          if (k <= halfHeight) {
            x = parseInt(left + aspect * k, 10);
          } else {
            x = parseInt(left + aspect * (splashState.height - k), 10);
          }

          let y = splashState.top + k;
          ctx.putImageData(splashState.canvasImageData, x, y, 0, 0, splashState.canvasWidth, 1);
        }
      }
      break;
    }

    if (splashState.frame > splashState.materializeFrameCount) {
      splashState.state = SPLASH_SHIP_MOVE;
    }
    if (splashState.left >= splashState.moveEndPos) {
      splashState.state = SPLASH_SHIP_JUMP_HYPERSPACE;
    }
    if (splashState.srcWidth <= 1) {
      splashState.state = SPLASH_CANCEL;
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
    }

    ctx.putImageData(
      splashState.imgImageData,
      splashState.left,
      splashState.top,
      0, 0,
      splashState.srcWidth,
      splashState.srcHeight
    );
    splashState.frame += 1;
  }

  const BOSS_INTRO_CANCEL = -1;
  const BOSS_INTRO_MATERIALIZE = 0;
  const BOSS_INTRO_FOCUS = 1;
  var bossIntroState = {
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
    "focusLastTs": 0,
    "focusRingLast": 0,
    "focusNumRings": 32,
    "focusOuterRingRadiusMult": 2,
    "text": null,
    "isTextDrawn": false,
    "left": 0,
    "top": 0,
    "width": 0,
    "height": 0,
    "canvasWidth": 0,
    "canvasHeight": 0,
    "aspect": 0,
    "canvasImageData": null,
    "callback": null
  };

  function preBossIntro(args) {
    bossIntroState.canvasOverlay = args.canvasOverlay;
    bossIntroState.canvasOverlayCtx = args.canvasOverlayCtx;
    bossIntroState.state = BOSS_INTRO_MATERIALIZE;
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
    bossIntroState.focusLastTs = 0;
    bossIntroState.focusRingLast = 0;

    bossIntroState.canvasOverlayCtx.clearRect(
      0, 0,
      bossIntroState.canvasWidth,
      bossIntroState.canvasHeight
    );

// bossIntroState.canvasOverlayCtx.fillStyle = "#AAA";
// bossIntroState.canvasOverlayCtx.fillRect(0, 0, args.canvasOverlay.width, args.canvasOverlay.height);

    /* Get image data from prerendered image */
    var offscreenCanvas = doc.createElement("canvas");
    var width = bossIntroState.width;
    var height = bossIntroState.height;
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    var ctx = offscreenCanvas.getContext("2d");
    var rot = args.imgRotation;
    var cos = Math.cos;
    var sin = Math.sin;
    ctx.save();
    let midX = 0.5 * width;
    let midY = 0.5 * height;
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
    offscreenCanvas = null;
    ctx = null;

    bossIntro();
  }
  function bossIntro(ts) {
    bossIntroState.animFrame = global.requestAnimationFrame(bossIntro);
    var ctx = bossIntroState.canvasOverlayCtx;

    switch (bossIntroState.state) {
      case BOSS_INTRO_CANCEL:
        // Cancel animation
        global.cancelAnimationFrame(bossIntroState.animFrame);
        return bossIntroEnd();

      case BOSS_INTRO_MATERIALIZE: {
        // Part 1: Ship materializes
        let imageData = bossIntroState.imgImageData.data;
        let width = bossIntroState.width;
        let height = bossIntroState.height;
        let frame = bossIntroState.frame;
        let imgImageDataOpac = bossIntroState.imgImageDataOpac;
        let materializeFrameCount = bossIntroState.materializeFrameCount;
        let acos = Math.acos;
        let sqrt = Math.sqrt;
        let x = 0.5 * width;
        let y = 0.5 * height;
        let frac = frame / materializeFrameCount;
        let TWOPI = 2 * Math.PI;
        let angle = frac * TWOPI;
        let vecX = -1;
        let vecY = 0;

        for (let k = 0, m = 0; k < height; k += 1) {
          for (let iK = 0; iK < width; iK += 1, m += 1) {
            let px = iK - x;
            let py = k - y;
            let dot = vecX * px + vecY * py;
            let dAngle = acos(dot / sqrt(px * px + py * py)) || 0;

            if (py < 0) {
              dAngle = TWOPI - dAngle;
            }
            if (0 <= dAngle && dAngle <= angle) {
              imageData[m * 4 + 3] = imgImageDataOpac[m];
            }
          }
        }
      }
      break;
      case BOSS_INTRO_FOCUS: {
        // Part 2: Draw focus around ship
        ctx.save();
        ctx.strokeStyle = "#400";
        let width = bossIntroState.width;
        let height = bossIntroState.height;
        let x = bossIntroState.left + 0.5 * width;
        let y = bossIntroState.top + 0.5 * height;
        let r = parseInt(ROOT_TWO_OVER_TWO * Math.max(width, height), 10);
        let numRings = bossIntroState.focusNumRings;
        let r2 = r + numRings;
        ctx.clearRect(x - 4 * width, y - 4 * height, 8 * width, 8 * height);

        for (let k = r; k < r2; k += 1) {
          ctx.beginPath();
          ctx.arc(x, y, k, 0, 2 * Math.PI);
          ctx.stroke();
        }

        let rad = r + bossIntroState.focusRingLast;
        ctx.strokeStyle = "#AAF";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, 2 * Math.PI);
        ctx.stroke();
        bossIntroState.focusLastTs = ts;
        if (bossIntroState.focusRingLast < numRings) {
          bossIntroState.focusRingLast += 1;
        } else {
          bossIntroState.focusRingLast = 0;
        }

        let frac = bossIntroState.focusFrameCount / bossIntroState.focusFrameCountMax;
        r2 = r + numRings + parseInt(bossIntroState.focusOuterRingRadiusMult * (r + numRings) * frac, 10);
        ctx.beginPath();
        ctx.arc(x, y, r2, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.restore();
        bossIntroState.focusFrameCount -= 1;
      }
      break;
    }

    let frame = bossIntroState.frame;
    let matFrameCount = bossIntroState.materializeFrameCount;
    let focusFrameCount = bossIntroState.focusFrameCount;
    if (frame >= matFrameCount) {
      bossIntroState.state = BOSS_INTRO_FOCUS;
    }
    if (focusFrameCount <= 0) {
      bossIntroState.state = BOSS_INTRO_CANCEL;
    }

    if (!bossIntroState.isTextDrawn) {
      ctx.save();
      ctx.font = "36 monospace`";
      ctx.textBaseline = "bottom";
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFF";
      ctx.fillText(
        bossIntroState.text,
        0.5 * bossIntroState.canvasWidth,
        bossIntroState.canvasHeight
      );
      ctx.restore();
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
    bossIntroState.callback();
  }

  return {
    "start": preSplash,
    "bossIntro": preBossIntro
  };
})(window);
