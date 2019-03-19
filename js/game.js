/* global Console Utils Splash SoundFX Player Enemy Boss StarMap HealthPowerup ShieldPowerup */

"use strict";

(function(win, doc) {

const global = win;
const docElem = document.documentElement;
const canvas = doc.getElementById("glcanvas");
const canvasOverlay = doc.getElementById("glcanvas_overlay");
const canvasOverlayCtx = canvasOverlay.getContext("2d");
const gameConsole = doc.getElementById("console");
const gameConsoleEntries = doc.getElementById("console_entries");
const gameConsoleEntriesFilterDebug = doc.getElementById("console_entries_filter_debug");
const gameConsoleEntriesFilterLog = doc.getElementById("console_entries_filter_log");
const gameConsoleEntriesFilterWarn = doc.getElementById("console_entries_filter_warn");
const gameConsoleEntriesFilterError = doc.getElementById("console_entries_filter_error");
const gameConsoleInput = doc.getElementById("console_input");
const gameConsoleInputEnter = doc.getElementById("console_input_enter");
const menu = doc.getElementById("menu");
const menuResume = doc.getElementById("menu_resume");
const menuRestart = doc.getElementById("menu_restart");
const menuConsole = doc.getElementById("menu_console");
const menuDisplayFPS = doc.getElementById("menu_display_fps");
const menuMute = doc.getElementById("menu_muted");
const menuVolume = doc.getElementById("menu_volume");
const menuIcon = doc.getElementById("img_menu_icon");
const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
const point = Object.seal({"x": 0, "y": 0, "z": 0});
const zProjection = 1;
const aspect = canvas.width / canvas.height;
const devMode = global.location.hash.indexOf("#dev") === 0;

const KEY_MAP = Object.freeze({
  "ArrowLeft":  37,
  "Left":       37,
  "a":          37,
  "ArrowUp":    38,
  "Up":         38,
  "w":          38,
  "ArrowRight": 39,
  "Right":      39,
  "d":          39,
  "ArrowDown":  40,
  "Down":       40,
  "s":          40,

  "c":          99,
  "m":          109,
  "Enter":      13,
  "Escape":     27,
  "Tab":        9,
  "Alt":        18,
  "F5":         116,
  " ":          32,
  "`":          192
});

const defaultFontSize = 32;
canvasOverlayCtx.fillStyle = "#FFF";
canvasOverlayCtx.font = `${defaultFontSize}px sans-serif`;
const canvasOverlayProps = Object.seal({
  "canvasOverlayFont":      `${defaultFontSize}px monospace`,
  "scoreTemplateStr":       "Score: 000000",
  "scoreTemplateStrProps":  null,
  "scoreTemplateNumDigits": 6,
  "fpsTemplateStr":         "fps: 0000",
  "fpsTemplateStrProps":    null,
  "fpsTemplateNumDigits":   4,
  "hpWidthScale":           0.125, // 1 / 8
  "hpHeightScale":          0.022222222222 // 1 / 45
});
canvasOverlayCtx.save();
canvasOverlayCtx.font = canvasOverlayProps.canvasOverlayFont;
canvasOverlayProps.scoreTemplateStrProps = canvasOverlayCtx.measureText(canvasOverlayProps.scoreTemplateStr);
canvasOverlayProps.fpsTemplateStrProps = canvasOverlayCtx.measureText(canvasOverlayProps.fpsTemplateStr);
canvasOverlayCtx.restore();

const OverlayFlags = Object.freeze({
  "INCREMENT":        0b00000001,
  "DECREMENT":        0b00000010,
  "SCORE_DIRTY":      0b00000100,
  "HP_DIRTY":         0b00001000,
  "FPS_DIRTY":        0b00010000,
  "BOSS_NAME_DIRTY":  0b00100000,
  "BOSS_HP_DIRTY":    0b01000000,
  "MUTED_DIRTY":      0b10000000
});

const LevelState = Object.freeze({
  "INTRO":      0,
  "PLAYING":    1,
  "END":        2,
  "BOSS_INTRO": 3,
  "BOSS":       4,
  "GAME_OVER":  5,
  "map": function(arg) {
    let val = null;
    if (typeof arg === "number") {
      for (const key of Object.keys(this)) {
        if (this[key] === arg) {
          val = key;
          break;
        }
      }
    } else if (typeof arg === "string") {
      for (const key of Object.keys(this)) {
        if (key === arg) {
          val = this[key];
          break;
        }
      }
    }
    return val;
  }
});

const Difficulty = Object.freeze({
  "EASY":   1,
  "MEDIUM": 2,
  "HARD":   3
});

const difficultyMap = Object.freeze({
  "prediv": Object.freeze({
    [Difficulty.EASY]:   1.0,
    [Difficulty.MEDIUM]: 1/2.0,
    [Difficulty.HARD]:   1/3.0
  }),
  "spawnIntervalMult": Object.freeze({
    [Difficulty.EASY]:   1,
    [Difficulty.MEDIUM]: 0.75,
    [Difficulty.HARD]:   0.5
  })
});

const Game = Object.seal({
  "name": "2Infinity",
  "version": "0.0.3",
  "devMode": devMode,
  "difficulty": Difficulty.EASY,
  "difficultyMap": difficultyMap,
  "aspect": aspect,
  "recipAspect": 1 / aspect,
  "windowAspect": docElem.clientWidth / docElem.clientHeight,
  "recipWindowAspect": docElem.clientHeight / docElem.clientWidth,
  "zProjection": zProjection,
  "level": 0,
  "score": 0,
  "timestep": 10,
  "levelState": LevelState.INTRO,
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
  "overlayState": Object.seal({
    "flag": OverlayFlags.SCORE_DIRTY | OverlayFlags.HP_DIRTY,
    "indicatorFrameCountMax": 64,
    "playerIndicatorFrameCount": 0,
    "bossIndicatorFrameCount": 0
  }),
  "OverlayFlags": OverlayFlags,
  "overlayLastTs": 0,
  "displayFPS": false,
  "muted": false,
  "soundFX": null,
  "keydownMap": Object.seal({
    "ArrowLeft": 0,
    "ArrowUp": 0,
    "ArrowRight": 0,
    "ArrowDown": 0,
    "Escape": 0,
    "Shoot": 0,
    "Dive": 0
  }),
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
        ]),
        new Float32Array([
          0.0, 0.5,
          0.375, 0.75,
          0.0, 1.0
        ])
      ],
      "coordBuffers": [],
      "ENEMY_SHIP_BASIC": 0,
      "ENEMY_SHIP_FIGHTER": 1
    },
    "boss": {
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
      "BOSS_SHIP_IDLE": 0,
      "BOSS_SHIP_ACTIVE": 1
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
    "powerup": {
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

  "projectileTexCoords": null,
  "powerupTexCoords": null,

  "pUniform": null,
  "mvUniform": null,

  "pUniformMatrix": new Float32Array([
    1.0 / aspect, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, zProjection,
    0.0, 0.0, 0.0, 1.0
  ]),

  "gameData": null,
  "player": null,
  "players": [],
  "levelEnemies": [],
  "enemies": [],
  "bosses": [],
  "stars": [],
  "starMap": null,
  "numStars": 256,
  "powerups": Object.seal({
    "Health": Object.seal({
      "lastTs": 0,
      "items": []
    }),
    "Shield": Object.seal({
      "lastTs": 0,
      "items": []
    })
  })
});

const touchState = Object.seal({
  "startX": 0,
  "startY": 0,
  "startTs": 0,
  "clear": false
});

Splash.init({
  "KEY_MAP": KEY_MAP,
  "aspect": aspect
});

Console.init({
  "LevelState": LevelState,
  "game": Game,
  "console": gameConsole,
  "consoleEntries": gameConsoleEntries,
  "consoleEntriesFilterDebug": gameConsoleEntriesFilterDebug,
  "consoleEntriesFilterLog": gameConsoleEntriesFilterLog,
  "consoleEntriesFilterWarn": gameConsoleEntriesFilterWarn,
  "consoleEntriesFilterError": gameConsoleEntriesFilterError,
  "consoleInput": gameConsoleInput,
  "consoleInputEnter": gameConsoleInputEnter
});

global.addEventListener("beforeunload", saveSettings, false, Game);
global.addEventListener("resize", handleWindowResize, false, Game);
menuResume.addEventListener("click", onMenuResume, false);
menuRestart.addEventListener("click", onMenuRestart, false);
menuConsole.addEventListener("click", onMenuConsole, false);
menuDisplayFPS.addEventListener("click", onMenuDisplayFPS, false);
menuMute.addEventListener("click", onMenuMute, false);
menuVolume.addEventListener("mousedown", onMenuVolumeMousedown, false);
menuVolume.addEventListener("mousemove", onMenuVolumeMousemove, false);
menuVolume.addEventListener("mouseup", onMenuVolumeMouseup, false);
menuVolume.addEventListener("mouseleave", onMenuVolumeMouseleave, false);

const circleCoords = Utils.createCircleVertices({x: 0, y: 0, z: 0}, 360, 1);
Game.verticesCircle = circleCoords.vertices;
Game.textures.circle.coords = [circleCoords.tex];

Console.debug("Fetching game data");
Game.gameData = null;
const gameDataURL = (win.location.hash.indexOf("#dev") === 0)
  ? `js/game_data.json?ts=${Date.now()}`
  : "js/game_data.json";

fetch(gameDataURL).then(function(response) {
  if (response.ok) {
    return response.json();
  }

  throw Error(`Error: fetching game data failed with status ${response.status}`);
}).then(function(json) {
  Game.gameData = json;
  setup(Game, gl);
}).catch(function(err) {
  console.error(err);
  Console.error(err);
  Console.show();
});

function handleWindowResize() {
  const game = Game;
  const winAspect = docElem.clientWidth / docElem.clientHeight;
  game.windowAspect = winAspect;
  game.recipWindowAspect = 1 / winAspect;
}

function handleTouchStart(e) {
  let x = 0;
  let y = 0;
  const touches = e.touches;

  for (let k = 0, n = touches.length; k < n; k += 1) {
    const touch = touches[k];
    x += touch.clientX;
    y += touch.clientY;
  }

  x /= touches.length;
  y /= touches.length;
  touchState.startX = x;
  touchState.startY = y;
  touchState.startTs = win.performance.now();
}

function handleTouchMove(e) {
  const keydownMap = Game.keydownMap;
  const touches = e.changedTouches;
  let x = 0;
  let y = 0;

  for (let k = 0, n = touches.length; k < n; k += 1) {
    const touch = touches[k];
    x += touch.clientX;
    y += touch.clientY;
  }

  x /= touches.length;
  y /= touches.length;
  const startX = touchState.startX;
  const startY = touchState.startY;
  const deltaX = x - startX;
  const deltaY = y - startY;
  const now = win.performance.now();

  if (deltaX > 0) {
    keydownMap["ArrowRight"] = keydownMap["ArrowRight"] || now;
  }
  if (deltaX < 0) {
    keydownMap["ArrowLeft"] = keydownMap["ArrowLeft"] || now;
  }
  if (deltaY > 0) {
    keydownMap["ArrowDown"] = keydownMap["ArrowDown"] || now;
  }
  if (deltaY < 0) {
    keydownMap["ArrowUp"] = keydownMap["ArrowUp"] || now;
  }

  touchState.clear = true;
}

function handleTouchEnd(e) {
  const keydownMap = Game.keydownMap;
  const sqrt = Math.sqrt;
  const abs = Math.abs;
  const touches = e.changedTouches;
  let x = 0;
  let y = 0;

  for (let k = 0, n = touches.length; k < n; k += 1) {
    const touch = touches[k];
    x += touch.clientX;
    y += touch.clientY;
  }

  x /= touches.length;
  y /= touches.length;
  const startX = touchState.startX;
  const startY = touchState.startY;
  const deltaX = x - startX;
  const deltaY = y - startY;
  const dist = sqrt(deltaX * deltaX + deltaY * deltaY);
  const now = win.performance.now();

  if (dist < 15 && abs(now - touchState.startTs) < 100) {
    keydownMap["Shoot"] = keydownMap["Shoot"] || now;
    touchState.clear = true;
  }
}

function handleMenuIconClick(e) {
  stop();
  showMenu();
  e.preventDefault();
  e.stopPropagation();
}

function handleKeyDown(e) {
  const now = win.performance.now();
  const keydownMap = Game.keydownMap;
  const key = KEY_MAP[e.key];
  var ret;

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
      onMenuMute();
      e.preventDefault();
    break;
    // Backtick
    case 192:
    stop();
    showConsole();
    e.preventDefault();
    e.stopPropagation();
    break;
  }
  return ret;
}

function handleKeyUp(e) {
  const key = KEY_MAP[e.key];

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

function loadSettings(game) {
  var settings = null;
  try {
    settings = global.localStorage.getItem("settings");
    settings = JSON.parse(settings);
  } catch (e) {
    settings = null;
  }

  if (settings) {
    Console.debug(`Loading settings: ${JSON.stringify(settings)}`);

    if ("muted" in settings) {
      game.muted = settings.muted;
      if (game.muted) {
        menuMute.classList.add("checked");
        menuMute.classList.remove("unchecked");
      } else {
        menuMute.classList.remove("checked");
        menuMute.classList.add("unchecked");
      }
    }

    if ("displayFPS" in settings) {
      game.displayFPS = settings.displayFPS;
      if (settings.displayFPS) {
        menuDisplayFPS.classList.add("checked");
        menuDisplayFPS.classList.remove("unchecked");
      }
    }

    if ("volume" in settings) {
      setVolume(settings.volume);
    }

    Console.log("Loaded saved game settings");
  } else {
    Console.log("Unable to load saved game settings");
  }
}

function saveSettings() {
  const settings = {
    "muted":      Game.muted,
    "displayFPS": Game.displayFPS,
    "volume":     Game.soundFX.gain
  };

  try {
    global.localStorage.setItem(
      "settings",
      JSON.stringify(settings)
    );
  } catch (e) {}
}

function clearAllLevels() {
  const levels = Game.gameData.levels;
  for (let k = 0, n = levels.length; k < n; k += 1) {
    clearLevel(k);
  }
}

function clearLevel(lvl) {
  const now = global.performance.now();
  const levelEnemies = Game.levelEnemies;
  const lastTs = levelEnemies[lvl].lastTs;
  for (let k = 0, n = lastTs.length; k < n; k += 1) {
    lastTs[k] = now;
  }
}

function clearEnemies() {
  const enemies = Game.enemies;
  for (let k = 0, n = enemies.length; k < n; k += 1) {
    const enemy = enemies[k];
    enemy.reset(0, false);
  }
}

function clearBosses() {
  const bosses = Game.bosses;
  for (let k = 0, n = bosses.length; k < n; k += 1) {
    const boss = bosses[k];
    boss.reset(k, false);
  }
}

function showConsole() {
  canvas.classList.add("inactive");
  canvasOverlay.classList.add("inactive");
  Console.show({"callback": hideConsole});
}

function hideConsole(args) {
  const game = Game;
  canvas.classList.remove("inactive");
  canvasOverlay.classList.remove("inactive");

  if (args.level !== null) {
    clearEnemies();
    clearBosses();
    game.level = args.level - 1;
    game.levelState = LevelState.INTRO;
    clearAllLevels();
  }

  if (args.hitpoints !== null) {
    game.player.hitpoints = args.hitpoints;
    game.overlayState.flag |= OverlayFlags.HP_DIRTY;
  }

  if (args.shield !== null) {
    game.player.shield = args.shield;
    game.overlayState.flag |= OverlayFlags.HP_DIRTY;
  }

  if (args.score !== null) {
    game.score = args.score;
    game.overlayState.flag |= OverlayFlags.SCORE_DIRTY;
  }

  if (args.state !== null) {
    const prevState = game.levelState;
    game.levelState = args.state;
    switch(prevState) {
      case LevelState.INTRO:
      case LevelState.PLAYING:
      case LevelState.END:
        clearAllLevels();
        clearEnemies();
      break;
      case LevelState.BOSS_INTRO:
      case LevelState.BOSS:
        clearBosses();
      break;
    }

    switch (game.levelState) {
      case LevelState.BOSS_INTRO:
      case LevelState.BOSS:
        game.bosses[game.level].reset(true);
      break;
    }
  }

  setTimeout(start, 0);
}

function onMenuScroll(e) {
  const menuItems = Array.prototype.slice.call(menu.querySelectorAll("menuitem.selectable"));
  const key = KEY_MAP[e.key];
  var selectedIndex = -1;

  switch (key || e.which || e.keyCode) {
    // ArrowLeft / ArrowUp / ArrowRight / ArrowDown / Enter
    case 37:
    case 38:
    case 39:
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
    break;
    // ArrowDown
    case 40:
      if (selectedIndex < (menuItems.length - 1)) {
        selectedIndex += 1;
      } else {
        selectedIndex = 0;
      }
    break;
    // Enter
    case 13:
      menuItems[selectedIndex].click();
    break;
  }

  /* Adjust volume */
  if (menuItems[selectedIndex] === menuVolume) {
    switch (key || e.which || e.keyCode) {
      // ArrowLeft
      case 37:
        setVolume(getVolume() - 0.05);
      break;
      // ArrowRight
      case 39:
        setVolume(getVolume() + 0.05);
      break;
    }
  }

  menuItems[selectedIndex].classList.add("selected");
}

function onMenuScrollWheel(e) {
  const now = win.performance.now();
  const lastTs = parseFloat(onMenuScrollWheel.lastTs) || 0;

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
  const menuItems = Array.prototype.slice.call(menu.querySelectorAll("menuitem.selectable"));
  menuItems.forEach((el) => {el.classList.remove("selected");});
  menuItems[0].classList.add("selected");
  window.addEventListener("keydown", onMenuScroll, false);
  window.addEventListener("wheel", onMenuScrollWheel, false);

  Game.isMenuShown = true;
  canvasOverlay.classList.add("inactive");
  canvas.classList.add("inactive");
  menu.classList.remove("hidden");
  const menuRect = menu.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
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

function onMenuConsole() {
  hideMenu();
  Console.show({"callback": start});
}

function onMenuDisplayFPS(e) {
  e.target.classList.toggle("checked");
  e.target.classList.toggle("unchecked");
  Game.displayFPS = !Game.displayFPS;
  Game.overlayState.flag |= OverlayFlags.FPS_DIRTY;
  hideMenu();
  start();
}

function onMenuMute() {
  const game = Game;
  game.muted = !game.muted;
  game.overlayState.flag |= OverlayFlags.MUTED_DIRTY;

  if (game.muted) {
    menuMute.classList.add("checked");
    menuMute.classList.remove("unchecked");
  } else {
    menuMute.classList.remove("checked");
    menuMute.classList.add("unchecked");
  }

  hideMenu();
  start();
}

function setVolume(vol) {
  vol = Utils.clamp(vol, 0, 1);
  const perc = Utils.roundTo5(vol * 100);
  Game.soundFX.gain = vol;
  menuVolume.style.background = `linear-gradient(to right, #77D ${perc}%, ${perc + 5}%, #AAF)`;
}

function getVolume() {
  return Game.soundFX.gain;
}

function onMenuVolumeMousedown(e) {
  const rect = menuVolume.getBoundingClientRect();
  menuVolume.dataset.mouseDown = "1";
  setVolume(Utils.clamp(e.offsetX / rect.width, 0, 1));
}

function onMenuVolumeMousemove(e) {
  if (menuVolume.dataset.mouseDown) {
    const rect = menuVolume.getBoundingClientRect();
    setVolume(Utils.clamp(e.offsetX / rect.width, 0, 1));
  }
}

function onMenuVolumeMouseup(e) {
  const rect = menuVolume.getBoundingClientRect();
  setVolume(Utils.clamp(e.offsetX / rect.width, 0, 1));
  menuVolume.dataset.mouseDown = "";
}

function onMenuVolumeMouseleave(e) {
  if (menuVolume.dataset.mouseDown) {
    const rect = menuVolume.getBoundingClientRect();
    setVolume(Utils.clamp(e.offsetX / rect.width, 0, 1));
    menuVolume.dataset.mouseDown = "";
  }
}

function start() {
  const game = Game;
  if (!game.running) {
    Console.log(`Starting game (state=${LevelState.map(game.levelState)})`);
    game.overlayState.flag |= (
      OverlayFlags.SCORE_DIRTY |
      OverlayFlags.HP_DIRTY |
      OverlayFlags.MUTED_DIRTY
    );
    doc.body.addEventListener("keydown", handleKeyDown, false);
    doc.body.addEventListener("keyup", handleKeyUp, false);
    doc.body.addEventListener("touchstart", handleTouchStart, false);
    doc.body.addEventListener("touchmove", handleTouchMove, false);
    doc.body.addEventListener("touchend", handleTouchEnd, false);
    menuIcon.addEventListener("click", handleMenuIconClick, false);
    game.startTs = global.performance.now();
    game.running = true;
    preStart(game, game.startTs);
    main(game.startTs);
  }
}

function preStart(game, ts) {
  game.lastTs = ts;
  const levelEnemies = game.levelEnemies[game.level];
  const pauseTs = game.pauseTs;
  for (let k = 0; k < levelEnemies.lastTs.length; k += 1) {
    if (pauseTs) {
      levelEnemies.lastTs[k] = ts - (pauseTs - levelEnemies.lastTs[k]);
    } else {
      levelEnemies.lastTs[k] = ts;
    }
  }

  const powerups = game.powerups;
  for (let key in powerups) {
    if (Object.prototype.hasOwnProperty.call(powerups, key)) {
      const powerup = powerups[key];
      if (pauseTs) {
        powerup.lastTs = ts - (pauseTs - powerup.lastTs);
      } else {
        powerup.lastTs = ts;
      }
    }
  }
}

function stop() {
  const game = Game;
  Console.log(`Stopping game (state=${LevelState.map(game.levelState)})`);
  doc.body.removeEventListener("keydown", handleKeyDown, false);
  doc.body.removeEventListener("keyup", handleKeyUp, false);
  doc.body.removeEventListener("touchstart", handleTouchStart, false);
  doc.body.removeEventListener("touchmove", handleTouchMove, false);
  doc.body.removeEventListener("touchend", handleTouchEnd, false);
  menuIcon.removeEventListener("click", handleMenuIconClick, false);
  game.pauseTs = global.performance.now();
  game.running = false;
  global.cancelAnimationFrame(game.animFrame);
  const keydownMap = game.keydownMap;
  for (const key of Object.keys(keydownMap)) {
    keydownMap[key] = 0;
  }
}

function restart() {
  const game = Game;
  Console.log("Restarting game");
  game.player.resetGame(global.performance.now());
  game.projectiles = [];
  game.enemies = [];
  game.score = 0;
  game.pauseTs = 0;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function main(ts) {
  const game = Game;

  if (game.levelState === LevelState.INTRO) {
    stop();
    game.player.resetLevel(game.level);
    game.levelState = LevelState.PLAYING;
    global.cancelAnimationFrame(game.animFrame);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const img = doc.getElementById("img_ship");
    Splash.start({
      "canvasOverlay": canvasOverlay,
      "canvasOverlayCtx": canvasOverlayCtx,
      "callback": start,
      "img": img,
      "imgX": 0,
      "imgY": 0,
      "imgWidth": parseInt(img.dataset.unitSize, 10),
      "imgHeight": parseInt(img.dataset.unitSize, 10),
      "text": game.gameData.levels[game.level].introText
    });
    return;
  } else if (game.levelState === LevelState.BOSS_INTRO) {
    stop();
    game.levelState = LevelState.BOSS;
    game.overlayState.flag |= OverlayFlags.BOSS_HP_DIRTY;
    global.cancelAnimationFrame(game.animFrame);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const trunc = Math.trunc;
    const img = doc.getElementById("img_boss");
    const imgUnitSize = parseInt(img.dataset.unitSize, 10);
    const bossData = game.gameData.bosses[game.level];
    const imgSpritePos = bossData.spritePos;
    const ROOT_TWO = Math.sqrt(2);
    const aspect = game.aspect;
    const canvasWidth = canvasOverlay.width;
    const canvasHeight = canvasOverlay.height;
    const destWidth = trunc(
      bossData.modelScales[0] * game.modelScale *
      (canvasWidth / aspect) / ROOT_TWO / aspect
    );
    const destHeight = trunc(
      bossData.modelScales[1] * game.modelScale * canvasHeight
    );
    Splash.bossIntro({
      "canvasOverlay": canvasOverlay,
      "canvasOverlayCtx": canvasOverlayCtx,
      "callback": start,
      "img": img,
      "srcX": imgSpritePos[0] * imgUnitSize,
      "srcY": imgSpritePos[1] * imgUnitSize,
      "srcWidth": imgUnitSize / ROOT_TWO,
      "srcHeight": imgUnitSize,
      "imgRotation": Math.PI,
      "destWidth": destWidth,
      "destHeight": destHeight,
      "canvasX": 0.5 * (bossData.spawnPos[0] + 1) * canvasWidth - destWidth * ROOT_TWO,
      "canvasY": 0.5 * (bossData.spawnPos[1] + 1) * canvasHeight - 0.5 * destHeight,
      "text": game.gameData.levels[game.level].bossText
    });
    return;
  } else if (game.levelState === LevelState.GAME_OVER) {
    stop();
    console.log("Game Over");
    Console.log("Game Over");
    Console.show();
    return;
  }

  game.animFrame = global.requestAnimationFrame(main);

  const dt = ts - game.lastTs;
  game.time += dt;
  const timestep = game.timestep;

  game.averageFrameInterval.update(dt || 0);

  const overlayNeedsUpdating = Boolean(game.displayFPS);
  if (overlayNeedsUpdating && (ts > game.overlayLastTs + 1000)) {
    game.overlayState.flag |= OverlayFlags.FPS_DIRTY;
    game.overlayLastTs = ts;
  }

  let frameTime = ts - game.lastTs;
  if (frameTime > 250) {
    frameTime = 250;
  }
  // var accumulator = frameTime;
  game.accumulator += frameTime;
  while (game.accumulator >= timestep) {
    update(game, ts, timestep);
    game.time += timestep;
    game.accumulator -= timestep;
  }

  game.lastTs = ts;

  draw(game);

  game.frame += 1;
}

function update(game, ts, dt) {
  const player = game.player;
  var enemies = null;
  if (game.levelState === LevelState.PLAYING || game.levelState === LevelState.END) {
    enemies = game.enemies;
  } else if (game.levelState === LevelState.BOSS) {
    enemies = game.bosses;
  } else {
    return;
  }

  /* Update player */
  player.update(dt);
  let score = 0;
  const playerWeapons = player.weapons;
  for (let k = 0, n = playerWeapons.length; k < n; k += 1) {
    score += playerWeapons[k].update(dt, enemies);
    if (score && game.levelState === LevelState.BOSS) {
      game.overlayState.flag |= OverlayFlags.BOSS_HP_DIRTY | OverlayFlags.DECREMENT;
    }
  }
  if (score) {
    game.soundFX.strike();
    updateScore(game, score);
  }
  const playerHitbox = player.hitbox;

  /* Update enemies */
  score = 0;
  for (let k = enemies.length - 1; k >= 0; k -= 1) {
    const enemy = enemies[k];
    if (!enemy.active) {
      continue;
    }
    const hitScore = -enemy.update(dt);
    if (hitScore) {
      game.soundFX.strike();
      game.overlayState.flag |= OverlayFlags.HP_DIRTY | OverlayFlags.DECREMENT;
      score += hitScore;
    }
    const hitbox = enemy.hitbox;
    const enemyOffscreen = hitbox.right < -1.0;
    if (enemyOffscreen) {
      score -= enemy.points;
      const enemyType = 0;
      enemy.reset(enemyType, false);
    }
  }
  if (score) {
    updateScore(game, score);
  }

  /* Check for player collisions with enemies */
  if (!playerHitbox.depth && game.levelState === LevelState.PLAYING) {
    for (let k = 0; k < enemies.length; k += 1) {
      let keepLooping = true;
      const enemy = enemies[k];
      if (enemy.active && enemy.hitpoints > 0 && enemy.intersectsWith(playerHitbox)) {
        const playerPos = player.position;
        for (let iK = 0; iK < playerPos.length; iK += 1) {
          const vert = playerPos[iK];
          point.x = vert[0];
          point.y = vert[1];
          point.z = vert[2];
          const directHit = enemy.containsPoint(point);
          if (directHit ) {
            enemy.takeHit(enemy.hitpoints);
            const hp = player.takeHit(enemy.points);
            if (hp <= 0) {
              restart();
              keepLooping = false;
              game.overlayState.flag = OverlayFlags.SCORE_DIRTY | OverlayFlags.HP_DIRTY | OverlayFlags.FPS_DIRTY;
              break;
            } else {
              game.overlayState.flag |= OverlayFlags.HP_DIRTY | OverlayFlags.DECREMENT;
            }
            updateScore(game, -enemy.points);
          }
        }
        if (!keepLooping) {
          break;
        }
      }
    }
  }

  updatePowerups(game, dt);

  updateLevel(game, ts, enemies);

  const keydownMap = game.keydownMap;
  if (keydownMap["Shoot"]) {
    fireWeapon(game, ts, dt);
  }

  if (touchState.clear) {
    keydownMap["Shoot"] = 0;
    keydownMap["ArrowRight"] = 0;
    keydownMap["ArrowLeft"] = 0;
    keydownMap["ArrowDown"] = 0;
    keydownMap["ArrowUp"] = 0;
    touchState.clear = false;
  }

  game.starMap.update(dt);
}

function updateLevel(game, ts, enemies) {
  if (game.levelState === LevelState.PLAYING) {
    spawnEnemies(game, ts);
    if (game.overlayState.flag) {
      updateWeapon(game);
    }

    spawnPowerups(game, ts);

    if (game.score >= game.gameData.levels[game.level].scoreGoal) {
      game.levelState = LevelState.END;
    }
  } else if (game.levelState === LevelState.END) {
    let enemiesActive = false;
    for (let k = 0, n = enemies.length; k < n; k += 1) {
      if (enemies[k].active) {
        enemiesActive = true;
        break;
      }
    }

    if (!enemiesActive) {
      game.levelState = LevelState.BOSS_INTRO;
      game.overlayState.flag |= OverlayFlags.BOSS_HP_DIRTY | OverlayFlags.INCREMENT;
      game.bosses[game.level].reset(true);
    }
  } else if (game.levelState === LevelState.BOSS) {
    let bossActive = false;
    for (let k = 0, n = enemies.length; k < n; k += 1) {
      if (enemies[k].active) {
        bossActive = true;
      }
    }
    if (!bossActive) {
      if (game.level < game.gameData.levels.length - 1) {
        game.level += 1;
        game.levelState = LevelState.INTRO;
        game.overlayState.flag = OverlayFlags.SCORE_DIRTY | OverlayFlags.HP_DIRTY;
      } else {
        game.levelState = LevelState.GAME_OVER;
      }
    }
  }
}

function updateScore(game, score) {
  game.score += score;
  game.overlayState.flag |= OverlayFlags.SCORE_DIRTY;
}

function updateWeapon(game) {
  const level = game.gameData.levels[game.level];
  const weapons = level.playerWeapons;
  for (let k = weapons.length; k; k -= 1) {
    if (game.score >= level.playerWeaponsScoreThreshold[k]) {
      game.player.selectWeapon(k);
      break;
    }
  }
}

function updatePowerups(game, dt) {
  const player = game.player;
  const powerups = game.powerups;
  for (let key in powerups) {
    if (Object.prototype.hasOwnProperty.call(powerups, key)) {
      const powerup = powerups[key];
      for (let k = 0, n = powerup.items.length; k < n; k += 1) {
        const item = powerup.items[k];
        if (item.active) {
          item.update(dt);
          const hitbox = item.getHitbox();
          if (player.intersectsWith(hitbox)) {
            const flags = player.acceptPowerup(item) || 0;
            game.overlayState.flag |= flags;
          }
        }
      }
    }
  }
}

// TODO use dt/timestep here
function spawnPowerups(game, ts) {
  const powerups = game.powerups;
  for (let key in powerups) {
    if (Object.prototype.hasOwnProperty.call(powerups, key)) {
      const powerup = powerups[key];
      const interval = game.gameData.powerups[key].spawnInterval;
      if (ts - powerup.lastTs > interval) {
        let found = false;
        const items = powerup.items;
        for (let k = 0, n = items.length; k < n; k += 1) {
          const item = items[k];
          if (!item.active) {
            found = true;
            item.reset();
            break;
          }
        }
        if (!found) {
          const Ctor = items[0].constructor;
          const item = new Ctor(game);
          item.reset();
        }
        powerup.lastTs = ts;
      }
    }
  }
}

function fireWeapon(game, ts, dt) {
  const fired = game.player.fireWeapon(ts, dt);

  if (fired && game.soundFX && !game.muted) {
    game.soundFX.blaster();
  }
}

// TODO use dt/timestep here
function spawnEnemies(game, ts) {
  const gameData = game.gameData;
  const level = gameData.levels[game.level];
  const levelEnemies = game.levelEnemies[game.level];
  const enemyTypes = level.enemies;
  for (let k = 0, n = enemyTypes.length; k < n; k += 1) {
    const type = enemyTypes[k];
    const enemyType = gameData.enemies[type];
    const timeInterval = (
      level.baseSpawnInterval *
      enemyType.spawnIntervalMult *
      difficultyMap.spawnIntervalMult[game.difficulty]
    );

    if (ts - levelEnemies.lastTs[k] > timeInterval) {
      let foundEnemy = false;
      for (let iK = 0; iK < game.enemies.length; iK += 1) {
        const enemy = game.enemies[iK];
        if (!enemy.active && enemyType === enemy.type) {
          foundEnemy = true;
          enemy.reset(true);
          break;
        }
      }
      if (!foundEnemy) {
        game.enemies.push(new Enemy(game, type, true));
      }
      levelEnemies.lastTs[k] = ts;
    }
  }
}

function drawOverlay(game) {
  const floor = Math.floor;
  const max = Math.max;
  const min = Math.min;
  const round = Math.round;
  const sin = Math.sin;
  const trunc = Math.trunc;
  const TWO_PI = Utils.TWOPI;
  const ctx = canvasOverlayCtx;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const hpWidth = canvasOverlayProps.hpWidthScale * width;
  const hpHeight = canvasOverlayProps.hpHeightScale * height;
  const canvasOverlayFont = canvasOverlayProps.canvasOverlayFont;
  var keepDirtyFlags = 0;

  ctx.save();
  ctx.font = canvasOverlayFont;

  /* Display muted icon */
  const mutedDirty = game.overlayState.flag & OverlayFlags.MUTED_DIRTY;
  if (mutedDirty) {
    const mutedStr = "\ud83d\udd07";
    const x = 0;
    const y = height;
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.clearRect(x, y - defaultFontSize, defaultFontSize, defaultFontSize);

    if (game.muted) {
      ctx.fillText(mutedStr, x, y);
    }

    ctx.restore();
  }

  /* Update score display */
  if (game.overlayState.flag & OverlayFlags.SCORE_DIRTY) {
    const scoreTemplateStrProps = canvasOverlayProps.scoreTemplateStrProps;
    const scoreNumDigits = canvasOverlayProps.scoreTemplateNumDigits;
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const scoreNumStr = `        ${game.score}`.substr(-scoreNumDigits);
    const scoreStr = `Score: ${scoreNumStr}`;
    const x = 1.25 * hpWidth + ctx.lineWidth;
    const y = 0;
    ctx.clearRect(x, y, scoreTemplateStrProps.width, defaultFontSize);
    ctx.fillText(scoreStr, x, y);
    ctx.restore();
  }

  /* Update fps display */
  const fpsDirty = game.overlayState.flag & OverlayFlags.FPS_DIRTY;
  if (game.displayFPS && fpsDirty) {
    const fpsTemplateStrProps = canvasOverlayProps.fpsTemplateStrProps;
    const fpsNumDigits = canvasOverlayProps.fpsTemplateNumDigits;
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    let fps = round(1000 / game.averageFrameInterval.average);
    fps = isFinite(fps) ? fps : 0;
    fps = (fps <= 9999) ? fps : 9999;
    const fpsNumStr = `        ${fps}`.substr(-fpsNumDigits);
    const fpsStr = `fps: ${fpsNumStr}`;
    ctx.clearRect(
      width - fpsTemplateStrProps.width, height - defaultFontSize,
      width, height
    );
    ctx.fillText(fpsStr, width, height);
    ctx.restore();
  } else if (!game.displayFPS && fpsDirty) {
    const fpsTemplateStrProps = canvasOverlayProps.fpsTemplateStrProps;
    ctx.clearRect(
      width - fpsTemplateStrProps.width, height - defaultFontSize,
      width, height
    );
  }

  /* Update hitpoints indicator */
  if (game.overlayState.flag & OverlayFlags.HP_DIRTY || game.overlayState.flag & OverlayFlags.BOSS_HP_DIRTY) {
    ctx.save();
    let player = null;
    let x = 0;
    let flag = game.overlayState.flag & (OverlayFlags.HP_DIRTY | OverlayFlags.BOSS_HP_DIRTY);

    while (flag) {
      let frameCount = 0;
      if (flag & OverlayFlags.HP_DIRTY) {
        x = ctx.lineWidth;
        player = game.player;
        flag &= ~OverlayFlags.HP_DIRTY;

        if (game.overlayState.flag & OverlayFlags.INCREMENT) {
          game.overlayState.playerIndicatorFrameCount = game.overlayState.indicatorFrameCountMax;
        } else if (game.overlayState.flag & OverlayFlags.DECREMENT) {
          game.overlayState.playerIndicatorFrameCount = -game.overlayState.indicatorFrameCountMax;
        } else if (game.overlayState.playerIndicatorFrameCount > 0) {
          game.overlayState.playerIndicatorFrameCount -= 1;
        } else if (game.overlayState.playerIndicatorFrameCount < 0) {
          game.overlayState.playerIndicatorFrameCount += 1;
        }

        frameCount = game.overlayState.playerIndicatorFrameCount;
        if (frameCount) {
          keepDirtyFlags |= OverlayFlags.HP_DIRTY;
        }
      } else if (flag & OverlayFlags.BOSS_HP_DIRTY) {
        x = ctx.canvas.width - 8 - hpWidth;
        player = game.bosses[game.level];
        flag &= ~OverlayFlags.BOSS_HP_DIRTY;

        if (game.overlayState.flag & OverlayFlags.INCREMENT) {
          game.overlayState.bossIndicatorFrameCount = game.overlayState.indicatorFrameCountMax;
        } else if (game.overlayState.flag & OverlayFlags.DECREMENT) {
          game.overlayState.bossIndicatorFrameCount = -game.overlayState.indicatorFrameCountMax;
        } else if (game.overlayState.bossIndicatorFrameCount > 0) {
          game.overlayState.bossIndicatorFrameCount -= 1;
        } else if (game.overlayState.bossIndicatorFrameCount < 0) {
          game.overlayState.bossIndicatorFrameCount += 1;
        }

        frameCount = game.overlayState.bossIndicatorFrameCount;
        if (frameCount) {
          keepDirtyFlags |= OverlayFlags.BOSS_HP_DIRTY;
        }
      }

      if (frameCount > 0) {
        if (floor(sin(TWO_PI * (60 / 1000) * frameCount)) >= 0) {
          ctx.strokeStyle = "#4F4";
        } else {
          ctx.strokeStyle = "#FFF";
        }

      } else if (frameCount < 0) {
        if (floor(sin(TWO_PI * (60 / 1000) * frameCount)) >= 0) {
          ctx.strokeStyle = "#F44";
        } else {
          ctx.strokeStyle = "#FFF";
        }
      } else {
        ctx.strokeStyle = "#FFF";
      }

      const percentage = min(1, max(0, player.hitpoints / player.maxHitpoints));
      const shieldPercentage = min(1, max(0, (player.shield / player.maxShield) || 0));

      // Keep width/height multiples of 8
      const w = (hpWidth + 8 - 1) & -8;
      const h = (hpHeight + 8 - 1) & -8;
      const y = ctx.lineWidth;
      const d = 10;
      const d2 = 0.5 * d;
      const red = `0${trunc((1 - percentage) * 0xFF).toString(16)}`;
      const green = `0${trunc(percentage * 0xFF).toString(16)}`;
      const color = `#${red.substr(-2)}${green.substr(-2)}88`;
      const shieldColor = "#4444CC";

      ctx.clearRect(x, y, w, h);
      ctx.beginPath();
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
      ctx.fillStyle = shieldColor;
      ctx.fillRect(x, y, shieldPercentage * w, h);
      ctx.stroke();
    }

    ctx.restore();
  }

  // if (game.overlayState.flag & OverlayFlags.BOSS_NAME_DIRTY) {
  //
  // }

  ctx.restore();

  game.overlayState.flag = keepDirtyFlags;
}

function draw(game) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  game.player.draw(gl);

  const levelState = game.levelState;
  if (levelState === LevelState.PLAYING || levelState === LevelState.END) {
    for (let k = 0, n = game.enemies.length; k < n; k += 1) {
      const enemy = game.enemies[k];
      if (enemy.active) {
        enemy.draw(gl);
      }
    }
  } else if (levelState === LevelState.BOSS) {
    game.bosses[game.level].draw(gl);
  }

  game.starMap.draw(gl);

  const powerups = game.powerups;
  for (let key in powerups) {
    if (Object.prototype.hasOwnProperty.call(powerups, key)) {
      const items = powerups[key].items;
      for (let k = 0, n = items.length; k < n; k += 1) {
        const item = items[k];
        if (item.active) {
          item.draw(gl);
        }
      }
    }
  }

  if (game.overlayState.flag) {
    drawOverlay(game);
  }
}

function setup(game, gl) {
  var err = 0;
  gl.clearColor(0.0, 0.0, 0.3, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  Console.debug("Initializing shaders");
  game.fragShader = Utils.getShader(gl, "gl_shader_frag");
  game.vertShader = Utils.getShader(gl, "gl_shader_vert");
  game.shaderProg = gl.createProgram();
  gl.attachShader(game.shaderProg, game.fragShader);
  gl.attachShader(game.shaderProg, game.vertShader);
  gl.linkProgram(game.shaderProg);
  if (!gl.getProgramParameter(game.shaderProg, gl.LINK_STATUS)) {
    console.log(gl.getProgramInfoLog(game.shaderProg));
    Console.error("Error: linking WebGL program");
    Console.show();
    return;
  }
  err = gl.getError();
  if (err) {
    Console.error(`Error: ${err}: Initializing shaders`);
    Console.show();
    return;
  }

  gl.useProgram(game.shaderProg);

  gl.bindAttribLocation(game.shaderProg, game.vertexPositionAttrib, "aVertexPosition");
  gl.enableVertexAttribArray(game.vertexPositionAttrib);

  gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexTriangleBufferObject);
  gl.bufferData(gl.ARRAY_BUFFER, game.verticesTriangle, gl.STATIC_DRAW);
  gl.vertexAttribPointer(game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);


  gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexCircleBufferObject);
  gl.bufferData(gl.ARRAY_BUFFER, game.verticesCircle, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexRectangleBufferObject);
  gl.bufferData(gl.ARRAY_BUFFER, game.verticesRectangle, gl.STATIC_DRAW);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  game.pUniform = gl.getUniformLocation(game.shaderProg, "uPMatrix");
  game.mvUniform = gl.getUniformLocation(game.shaderProg, "uMVMatrix");
  gl.uniformMatrix4fv(game.pUniform, false, game.pUniformMatrix);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  game.textureUniform = gl.getUniformLocation(game.shaderProg, "uSampler");
  game.textures.texCoordAttrib = gl.getAttribLocation(game.shaderProg, "aTextureCoord");
  gl.enableVertexAttribArray(game.textures.texCoordAttrib);
  gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);

  game.projectileTexCoords = game.gameData.projectileTexCoords.map(
    (el) => new Float32Array(el.coords)
  );

  game.powerupTexCoords = [];
  for (const key of Object.keys(game.gameData.powerups)) {
    const powerup = game.gameData.powerups[key];
    game.powerupTexCoords.push(powerup);
  }
  game.powerupTexCoords.sort((a, b) => {
    const a1 = a.texCoordsBufferIndex;
    const b1 = b.texCoordsBufferIndex;
    return (a1 > b1) - (a1 < b1);
  });
  game.powerupTexCoords = game.powerupTexCoords.map((el) => new Float32Array(el.texCoords));

  function loadTexture(texObj, img, texCoords, texIdIndex) {
    texObj.tex = gl.createTexture();
    texObj.img = doc.getElementById(img);

    gl.bindTexture(gl.TEXTURE_2D, texObj.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texObj.img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);

    for (let k = 0, n = texCoords.length; k < n; k += 1) {
      const buff = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buff);
      gl.bufferData(gl.ARRAY_BUFFER, texCoords[k], gl.STATIC_DRAW);
      texObj.coordBuffers.push(buff);
    }

    texObj.texId = gl.TEXTURE0 + texIdIndex;
    texObj.texIdIndex = texIdIndex;
  }

  Console.debug("Initializing textures");

  loadTexture(game.textures.ship, "img_ship", game.textures.ship.coords, game.textures.numTextures);
  game.textures.numTextures += 1;

  loadTexture(game.textures.enemyShip, "img_enemy_ship", game.textures.enemyShip.coords, game.textures.numTextures);
  game.textures.numTextures += 1;

  loadTexture(game.textures.boss, "img_boss", game.textures.boss.coords, game.textures.numTextures);
  game.textures.numTextures += 1;

  loadTexture(game.textures.explosion, "img_explosion", game.textures.explosion.coords, game.textures.numTextures);
  game.textures.numTextures += 1;

  loadTexture(game.textures.projectile, "img_projectiles_sprite", game.projectileTexCoords, game.textures.numTextures);
  game.textures.numTextures += 1;

  loadTexture(game.textures.star, "img_star", game.textures.star.coords, game.textures.numTextures);
  game.textures.numTextures += 1;

  loadTexture(game.textures.powerup, "img_powerups_sprite", game.powerupTexCoords, game.textures.numTextures);
  game.textures.numTextures += 1;

  err = gl.getError();
  if (err) {
    Console.error(`Error: ${err}: Initializing textures`);
    Console.show();
    return;
  }

  Console.debug("Initializing sound effects");
  try {
    game.soundFX = new SoundFX();
  } catch (e) {
    Console.error(`Error: Initializing sound effects: '${e}'`);
    game.soundFX = null;
  }

  Console.debug("Initializing game assets");

  game.player = new Player(game);
  game.players.push(game.player);

  game.starMap = new StarMap(game, game.numStars);

  /* Create arrays to hold enemy last spawn ts per level */
  const levels = game.gameData.levels;
  const levelEnemies = game.levelEnemies;
  for (let k = 0, n = levels.length; k < n; k += 1) {
    const lastTs = [];
    const level = levels[k];
    for (let iK = 0, iN = level.enemies.length; iK < iN; iK += 1) {
      lastTs.push(0);
    }
    levelEnemies.push({"lastTs": lastTs});
  }

  /* Create bosses */
  for (let k = 0, n = game.gameData.levels.length; k < n; k += 1) {
    game.bosses.push(new Boss(game, k, false));
  }

  /* Create powerups */
  for (let k = 0, n = 50; k < n; k += 1) {
    game.powerups.Health.items.push(new HealthPowerup(game));
    game.powerups.Shield.items.push(new ShieldPowerup(game));
  }

  loadSettings(game);

  Splash.intro({
    "canvasOverlayCtx": canvasOverlayCtx,
    "callback": start,
    "KEY_MAP": KEY_MAP
  });
}

})(window, document);
