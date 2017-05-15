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
    "state": 0,
    "animFrame": null,
    "frame": 0,
    "img": null,
    "imgImageData": null,
    "imgImageDataOpac": null,
    "materializeFrameCount": 64,
    "moveEndPos": 0,
    "text": null,
    "isTextDrawn": false,
    "left": 0,
    "top": 0,
    "width": 512,
    "height": 512,
    "srcWidth": 512,
    "srcHeight": 512,
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

  function splashEnd(ts) {
    delete splashState.canvasImageData;
    splashState.canvasImageData = null;
    splashState.img = null;
    splashState.imgImageData = null;
    splashState.imgImageDataOpac = null;
    var ctx = splashState.canvasOverlayCtx;
    ctx.clearRect(0, 0, splashState.canvasWidth, splashState.canvasHeight);
    doc.body.removeEventListener("keydown", splashHandleKeyDown, false);

    splashState.callback(ts);
  }

  function preSplash(ts, args) {
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

    doc.body.addEventListener("keydown", splashHandleKeyDown, false);
    splashState.width = parseInt(ROOT_TWO_OVER_TWO * splashState.img.width, 10);
    splashState.height = splashState.img.height;
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
    ctx.drawImage(splashState.img, 0, 0);
    splashState.imgImageData = ctx.getImageData(0, 0, width, height);
    splashState.imgImageDataOpac = new Uint8Array(width * height);
    var imageData = splashState.imgImageData.data;
    var imgImageDataOpac = splashState.imgImageDataOpac;
    for (let k = 3, n = width*height*4, m = 0; k < n; k += 4, m += 1) {
      imgImageDataOpac[m] = imageData[k];
      imageData[k] = 0;
    }

    splash(ts);
  }

  function splash(ts) {
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
        return splashEnd(ts);
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

  return {"start": preSplash};
})(window);
