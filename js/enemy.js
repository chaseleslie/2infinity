/* global Physics Utils */
/* exported Enemy */

"use strict";

var global = window;

function Enemy(game, type, isBoss, isActive) {
  var enemyData = null;
  if (isBoss) {
    enemyData = game.gameData.bosses[type];
  } else {
    enemyData = game.gameData.enemies[type];
  }
  var aspect = game.aspect;
  var velocity = enemyData.velocity;
  var hp = enemyData.hitPoints;
  var points = hp;
  var weaponType = enemyData.weapon;
  var coolDownMult = enemyData.coolDownMult;
  var weapon = (weaponType === null) ? null : game.findEnemyWeapon(game);
  var projDir = Math.PI;
  var dmgRate = game.difficultyMap.prediv[game.difficulty];
  var prune = 0;
  const showDestroyedFrames = 8;
  var active = isActive || false;
  var verticalPos = 0;
  var horizontalPos = 0;
  if (isBoss) {
    horizontalPos = enemyData.spawnPos[0];
    verticalPos = enemyData.spawnPos[1];
  } else {
    verticalPos = Math.random() * (1 - game.modelScale);
    verticalPos = ((global.performance.now()|0) % 2) ? -verticalPos : verticalPos;
    horizontalPos = 1.10;
  }
  var depthPos = 0.0;
  var vertices = [
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3)
  ];
  var state = new Physics.State(
    [horizontalPos, verticalPos, depthPos],
    [(isBoss) ? 0 : -velocity, 0, 0]
  );
  var texCoordsBufferIndexShip = enemyData.texType;
  var texCoordsBufferIndexExpl = 0;

  var translateVec = {"x": horizontalPos, "y": verticalPos, "z": depthPos};
  var rotations = {"x": 0, "y": Math.PI, "z": 0};
  var scales = {
    "x": enemyData.modelScales[0] * game.modelScale / aspect,
    "y": enemyData.modelScales[1] * game.modelScale,
    "z": enemyData.modelScales[2] * game.modelScale
  };
  var mvUniformMatrix = Utils.modelViewMatrix(
    new Float32Array(16),
    translateVec,
    rotations,
    scales
  );
  var hitbox = {
    "left": 0,
    "right": 0,
    "top": 0,
    "bottom": 0,
    "depth": 0
  };

  if (weapon) {
    let weaponData = game.gameData.weapons[weaponType];
    let projData = game.gameData.projectiles[weaponData.projectileType];
    weapon.reset(weaponType, 50, projDir, coolDownMult * projData.coolDown, weaponData.texType, true);
  }

  this.reset = function(eType, isBoss, isActive) {
    var now = global.performance.now();
    var modelScale = game.modelScale;
    type = eType;
    if (isBoss) {
      enemyData = game.gameData.bosses[type];
    } else {
      enemyData = game.gameData.enemies[type];
    }
    velocity = enemyData.velocity;
    scales.x = enemyData.modelScales[0] * modelScale / aspect;
    scales.y = enemyData.modelScales[1] * modelScale;
    scales.z = enemyData.modelScales[2] * modelScale;
    hp = enemyData.hitPoints;
    points = hp;
    weaponType = enemyData.weapon;
    coolDownMult = enemyData.coolDownMult;
    weapon = (weaponType === null) ? null : game.findEnemyWeapon(game);
    dmgRate = game.difficultyMap.prediv[game.difficulty];
    prune = 0;
    active = isActive || false;
    texCoordsBufferIndexShip = enemyData.texType
    if (isBoss) {
      translateVec.x = enemyData.spawnPos[0];
      translateVec.y = enemyData.spawnPos[0];
      this.update = updateBoss;
    } else {
      translateVec.x = horizontalPos;
      translateVec.y = Math.random() * (1 - modelScale);
      translateVec.y = ((now|0) % 2) ? -translateVec.y : translateVec.y;
      this.update = updateEnemy;
    }

    if (weapon) {
      let weaponData = game.gameData.weapons[weaponType];
      let projData = game.gameData.projectiles[weaponData.projectileType];
      weapon.reset(weaponType, 50, projDir, coolDownMult * projData.coolDown, weaponData.texType, true);
    }

    state.position[0] = translateVec.x;
    state.position[1] = translateVec.y;
    state.velocity[0] = (isBoss) ? 0 : -velocity;

    Utils.modelViewMatrix(mvUniformMatrix, translateVec, rotations, scales);
  };
  this.draw = function(gl) {
    var numTri = 0;
    gl.uniformMatrix4fv(game.mvUniform, false, mvUniformMatrix);
    if (prune) {
      gl.activeTexture(game.textures.explosion.texId);
      gl.bindTexture(gl.TEXTURE_2D, game.textures.explosion.tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.explosion.coordBuffers[texCoordsBufferIndexExpl]);
      gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(game.textureUniform, game.textures.explosion.texIdIndex);

      gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexRectangleBufferObject);
      numTri = game.verticesRectangle.length / 3;
    } else {
      if (isBoss) {
        gl.activeTexture(game.textures.boss.texId);
        gl.bindTexture(gl.TEXTURE_2D, game.textures.boss.tex);
        gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.boss.coordBuffers[texCoordsBufferIndexShip]);
        gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1i(game.textureUniform, game.textures.boss.texIdIndex);
      } else {
        gl.activeTexture(game.textures.enemyShip.texId);
        gl.bindTexture(gl.TEXTURE_2D, game.textures.enemyShip.tex);
        gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.enemyShip.coordBuffers[texCoordsBufferIndexShip]);
        gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1i(game.textureUniform, game.textures.enemyShip.texIdIndex);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexTriangleBufferObject);
      numTri = game.verticesTriangle.length / 3;
    }

    gl.vertexAttribPointer(game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, numTri);

    gl.bindTexture(gl.TEXTURE_2D, null);

    if (weapon) {
      weapon.draw(gl);
    }
  };

  this.update = (isBoss) ? updateBoss : updateEnemy;
  function updateEnemy(dt) {
    var now = global.performance.now();
    if (hp <= 0) {
      if (prune > showDestroyedFrames) {
        active = false;
        return 0;
      }
      prune += 1;
      return 0;
    }

    Physics.integrateState(state, game.time, dt);
    mvUniformMatrix[12] = state.position[0];

    let score = 0;
    if (weapon) {
      score += weapon.update(dt, game.players);
      weapon.fireWeapon(now, dt, Math.PI, getHitbox());
    }

    return score;
  }
  const BOSS_EVADE = 0;
  const BOSS_TRACK = 1;
  const BOSS_ATTACK = 2;
  const BOSS_NUM_STATES = 3;
  var bossActionState = 0;
  var bossActionFrameMax = 120;
  var bossActionFrame = bossActionFrameMax;
  function updateBoss(dt) {
    var score = 0;
    if (hp <= 0) {
      if (prune > showDestroyedFrames) {
        active = false;
        return score;
      }
      prune += 1;
      return score;
    }

    bossActionFrame -= 1;
    if (!bossActionFrame) {
      bossActionFrame = bossActionFrameMax;
      bossActionState = Utils.getRandomInt(0, BOSS_NUM_STATES - 1);
    }

    if (bossActionState === BOSS_EVADE) {
      if (bossActionFrame === bossActionFrameMax) {
        let playerWeapons = game.player.weapons;
        let hitbox = getHitbox();
        let midX = 0.5 * (hitbox.left + hitbox.right);
        let midY = 0.5 * (hitbox.top + hitbox.bottom);
        let closestX = -10;
        let closestY = 0;
        let closest = 4;
        for (let k = 0, n = playerWeapons.length; k < n; k += 1) {
          let projectiles = playerWeapons[k].projectiles;
          for (let iK = 0, iN = projectiles.length; iK < iN; iK += 1) {
            let proj = projectiles[iK];
            if (!proj.active) {
              continue;
            }
            let projHitbox = proj.hitbox;
            let projMidX = 0.5 * (projHitbox.left + projHitbox.right);
            let projMidY = 0.5 * (projHitbox.top + projHitbox.bottom);
            let dist = Math.pow(midX - projMidX, 2) + Math.pow(midY - projMidY, 2);
            if (projMidX > midX) {
              continue;
            } else if (dist < closest) {
              closest = dist;
              closestX = projMidX;
              closestY = projMidY;
            }
          }
        }
        if (closestY > 0 && midY > -1) {
          state.velocity[1] = -velocity;
        } else if (closestY < 0 && midY < 1) {
          state.velocity[1] = velocity;
        } else {
          state.velocity[1] = 0;
        }
        state.velocity[0] = 0;
      }
    } else if (bossActionState === BOSS_TRACK) {
      let playerHitbox = game.player.hitbox;
      let playerMidY = 0.5 * (playerHitbox.top + playerHitbox.bottom);
      let hitbox = getHitbox();
      let midY = 0.5 * (hitbox.top + hitbox.bottom);
      if (midY < playerMidY) {
        state.velocity[1] = velocity;
      } else {
        state.velocity[1] = -velocity;
      }
    } else if (bossActionState === BOSS_ATTACK) {
      if (bossActionFrame === bossActionFrameMax) {
        state.velocity[0] = 0;
        state.velocity[1] = 0;
        weapon.fireWeapon(global.performance.now(), dt, projDir, getHitbox());
      }
    }

    Physics.integrateState(state, game.time, dt);
    mvUniformMatrix[12] = state.position[0];
    mvUniformMatrix[13] = state.position[1];
    score += weapon.update(dt, game.players);

    return score;
  }

  this.takeHit = function(pts) {
    hp -= dmgRate * pts;
    return pts;
  };
  this.containsPointHitbox = function(point) {
    var hitbox = getHitbox();
    return (
      (point.x >= hitbox.left) &&
      (point.x <= hitbox.right) &&
      (point.y <= hitbox.top) &&
      (point.y >= hitbox.bottom)
    );
  };
  this.containsPoint = function(point) {
    //Parametric equations solution
    var pos = getPosition();
    var p1 = pos[0], p2 = pos[1], p3 = pos[2];
    var denom = (p2[1] - p3[1])*(p1[0] - p3[0]) + (p3[0] - p2[0])*(p1[1] - p3[1]);
    var a = ((p2[1] - p3[1])*(point.x - p3[0]) + (p3[0] - p2[0])*(point.y - p3[1])) / denom;
    var b = ((p3[1] - p1[1])*(point.x - p3[0]) + (p1[0] - p3[0])*(point.y - p3[1])) / denom;
    var c = 1 - a - b;
    return (
      (0 <= a && a <= 1) &&
      (0 <= b && b <= 1) &&
      (0 <= c && c <= 1)
    );
  };
  this.intersectsWith = function(rect) {
    var hitbox = getHitbox();
    return (
      (rect.left < hitbox.right) &&
      (hitbox.left < rect.right) &&
      (rect.bottom < hitbox.top) &&
      (hitbox.bottom < rect.top)
    );
  };

  function getPosition() {
    //  <|
    var tri = game.verticesTriangleSub;
    var vert1 = tri[0];
    var vert2 = tri[1];
    var vert3 = tri[2];

    var p1 = Utils.matrixMultiplyPoint(
      game.pUniformMatrix,
      Utils.matrixMultiplyPoint(mvUniformMatrix, vert1, vertices[0]),
      vertices[0]
    );
    var p2 = Utils.matrixMultiplyPoint(
      game.pUniformMatrix,
      Utils.matrixMultiplyPoint(mvUniformMatrix, vert2, vertices[1]),
      vertices[1]
    );
    var p3 = Utils.matrixMultiplyPoint(
      game.pUniformMatrix,
      Utils.matrixMultiplyPoint(mvUniformMatrix, vert3, vertices[2]),
      vertices[2]
    );
    vertices[0][0] = p1[0];
    vertices[0][1] = p1[1];
    vertices[0][2] = p1[2];
    vertices[1][0] = p2[0];
    vertices[1][1] = p2[1];
    vertices[1][2] = p2[2];
    vertices[2][0] = p3[0];
    vertices[2][1] = p3[1];
    vertices[2][2] = p3[2];
    return vertices;
  }
  function getPositionLeft() {
    var tri = game.verticesTriangle;
    var x = tri[3], y = tri[4], z = tri[5], w = 1;
    var mvm = mvUniformMatrix;
    var c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

    return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
  }
  function getPositionRight() {
    var tri = game.verticesTriangle;
    var x = tri[0], y = tri[1], z = tri[2], w = 1;
    var mvm = mvUniformMatrix;
    var c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

    return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
  }
  function getPositionTop() {
    var tri = game.verticesTriangle;
    var x = tri[0], y = tri[1], z = tri[2], w = 1;
    var mvm = mvUniformMatrix;
    var c2r1 = mvm[1], c2r2 = mvm[5], c2r3 = mvm[9], c2r4 = mvm[13];

    return (x*c2r1 + y*c2r2 + z*c2r3 + w*c2r4) * game.pUniformMatrix[0];
  }
  function getPositionBottom() {
    var tri = game.verticesTriangle;
    var x = tri[6], y = tri[7], z = tri[8], w = 1;
    var mvm = mvUniformMatrix;
    var c2r1 = mvm[1], c2r2 = mvm[5], c2r3 = mvm[9], c2r4 = mvm[13];

    return (x*c2r1 + y*c2r2 + z*c2r3 + w*c2r4) * game.pUniformMatrix[0];
  }
  function getHitbox() {
    hitbox.left = getPositionLeft();
    hitbox.right = getPositionRight();
    hitbox.top = getPositionTop();
    hitbox.bottom = getPositionBottom();
    return hitbox;
  }

  Object.defineProperty(this, "hitPoints", {get: function () {return hp;}});
  Object.defineProperty(this, "maxHitPoints", {get: function () {return enemyData.hitPoints;}});
  Object.defineProperty(this, "points", {get: function () {return points;}});
  Object.defineProperty(this, "prune", {get: function () {return prune >= showDestroyedFrames;}});
  Object.defineProperty(this, "position", {get: getPosition});
  Object.defineProperty(this, "positionLeft", {get: getPositionLeft});
  Object.defineProperty(this, "positionRight", {get: getPositionRight});
  Object.defineProperty(this, "positionTop", {get: getPositionTop});
  Object.defineProperty(this, "positionBottom", {get: getPositionBottom});
  Object.defineProperty(this, "positionDepth", {get: function() {return mvUniformMatrix[14];}});
  Object.defineProperty(this, "hitbox", {get: getHitbox});
  Object.defineProperty(this, "active", {get: function() {return active;}});
  Object.defineProperty(this, "enemyType", {get: function() {return type;}});
}
