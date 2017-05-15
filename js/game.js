/* global Utils Splash Weapon Player Enemy StarMap */

(function(win, doc) {
  var global = win;
  var canvas = doc.getElementById("glcanvas");
  var canvasOverlay = doc.getElementById("glcanvas_overlay");
  var canvasOverlayCtx = canvasOverlay.getContext("2d");
  var gameAudio = doc.getElementById("game_audio");
  var menu = doc.getElementById("menu");
  var menuResume = doc.getElementById("menu_resume");
  var menuRestart = doc.getElementById("menu_restart");
  var menuDisplayFPS = doc.getElementById("menu_display_fps");
  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  var point = {"x": 0, "y": 0, "z": 0};
  var zProjection = 1;
  var aspect = canvas.width / canvas.height;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  canvasOverlay.style.width = `${window.innerWidth}px`;
  canvasOverlay.style.height = `${window.innerHeight}px`;

  const KEY_MAP = {
    "ArrowLeft": 37,
    "Left": 37,
    "a": 37,
    "ArrowUp": 38,
    "Up": 38,
    "w": 38,
    "ArrowRight": 39,
    "Right": 39,
    "d": 39,
    "ArrowDown": 40,
    "Down": 40,
    "s": 40,

    "c": 99,
    "m": 109,
    "Escape": 27,
    "Tab": 9,
    "Alt": 18,
    "F5": 116,
    " ": 32
  };

  var defaultFontSize = 32;
  canvasOverlay.style.top = canvas.offsetTop;
  canvasOverlay.style.left = canvas.offsetLeft;
  canvasOverlayCtx.fillStyle = "#FFF";
  canvasOverlayCtx.font = `${defaultFontSize}px sans-serif`;
  var canvasOverlayProps = {
    "canvasOverlayFont": `${defaultFontSize}px monospace`,
    "scoreTemplateStr": "Score: 000000",
    "scoreTemplateStrProps": null,
    "scoreTemplateNumDigits": 6,
    "fpsTemplateStr": "fps: 0000",
    "fpsTemplateStrProps": null,
    "fpsTemplateNumDigits": 4,
    "hpWidthScale": 0.125, // 1 / 8
    "hpHeightScale": 0.022222222222 // 1 / 45
  };
  canvasOverlayCtx.save();
  canvasOverlayCtx.font = canvasOverlayProps.canvasOverlayFont;
  canvasOverlayProps.scoreTemplateStrProps = canvasOverlayCtx.measureText(canvasOverlayProps.scoreTemplateStr);
  canvasOverlayProps.fpsTemplateStrProps = canvasOverlayCtx.measureText(canvasOverlayProps.fpsTemplateStr);
  canvasOverlayCtx.restore();

  const OVERLAY_SCORE_DIRTY = 1;
  const OVERLAY_HP_DIRTY = 2;
  const OVERLAY_FPS_DIRTY = 4;

  const LEVEL_INTRO = 0;
  const LEVEL_PLAYING = 1;
  const LEVEL_END = 2;

  const DIFFICULTY_EASY = 1;
  const DIFFICULTY_MEDIUM = 2;
  const DIFFICULTY_HARD = 3;

  var difficultyMap = {
    "prediv": {},
    "spawnIntervalMult": {}
  };
  difficultyMap.prediv[DIFFICULTY_EASY] = 1.0;
  difficultyMap.prediv[DIFFICULTY_MEDIUM] = 1/2.0;
  difficultyMap.prediv[DIFFICULTY_HARD] = 1/3.0;
  difficultyMap.spawnIntervalMult[DIFFICULTY_EASY] = 1;
  difficultyMap.spawnIntervalMult[DIFFICULTY_MEDIUM] = 0.75;
  difficultyMap.spawnIntervalMult[DIFFICULTY_HARD] = 0.5;

  var Game = {
    "difficulty": DIFFICULTY_EASY,
    "difficultyMap": difficultyMap,
    "level": 0,
    "score": 0,
    "timestep": 10,
    "levelState": LEVEL_INTRO,
    "time": 0,
    "accumulator": 0,
    "frame": 0,
    "startTs": 0,
    "lastTs": 0,
    "pauseTs": 0,
    "averageFrameInterval": new Utils.ExponentialAverage(0.7, 0),
    "running": false,
    "isMenuShown": false,
    "animFrame": null,
    "overlayDirtyFlag": OVERLAY_SCORE_DIRTY | OVERLAY_HP_DIRTY,
    "overlayLastTs": 0,
    "displayFPS": false,
    "muted": false,
    "keydownMap": {
      "ArrowLeft": 0,
      "ArrowUp": 0,
      "ArrowRight": 0,
      "ArrowDown": 0,
      "Escape": 0,
      "Shoot": 0,
      "Dive": 0
    },
    "textures": {
      "ship": {
        "tex": null,
        "texId": 0,
        "texIdIndex": 0,
        "img": null,
        "coords": [
          new Float32Array([
            0.0, 0.0,
            0.375, 0.25,
            0.0, 0.5
          ]),
          new Float32Array([
            0.5, 0.0,
            0.875, 0.25,
            0.5, 0.5
          ])
        ],
        "coordBuffers": [],
        "SHIP_IDLE": 0,
        "SHIP_ACTIVE": 1
      },
      "enemyShip": {
        "tex": null,
        "texId": 0,
        "texIdIndex": 0,
        "img": null,
        "coords": [
          new Float32Array([
            0.0, 0.0,
            0.375, 0.25,
            0.0, 0.5
          ]),
          new Float32Array([
            0.5, 0.0,
            0.875, 0.25,
            0.5, 0.5
          ])
        ],
        "coordBuffers": [],
        "ENEMY_SHIP_BASIC": 0,
        "ENEMY_SHIP_FIGHTER": 1
      },
      "explosion": {
        "tex": null,
        "texId": 0,
        "texIdIndex": 0,
        "img": null,
        "coords": [
          new Float32Array([
            0.0, 1.0,
            1.0, 1.0,
            1.0, 0.0,

            0.0, 1.0,
            1.0, 0.0,
            0.0, 0.0
          ])
        ],
        "coordBuffers": []
      },
      "projectile": {
        "tex": null,
        "texId": 0,
        "texIdIndex": 0,
        "img": null,
        "coords": null,
        "coordBuffers": [],
        "PROJ_BASIC_BLUE": 0,
        "PROJ_BASIC_RED": 1,
        "PROJ_BASIC_GREEN": 2,
        "PROJ_BASIC_GRAY": 3
      },
      "star": {
        "tex": null,
        "texId": 0,
        "texIdIndex": 0,
        "img": null,
        "coords": [
          new Float32Array([
            0.0, 1.0,
            1.0, 1.0,
            1.0, 0.0,

            0.0, 1.0,
            1.0, 0.0,
            0.0, 0.0
          ])
        ],
        "coordBuffers": []
      },
      "circle": {
        "tex": null,
        "texId": 0,
        "texIdIndex": 0,
        "img": null,
        "coords": null,
        "coordBuffers": []
      },
      "texCoordAttrib": null,
      "numTextures": 0
    },
    "textureUniform": null,

    "modelScale": 0.125,
    "fragShader": null,
    "vertShader": null,
    "shaderProg": null,
    "vertexPositionAttrib": 0,

    //Verts top leftmost clockwise; triangle width approx. height * sqrt(2)/2
    "vertexTriangleBufferObject": gl.createBuffer(),
    "verticesTriangle": new Float32Array([
      -1.0, 1.0, 0.0,
      0.5, 0.0, 0.0,
      -1.0, -1.0, 0.0
    ]),
    "verticesTriangleSub": [
      new Float32Array([-1.0, 1.0, 0.0]),
      new Float32Array([0.5, 0.0, 0.0]),
      new Float32Array([-1.0, -1.0, 0.0])
    ],

    "vertexCircleBufferObject": gl.createBuffer(),
    "verticesCircle": null,

    //Verts top leftmost clockwise; top triangle then bottom
    "vertexRectangleBufferObject": gl.createBuffer(),
    "verticesRectangle": new Float32Array([
      -1.0, 1.0, 0.0,
      1.0, 1.0, 0.0,
      1.0, -1.0, 0.0,

      -1.0, 1.0, 0.0,
      1.0, -1.0, 0.0,
      -1.0, -1.0, 0.0
    ]),
    "verticesRectangleSub": [
      new Float32Array([-1.0, 1.0, 0.0]),
      new Float32Array([1.0, 1.0, 0.0]),
      new Float32Array([1.0, -1.0, 0.0]),

      new Float32Array([-1.0, 1.0, 0.0]),
      new Float32Array([1.0, -1.0, 0.0]),
      new Float32Array([-1.0, -1.0, 0.0])
    ],

    "pUniform": null,
    "mvUniform": null,

    "pUniformMatrix": new Float32Array([
      1.0, 0.0, 0.0, 0.0,
      0.0, 1.0, 0.0, 0.0,
      0.0, 0.0, 1.0, zProjection,
      0.0, 0.0, 0.0, 1.0
    ]),

    "player": null,
    "players": [],
    "levelEnemies": [],
    "enemies": [],
    "enemyWeapons": [],
    "findEnemyWeapon": findEnemyWeapon,
    "bosses": [],
    "stars": [],
    "starMap": null,
    "numStars": 256,
    "projectiles": [],
    "projectileLastTs": 0
  };

  var circleCoords = Utils.createCircleVertices({x: 0, y: 0, z: 0}, 360, 1);
  Game.verticesCircle = circleCoords.vertices;
  Game.textures.circle.coords = [circleCoords.tex];

  Game.gameData = null;
  var gameDataURL = "js/game_data.json";
  gameDataURL += (win.location.hash === "#dev") ? `?ts=${Date.now()}` : "" ;
  Utils.fetchURL({
    "method": "GET",
    "url": gameDataURL,
    "responseType": "json",
    "callback": function(xhr) {
      if (xhr.status === 200) {
        Game.gameData = xhr.response;
        setup(Game, gl);
      } else {
        console.error(xhr);
      }
    }
  });

  function handleKeyDown(e) {
    var ret;
    var now = win.performance.now();
    var keydownMap = Game.keydownMap;
    var key = KEY_MAP[e.key];

    switch (key || e.which || e.keyCode) {
      // ArrowLeft / a
      case 37:
      case 97:
        keydownMap["ArrowLeft"] = keydownMap["ArrowLeft"] || now;
        e.preventDefault();
      break;
      // ArrowUp / w
      case 38:
      case 119:
        keydownMap["ArrowUp"] = keydownMap["ArrowUp"] || now;
        e.preventDefault();
      break;
      // ArrowRight / d
      case 39:
      case 100:
        keydownMap["ArrowRight"] = keydownMap["ArrowRight"] || now;
        e.preventDefault();
      break;
      // ArrowDown / s
      case 40:
      case 115:
        keydownMap["ArrowDown"] = keydownMap["ArrowDown"] || now;
        e.preventDefault();
      break;
      // Space
      case 32:
        keydownMap["Shoot"] = keydownMap["Shoot"] || now;
        e.preventDefault();
      break;
      // c
      case 99:
        keydownMap["Dive"] = keydownMap["Dive"] || now;
        e.preventDefault();
      break;
      // Escape
      case 27:
        stop();
        showMenu();
        e.preventDefault();
        e.stopPropagation();
        ret = false;
      break;
      // m
      case 109:
        Game.muted = !Game.muted;
        e.preventDefault();
      break;
    }
    return ret;
  }
  function handleKeyUp(e) {
    var key = KEY_MAP[e.key];
    switch (key || e.which || e.keyCode) {
      // ArrowLeft / a
      case 37:
      case 97:
        Game.keydownMap["ArrowLeft"] = 0;
      break;
      // ArowUp / w
      case 38:
      case 119:
        Game.keydownMap["ArrowUp"] = 0;
      break;
      // ArrowRight / d
      case 39:
      case 100:
        Game.keydownMap["ArrowRight"] = 0;
      break;
      // ArrowDown / s
      case 40:
      case 115:
        Game.keydownMap["ArrowDown"] = 0;
      break;
      // Space
      case 32:
        Game.keydownMap["Shoot"] = 0;
      break;
      // c
      case 99:
        Game.keydownMap["Dive"] = 0;
        e.preventDefault();
      break;
    }
  }

  function loadSettings(Game) {
    var settings = null;
    try {
      settings = global.localStorage.getItem("settings");
      settings = JSON.parse(settings);
    } catch (e) {
      settings = null;
    }

    if (settings) {
      if ("muted" in settings) {
        Game.muted = settings.muted;
      }
      if ("displayFPS" in settings) {
        Game.displayFPS = settings.displayFPS;
        if (settings.displayFPS) {
          menuDisplayFPS.classList.add("checked");
          menuDisplayFPS.classList.remove("unchecked");
        }
      }
    }
  }
  function saveSettings(Game) {
    var settings = {
      "muted": Game.muted,
      "displayFPS": Game.displayFPS
    };
    try {
      global.localStorage.setItem(
        "settings",
        JSON.stringify(settings)
      );
    } catch (e) {}
  }
  loadSettings(Game);
  global.onbeforeunload = function() {
    saveSettings(Game);
  };

  function onMenuScroll(e) {
    var menuItems = Array.prototype.slice.call(menu.querySelectorAll("menuitem.selectable"));
    var selectedIndex = -1;
    var key = KEY_MAP[e.key];

    switch (key || e.which || e.keyCode) {
      // ArrowUp / ArrowDown / Enter
      case 38:
      case 40:
      case 13:
        e.preventDefault();
      break;
      // Escape
      case 27:
        e.preventDefault();
        e.stopPropagation();
        onMenuResume();
        return;

      default:
        return;
    }

    for (let k = 0; k < menuItems.length; k += 1) {
      if (menuItems[k].classList.contains("selected")) {
        selectedIndex = k;
        break;
      }
    }
    if (selectedIndex === -1 && menuItems.length) {
      selectedIndex = 0;
    }
    for (let k = 0; k < menuItems.length; k += 1) {
      menuItems[k].classList.remove("selected");
    }

    switch (key || e.which || e.keyCode) {
      // ArrowUp
      case 38:
        if (selectedIndex > 0) {
          selectedIndex -= 1;
        } else {
          selectedIndex = menuItems.length - 1;
        }
        menuItems[selectedIndex].classList.add("selected");
      break;
      // ArrowDown
      case 40:
        if (selectedIndex < (menuItems.length - 1)) {
          selectedIndex += 1;
        } else {
          selectedIndex = 0;
        }
        menuItems[selectedIndex].classList.add("selected");
      break;
      // Enter
      case 13:
        menuItems[selectedIndex].click();
      break;
    }
  }
  function onMenuScrollWheel(e) {
    var now = win.performance.now();
    var lastTs = parseFloat(onMenuScrollWheel.lastTs) || 0;

    if (now < lastTs + 200) {
      e.preventDefault();
      return;
    }
    onMenuScrollWheel.lastTs = now;

    if (e.deltaY > 0) {
      e.key = "ArrowDown";
      e.keyCode = 40;
      onMenuScroll(e);
    } else {
      e.key = "ArrowUp";
      e.keyCode = 38;
      onMenuScroll(e);
    }
  }

  function showMenu() {
    var menuItems = Array.prototype.slice.call(menu.querySelectorAll("menuitem.selectable"));
    menuItems.forEach((el) => {el.classList.remove("selected");});
    menuItems[0].classList.add("selected");
    window.addEventListener("keydown", onMenuScroll, false);
    window.addEventListener("wheel", onMenuScrollWheel, false);

    Game.isMenuShown = true;
    canvasOverlay.classList.add("inactive");
    canvas.classList.add("inactive");
    menu.classList.remove("hidden");
    var menuRect = menu.getBoundingClientRect();
    var canvasRect = canvas.getBoundingClientRect();
    menu.style.top = canvas.offsetTop + (canvasRect.height / 2) - (menuRect.height / 2) + "px";
    menu.style.left = canvas.offsetLeft + (canvasRect.width / 2) - (menuRect.width / 2) + "px";
  }
  function hideMenu() {
    Game.isMenuShown = false;
    menu.classList.add("hidden");
    canvasOverlay.classList.remove("inactive");
    canvas.classList.remove("inactive");

    window.removeEventListener("keydown", onMenuScroll, false);
    window.removeEventListener("wheel", onMenuScrollWheel, false);
  }
  function onMenuResume() {
    hideMenu();
    start();
  }
  function onMenuRestart() {
    hideMenu();
    stop();
    start();
    restart();
  }
  function onMenuDisplayFPS(e) {
    e.target.classList.toggle("checked");
    e.target.classList.toggle("unchecked");
    Game.displayFPS = !Game.displayFPS;
    Game.overlayDirtyFlag |= OVERLAY_FPS_DIRTY;
    hideMenu();
    start();
  }
  function onMenuMousedown(e) {
    e.target.classList.add("clicked");
  }
  function onMenuMouseup(e) {
    e.target.classList.remove("clicked");
  }
  function onMenuMouseleave(e) {
    e.target.classList.remove("clicked");
  }

  menuResume.addEventListener("click", onMenuResume, false);
  menuRestart.addEventListener("click", onMenuRestart, false);
  menuDisplayFPS.addEventListener("click", onMenuDisplayFPS, false);
  menuResume.addEventListener("mousedown", onMenuMousedown, false);
  menuResume.addEventListener("mouseup", onMenuMouseup, false);
  menuResume.addEventListener("mouseleave", onMenuMouseleave, false);
  menuRestart.addEventListener("mousedown", onMenuMousedown, false);
  menuRestart.addEventListener("mouseup", onMenuMouseup, false);
  menuRestart.addEventListener("mouseleave", onMenuMouseleave, false);
  menuDisplayFPS.addEventListener("mousedown", onMenuMousedown, false);
  menuDisplayFPS.addEventListener("mouseup", onMenuMouseup, false);
  menuDisplayFPS.addEventListener("mouseleave", onMenuMouseleave, false);

  function handleIntroKey(e) {
    var keyHandled = true;
    var key = KEY_MAP[e.key];
    switch (key || e.which || e.keyCode) {
      // F5 / Alt
      case 116:
      case "18":
        keyHandled = false;
      break;
      // Tab
      case "0x09":
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
  function setupIntro(callback) {
    var ctx = canvasOverlayCtx;
    doc.body.addEventListener(
      "keydown",
      typeof callback === "function" ? callback : handleIntroKey,
      false
    );
    doc.body.addEventListener(
      "click",
      typeof callback === "function" ? callback : handleIntroKey,
      false
    );

    var width = ctx.canvas.width;
    var height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);

    /* Draw logo */
    var logoTextHeight = height / 10;
    logoTextHeight += (logoTextHeight % 8) ? 8 - logoTextHeight % 8 : 0;
    var logoFontNormal = `${logoTextHeight}px sans-serif`;
    var logoFontItalic = `italic ${logoTextHeight}px sans-serif`;
    ctx.save();
    ctx.fillStyle = "#FFF";
    ctx.textBaseline = "middle";

    var logoTextPrefix = "2";
    var logoTextSuffix = "Infinity";
    var logoTextYOffset = height / 8;
    ctx.font = logoFontNormal;
    var logoTextPrefixProps = ctx.measureText(logoTextPrefix);
    ctx.font = logoFontItalic;
    var logoTextSuffixProps = ctx.measureText(logoTextSuffix);
    var logoTextWidth = logoTextPrefixProps.width + logoTextSuffixProps.width;

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
    var spacing = 16;
    var keyMapYOffset = 0.3 * height;
    ctx.font = `${keyTextHeight}px monospace`;
    ctx.strokeStyle = "#DDD";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#DDD";
    ctx.fillText("Keyboard Controls", 0.5 * width, 0.5 * ((logoTextYOffset + logoTextHeight) + keyMapYOffset));
    ctx.fillStyle = "#FFF";
    var keys = [
      {"keys": ["a", "\u2190"], "msg": "left"},
      {"keys": ["w", "\u2191"], "msg": "up"},
      {"keys": ["d", "\u2192"], "msg": "right"},
      {"keys": ["s", "\u2193"], "msg": "down"},
      {"keys": ["\u2423"], "msg": "shoot"},
      {"keys": ["c"], "msg": "dive"},
      {"keys": ["m"], "msg": "mute/unmute"}
    ];

    for (let k = 0, n = keys.length; k < n; k += 1) {
      let key = keys[k];
      let xOff = width / 6 - 0.5 * (2 * keyHeight + spacing + 4 * ctx.lineWidth);
      let yOff = keyMapYOffset + k * keyHeight + k * spacing;
      for (let iK = 0, iN = key.keys.length; iK < iN; iK += 1) {
        let x = xOff + iK * keyHeight + iK * spacing;
        let y = yOff;
        let w = keyHeight;
        let h = keyHeight;
        let d = 10;
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

        let chr = key.keys[iK];
        ctx.fillStyle = "#FFF";
        ctx.fillText(chr, x + 0.5 * keyHeight, y + 0.5 * keyHeight);

        ctx.save();
        ctx.textAlign = "right";
        ctx.fillText(key.msg, width - width / 6 + 0.5 * (keyTextHeight + 2 * ctx.lineWidth) + spacing, y + 0.5 * keyHeight);
        ctx.restore();
      }
    }

    /* Put border around keymap */
    let margin = 20;
    let x = width / 6 - 0.5 * (2 * keyHeight + spacing + 4 * ctx.lineWidth) - margin;
    let y = 0.5 * ((logoTextYOffset + logoTextHeight) + keyMapYOffset) - 0.5 * keyTextHeight - margin;
    let w = width - 2 * x;
    let h = keys.length * (keyHeight + spacing + 2 * ctx.lineWidth) - spacing + keyTextHeight + 2 * margin;
    let d = 10;
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
    ctx.fillText("Press any key to continue", 0.5 * width, height - 0.5 * keyTextHeight);
    ctx.restore();
  }
  function introEnd() {
    var ctx = canvasOverlayCtx;
    doc.body.removeEventListener("keydown", handleIntroKey, false);
    doc.body.removeEventListener("click", handleIntroKey, false);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    start();
  }

  function start() {
    if (!Game.running) {
      doc.body.addEventListener("keydown", handleKeyDown, false);
      doc.body.addEventListener("keyup", handleKeyUp, false);
      Game.startTs = global.performance.now();
      Game.running = true;
      preStart(Game, Game.startTs);
      main(Game.startTs);
    }
  }

  function preStart(Game, ts) {
    Game.lastTs = ts;
    var levelEnemies = Game.levelEnemies[Game.level];
    var pauseTs = Game.pauseTs;
    for (let k = 0; k < levelEnemies.lastTs.length; k += 1) {
      if (pauseTs) {
        levelEnemies.lastTs[k] = ts - (pauseTs - levelEnemies.lastTs[k]);
      } else {
        levelEnemies.lastTs[k] = ts;
      }
    }
  }

  function stop() {
    doc.body.removeEventListener("keydown", handleKeyDown, false);
    doc.body.removeEventListener("keyup", handleKeyUp, false);
    Game.pauseTs = global.performance.now();
    Game.running = false;
    global.cancelAnimationFrame(Game.animFrame);
  }

  function restart() {
    Game.player.resetGame(global.performance.now());
    Game.projectiles = [];
    Game.enemies = [];
    Game.score = 0;
    Game.pauseTs = 0;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  function main(ts) {
    if (Game.levelState === LEVEL_INTRO) {
      Game.levelState = LEVEL_PLAYING;
      stop();
      Splash.start(
        global.performance.now(), {
          "canvasOverlay": canvasOverlay,
          "canvasOverlayCtx": canvasOverlayCtx,
          "callback": start,
          "img": doc.getElementById("img_ship"),
          "text": Game.gameData.levels[Game.level].introText
        }
      );
      return;
    }

    Game.animFrame = global.requestAnimationFrame(main);

    var dt = ts - Game.lastTs;
    Game.time += dt;
    var timestep = Game.timestep;

    Game.averageFrameInterval.update((ts - Game.lastTs) || 0);

    var overlayNeedsUpdating = Boolean(Game.displayFPS);
    if (overlayNeedsUpdating && (ts > Game.overlayLastTs + 1000)) {
      Game.overlayDirtyFlag |= OVERLAY_FPS_DIRTY;
      Game.overlayLastTs = ts;
    }

    var frameTime = ts - Game.lastTs;
    if (frameTime > 250) {
      frameTime = 250;
    }
    // var accumulator = frameTime;
    Game.accumulator += frameTime;
    while (Game.accumulator >= timestep) {
      update(Game, ts, timestep);
      Game.time += timestep;
      Game.accumulator -= timestep;
    }

    Game.lastTs = ts;

    draw(Game);

    Game.frame += 1;
  }

  function update(Game, ts, dt) {
    var enemies = null;
    if (Game.levelState === LEVEL_PLAYING) {
      enemies = Game.enemies;
    } else if (Game.levelState === LEVEL_END) {
      enemies = Game.bosses;
    }

    Game.player.update(dt);
    var score = 0;
    var playerWeapons = Game.player.weapons;
    for (let k = 0, n = playerWeapons.length; k < n; k += 1) {
      score += playerWeapons[k].update(dt, enemies);
    }
    if (score) {
      updateScore(Game, score);
    }
    var playerHitbox = Game.player.hitbox;

    score = 0;
    for (let k = enemies.length - 1; k >= 0; k -= 1) {
      let enemy = enemies[k];
      if (!enemy.active) {
        continue;
      }
      score -= enemy.update(dt);
      if (score) {
        Game.overlayDirtyFlag |= OVERLAY_HP_DIRTY;
      }
      let hitbox = enemy.hitbox;
      let enemyPrune = enemy.prune;
      let enemyOffscreen = hitbox.right < -1.0;
      if (enemyOffscreen || enemyPrune) {
        if (enemyOffscreen) {
          // updateScore(Game, -enemy.points);
          score -= enemy.points;
        }

        let enemyType = 0;
        enemy.reset(enemyType, false, false);
      }
    }
    if (score) {
      updateScore(Game, score);
    }

    //Check for player collisions with enemies
    if (!playerHitbox.depth && Game.levelState === LEVEL_PLAYING) {
      for (let k = 0; k < enemies.length; k += 1) {
        let keepLooping = true;
        let enemy = enemies[k];
        if (enemy.active && enemy.hitPoints > 0 && enemy.intersectsWith(playerHitbox)) {
          let playerPos = Game.player.position;
          for (let iK = 0; iK < playerPos.length; iK += 1) {
            let vert = playerPos[iK];
            point.x = vert[0];
            point.y = vert[1];
            point.z = vert[2];
            let directHit = enemy.containsPoint(point);
            if (directHit ) {
              enemy.takeHit(enemy.hitPoints);
              let hp = Game.player.takeHit(enemy.points);
              if (hp <= 0) {
                restart();
                keepLooping = false;
                Game.overlayDirtyFlag = OVERLAY_SCORE_DIRTY | OVERLAY_HP_DIRTY | OVERLAY_FPS_DIRTY;
                break;
              } else {
                Game.overlayDirtyFlag |= OVERLAY_HP_DIRTY;
              }
              updateScore(Game, -enemy.points);
            }
          }
          if (!keepLooping) {
            break;
          }
        }
      }
    }

    if (Game.levelState === LEVEL_PLAYING) {
      spawnEnemies(Game, ts);
      if (Game.overlayDirtyFlag) {
        updateWeapon(Game);
      }
      // if (Game.score >= Game.gameData.levels[Game.level].scoreGoal) {
      //   Game.levelState = LEVEL_END;
      // }
    } else if (Game.levelState === LEVEL_END) {
      let bossActive = false;
      for (let k = 0; k < enemies.length; k += 1) {
        if (enemies[k].active) {
          bossActive = true;
        }
      }
      if (!bossActive) {
        if (Game.level < Game.gameData.levels.length - 1) {
          Game.level += 1;
        }
        Game.levelState = LEVEL_INTRO;
      }
    }

    if (Game.keydownMap["Shoot"]) {
      fireWeapon(Game, ts, dt);
    }

    Game.starMap.update(dt);
  }

  function updateScore(Game, score) {
    Game.score += score;
    Game.overlayDirtyFlag |= OVERLAY_SCORE_DIRTY;
  }

  function updateWeapon(Game) {
    var level = Game.gameData.levels[Game.level];
    var weapons = level.playerWeapons;
    for (let k = weapons.length; k; k -= 1) {
      if (Game.score >= level.playerWeaponsScoreThreshold[k]) {
        Game.player.selectWeapon(weapons[k]);
        break;
      }
    }
  }

  function fireWeapon(Game, ts, dt) {
    var fired = Game.player.fireWeapon(ts, dt);
    Game.projectileLastTs = ts;
    if (!Game.muted && fired) {
      gameAudio.currentTime = 0;
      gameAudio.play();
    }
  }

  function spawnEnemies(Game, ts, dt) {
    let gameData = Game.gameData;
    let level = gameData.levels[Game.level];
    let levelEnemies = Game.levelEnemies[Game.level];
    let enemyTypes = level.enemies;
    for (let k = 0, n = enemyTypes.length; k < n; k += 1) {
      let type = enemyTypes[k];
      let enemyType = gameData.enemies[type];
      let timeInterval = level.baseSpawnInterval * enemyType.spawnIntervalMult * difficultyMap.spawnIntervalMult[Game.difficulty];

      if (ts - levelEnemies.lastTs[k] > timeInterval) {
        let foundEnemy = false;
        for (let iK = 0; iK < Game.enemies.length; iK += 1) {
          let enemy = Game.enemies[iK];
          if (!enemy.active) {
            foundEnemy = true;
            enemy.reset(type, false, true);
            break;
          }
        }
        if (!foundEnemy) {
          Game.enemies.push(new Enemy(Game, aspect, type, false, true));
        }
        levelEnemies.lastTs[k] = ts;
      }
    }
  }

  function drawOverlay(Game) {
    var ctx = canvasOverlayCtx;
    var width = ctx.canvas.width;
    var height = ctx.canvas.height;
    var hpWidth = canvasOverlayProps.hpWidthScale * width;
    var hpHeight = canvasOverlayProps.hpHeightScale * height;
    var canvasOverlayFont = canvasOverlayProps.canvasOverlayFont;

    ctx.save();
    ctx.font = canvasOverlayFont;

    /* Update score display */
    if (Game.overlayDirtyFlag & OVERLAY_SCORE_DIRTY) {
      let scoreTemplateStrProps = canvasOverlayProps.scoreTemplateStrProps;
      let scoreTemplateNumDigits = canvasOverlayProps.scoreTemplateNumDigits;
      ctx.save();
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      let scoreNumStr = Game.score.toString();
      while (scoreNumStr.length < scoreTemplateNumDigits) {
        scoreNumStr = " " + scoreNumStr;
      }
      let scoreStr = `Score: ${scoreNumStr}`;
      let x = 1.25 * hpWidth + ctx.lineWidth;
      let y = 0;
      ctx.clearRect(x, y, scoreTemplateStrProps.width, defaultFontSize);
      ctx.fillText(scoreStr, x, y);
      ctx.restore();
    }

    /* Update fps display */
    if (Game.displayFPS && Game.overlayDirtyFlag & OVERLAY_FPS_DIRTY) {
      let fpsTemplateStrProps = canvasOverlayProps.fpsTemplateStrProps;
      let fpsTemplateNumDigits = canvasOverlayProps.fpsTemplateNumDigits;
      ctx.save();
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      let fps = Math.round(1000 / Game.averageFrameInterval.average);
      fps = isFinite(fps) ? fps : 0;
      fps = (fps <= 9999) ? fps : 9999;
      let fpsNumStr = fps.toString();
      while (fpsNumStr.length < fpsTemplateNumDigits) {
        fpsNumStr = " " + fpsNumStr;
      }
      let fpsStr = `fps: ${fpsNumStr}`;
      ctx.clearRect(
        width - fpsTemplateStrProps.width, height - defaultFontSize,
        width, height
      );
      ctx.fillText(fpsStr, width, height);
      ctx.restore();
    }

    /* Update hitpoints indicator */
    if (Game.overlayDirtyFlag & OVERLAY_HP_DIRTY) {
      let player = Game.player;
      let percentage = Math.max(0, player.hitPoints / player.maxHitPoints);
      let x = ctx.lineWidth;
      let y = ctx.lineWidth;
      let w = hpWidth;
      w = (w % 8) ? w + 8 - w % 8 : w;
      let h = hpHeight;
      h = (h % 8) ? h + 8 - h % 8 : h;
      let d = 10;
      let d2 = 0.5 * d;
      let red = parseInt((1 - percentage) * 0xFF, 10).toString(16);
      let green = parseInt(percentage * 0xFF, 10).toString(16);
      let color = `#${("0" + red).substr(-2)}${("0" + green).substr(-2)}88`;

      ctx.clearRect(x, y, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "#FFF";
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.fillRect(x + d2, y + d2, percentage * (w - d), h - d);
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
      ctx.restore();
    }

    ctx.restore();
    Game.overlayDirtyFlag = 0;
  }

  function draw(Game) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    Game.player.draw(gl);
    for (let k = 0; k < Game.enemies.length; k += 1) {
      Game.enemies[k].draw(gl);
    }

    Game.starMap.draw(gl);

    if (Game.overlayDirtyFlag) {
      drawOverlay(Game);
    }
  }

  function findEnemyWeapon(Game) {
    var enemyWeapons = Game.enemyWeapons;
    for (let k = 0, n = enemyWeapons.length; k < n; k += 1) {
      let weapon = enemyWeapons[k];
      if (!weapon.active) {
        return weapon;
      }
    }

    return new Weapon(Game, 0, 50, 0, 0, 0, false);
  }

  function setup(Game, gl) {
    gl.clearColor(0.0, 0.0, 0.3, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    Game.fragShader = Utils.getShader(gl, "gl_shader_frag");
    Game.vertShader = Utils.getShader(gl, "gl_shader_vert");
    Game.shaderProg = gl.createProgram();
    gl.attachShader(Game.shaderProg, Game.fragShader);
    gl.attachShader(Game.shaderProg, Game.vertShader);
    gl.linkProgram(Game.shaderProg);
    if (!gl.getProgramParameter(Game.shaderProg, gl.LINK_STATUS)) {
      console.log(gl.getProgramInfoLog(Game.shaderProg));
      return;
    }

    Game.player = new Player(Game, aspect);
    Game.players.push(Game.player);
    gl.useProgram(Game.shaderProg);

    gl.bindAttribLocation(Game.shaderProg, Game.vertexPositionAttrib, "aVertexPosition");
    gl.enableVertexAttribArray(Game.vertexPositionAttrib);

    gl.bindBuffer(gl.ARRAY_BUFFER, Game.vertexTriangleBufferObject);
    gl.bufferData(gl.ARRAY_BUFFER, Game.verticesTriangle, gl.STATIC_DRAW);
    gl.vertexAttribPointer(Game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);


    gl.bindBuffer(gl.ARRAY_BUFFER, Game.vertexCircleBufferObject);
    gl.bufferData(gl.ARRAY_BUFFER, Game.verticesCircle, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, Game.vertexRectangleBufferObject);
    gl.bufferData(gl.ARRAY_BUFFER, Game.verticesRectangle, gl.STATIC_DRAW);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    Game.pUniform = gl.getUniformLocation(Game.shaderProg, "uPMatrix");
    Game.mvUniform = gl.getUniformLocation(Game.shaderProg, "uMVMatrix");
    gl.uniformMatrix4fv(Game.pUniform, false, Game.pUniformMatrix);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    Game.textureUniform = gl.getUniformLocation(Game.shaderProg, "uSampler");
    Game.textures.texCoordAttrib = gl.getAttribLocation(Game.shaderProg, "aTextureCoord");
    gl.enableVertexAttribArray(Game.textures.texCoordAttrib);
    gl.vertexAttribPointer(Game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);

    Game.projectileTexCoords = Game.gameData.projectileTexCoords.map((el) => {
      return new Float32Array(el.coords);
    });

    function loadTexture(texObj, img, texCoords, texIdIndex) {
      texObj.tex = gl.createTexture();
      texObj.img = doc.getElementById(img);

      gl.bindTexture(gl.TEXTURE_2D, texObj.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texObj.img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
      gl.generateMipmap(gl.TEXTURE_2D);

      for (let k = 0, n = texCoords.length; k < n; k += 1) {
        let buff = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buff);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords[k], gl.STATIC_DRAW);
        texObj.coordBuffers.push(buff);
      }

      texObj.texId = gl.TEXTURE0 + texIdIndex;
      texObj.texIdIndex = texIdIndex;
    }

    loadTexture(Game.textures.ship, "img_ship", Game.textures.ship.coords, Game.textures.numTextures);
    Game.textures.numTextures += 1;

    loadTexture(Game.textures.enemyShip, "img_enemy_ship", Game.textures.enemyShip.coords, Game.textures.numTextures);
    Game.textures.numTextures += 1;

    loadTexture(Game.textures.explosion, "img_explosion", Game.textures.explosion.coords, Game.textures.numTextures);
    Game.textures.numTextures += 1;

    loadTexture(Game.textures.projectile, "img_projectiles_sprite", Game.projectileTexCoords, Game.textures.numTextures);
    Game.textures.numTextures += 1;

    loadTexture(Game.textures.star, "img_star", Game.textures.star.coords, Game.textures.numTextures);
    Game.textures.numTextures += 1;

    Game.starMap = new StarMap(Game, Game.numStars);

    /* Create arrays to hold enemy last spawn ts per level */
    let levels = Game.gameData.levels;
    let levelEnemies = Game.levelEnemies;
    for (let k = 0, n = levels.length; k < n; k += 1) {
      let lastTs = [];
      let level = levels[k];
      for (let iK = 0, iN = level.enemies.length; iK < iN; iK += 1) {
        lastTs.push(0);
      }
      levelEnemies.push({"lastTs": lastTs});
    }

    /* Create cache of weapons for enemies to reuse */
    for (let k = 0; k < 50; k += 1) {
      Game.enemyWeapons.push(new Weapon(Game, 0, 50, 0, 0, 0, false));
    }

    setupIntro();
  }
})(window, document);
