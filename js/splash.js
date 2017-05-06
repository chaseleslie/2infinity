/* exported Splash */
/* global Utils */

var Splash = (function(glob) {
  var global = glob;
  var doc = global.document;
  var ROOT_TWO_OVER_TWO = Utils.ROOT_TWO_OVER_TWO;

  var splashState = {
    "ts": 0,
    "state": 0,
    "animFrame": null,
    "frame": 0,
    "img": doc.getElementById("img_ship"),
    "left": 0,
    "top": 0,
    "width": ROOT_TWO_OVER_TWO * 64,
    "height": 64,
    "maxWidth": 512,
    "maxHeight": 512,
    "srcWidth": 512,
    "srcHeight": 512,
    "canvasWidth": 0,
    "canvasHeight": 0,
    "aspect": 0,
    "canvasImageData": null,
    "callback": null
  };

  function splashHandleKeyDown(e) {
    splashState.state = -1;
    e.preventDefault();
    return false;
  }

  function splashEnd(ts) {
    delete splashState.canvasImageData;
    splashState.canvasImageData = null;
    splashState.img = null;
    doc.body.removeEventListener("keydown", splashHandleKeyDown, false);

    splashState.callback(ts);
  }

  function preSplash(ts, args) {
    splashState.canvasOverlay = args.canvasOverlay;
    splashState.canvasOverlayCtx = args.canvasOverlayCtx;
    splashState.canvasImageData = splashState.canvasOverlayCtx.createImageData(
      splashState.canvasOverlay.width, splashState.canvasOverlay.height
    );
    splashState.canvasWidth = splashState.canvasOverlay.width;
    splashState.canvasHeight = splashState.canvasOverlay.height;
    splashState.callback = args.callback;

    doc.body.addEventListener("keydown", splashHandleKeyDown, false);
    splashState.maxWidth = parseInt(ROOT_TWO_OVER_TWO * splashState.img.width, 10);
    splashState.maxHeight = splashState.img.height;
    splashState.srcWidth = parseInt(ROOT_TWO_OVER_TWO * splashState.img.width, 10);
    splashState.srcHeight = splashState.img.height;
    splashState.left = -splashState.width;
    splashState.aspect = splashState.canvasWidth / splashState.canvasHeight;
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

    splash(ts);
  }

  function splash(ts) {
    splashState.animFrame = global.requestAnimationFrame(splash);
    var ctx = splashState.canvasOverlayCtx;
    ctx.clearRect(0, 0, splashState.canvasWidth, splashState.canvasHeight);

    switch (splashState.state) {
      case -1:
        // Cancel splash
        global.cancelAnimationFrame(splashState.animFrame);
        return splashEnd(ts);
      case 0:
        // Part 1: Ship gets larger
        splashState.height += 4;
        splashState.width = parseInt(ROOT_TWO_OVER_TWO * splashState.height, 10);
        splashState.top = splashState.canvasHeight / 2 - splashState.height / 2;
      break;
      case 1:
        // Part 2: Ship moves to the center
        splashState.left += 4;
      break;
      case 2: {
        // Part 3: Ship jumps to hyperspace
        splashState.srcWidth -= 4;
        splashState.width = splashState.srcWidth;
        if (splashState.srcWidth <= 0) {
          splashState.srcWidth = 1;
        }

        let halfHeight = splashState.height / 2;
        let aspect = splashState.aspect;

        for (let k = 0; k <= splashState.height; k += 8) {
          let x = 0;
          if (k <= halfHeight) {
            x = splashState.left + aspect * ROOT_TWO_OVER_TWO * k;
          } else {
            x = splashState.left + aspect * ROOT_TWO_OVER_TWO * (splashState.height - k);
          }

          let y = splashState.top + k;
          ctx.putImageData(splashState.canvasImageData, x, y, 0, 0, splashState.canvasWidth, 1);
        }
      }
      break;
    }

    let moveEnd = splashState.canvasWidth / 3;
    if (splashState.width >= splashState.maxWidth) {
      splashState.state = 1;
    }
    if (splashState.left >= moveEnd) {
      splashState.state = 2;
    }
    if (splashState.srcWidth <= 1) {
      splashState.state = -1;
    }

    ctx.drawImage(
      splashState.img,
      0, 0,
      splashState.srcWidth,
      splashState.srcHeight,
      splashState.left,
      splashState.top,
      splashState.width,
      splashState.height
    );
    splashState.frame += 1;
  }

  return {"start": preSplash};
})(window);
