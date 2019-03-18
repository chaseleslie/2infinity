/* global Physics Utils */
/* exported Projectile PhaserWeapon */

"use strict";

function PhaserWeapon(game, {type, projectileData, coolDown}) {
  const projectiles = [];

  for (let k = 0, n = projectileData.length; k < n; k += 1) {
    const projGroup = [];
    for (let iK = 0, iN = 10; iK < iN; iK += 1) {
      projGroup.push(new Projectile(game, projectileData[k]));
    }
    projectiles.push(projGroup);
  }

  this.game = game;
  this.type = type;
  this.projectiles = projectiles;
  this.projectileData = projectileData;
  this.point = Object.seal({"x": 0, "y": 0, "z": 0});
  this.lastFireTs = 0;
  this.coolDown = coolDown;
}

PhaserWeapon.prototype.draw = function(gl) {
  const projectiles = this.projectiles;
  for (let k = 0; k < projectiles.length; k += 1) {
    const projGroup = projectiles[k];
    for (let iK = 0, iN = projGroup.length; iK < iN; iK += 1) {
      const proj = projGroup[iK];
      if (proj.active) {
        proj.draw(gl);
      }
    }
  }
};

PhaserWeapon.prototype.update = function(dt, enemies) {
  const projectiles = this.projectiles;
  const point = this.point;
  let score = 0;

  for (let k = 0; k < projectiles.length; k += 1) {
    const projGroup = projectiles[k];
    for (let iK = 0, iN = projGroup.length; iK < iN; iK += 1) {
      const proj = projGroup[iK];
      if (!proj.active) {
        continue;
      }

      if (proj.offScreen) {
        proj.reset(0, 0, false);
        continue;
      }
      proj.update(dt);

      if (proj.exploded) {
        continue;
      }

      const hitbox = proj.hitbox;
      const projPos = proj.position;
      for (let n = 0; n < enemies.length; n += 1) {
        const enemy = enemies[n];
        const enemyActive = enemy.active && enemy.hitpoints > 0;
        const hasEqualDepth = enemy.positionDepth === hitbox.depth;
        if (enemyActive && hasEqualDepth && enemy.intersectsWith(hitbox)) {
          for (let m = 0; m < projPos.length; m += 1) {
            const vert = projPos[m];
            point.x = vert[0];
            point.y = vert[1];
            point.z = vert[2];
            const directHit = enemy.containsPoint(point);
            if (directHit) {
              score += enemy.takeHit(proj.damage);
              proj.setExploded();
              break;
            }
          }
        }
      }
    }

  }
  return score;
};

PhaserWeapon.prototype.reset = function() {
  const projectiles = this.projectiles;
  for (let k = 0, n = projectiles.length; k < n; k += 1) {
    const projGroup = projectiles[k];
    for (let iK = 0, iN = projGroup.length; iK < iN; iK += 1) {
      const proj = projGroup[iK];
      proj.reset(0, 0, false);
    }
  }
};

PhaserWeapon.prototype.fireWeapon = function(ts, dt, hitbox) {
  if (ts < (this.lastFireTs + this.coolDown)) {
    return false;
  }

  const game = this.game;
  const projectiles = this.projectiles;
  const aspect = game.aspect;
  const hitboxCenterX = hitbox.left + 0.5 * (hitbox.right - hitbox.left);
  const hitboxCenterY = hitbox.bottom + 0.5 * (hitbox.top - hitbox.bottom);
  const hitboxRadius = Math.abs(hitbox.right - hitboxCenterX);
  const cos = Math.cos;
  const sin = Math.sin;

  for (let k = 0, n = projectiles.length; k < n; k += 1) {
    const projGroup = projectiles[k];
    let foundProj = false;
    for (let iK = 0, iN = projGroup.length; iK < iN; iK += 1) {
      const proj = projGroup[iK];
      if (!proj.active) {
        foundProj = true;
        const xVal = aspect * (hitboxCenterX + hitboxRadius * cos(proj.dir));
        const yVal = aspect * (hitboxCenterY + hitboxRadius * sin(proj.dir));
        proj.reset(xVal, yVal, true, proj.dir);
        break;
      }
    }
    if (!foundProj) {
      const projData = this.projectileData[k];
      const proj = new Projectile(game, projData);
      const xVal = aspect * (hitboxCenterX + hitboxRadius * cos(proj.dir));
      const yVal = aspect * (hitboxCenterY + hitboxRadius * sin(proj.dir));
      proj.reset(xVal, yVal, true, proj.dir);
      projGroup.push(proj);
    }
  }

  this.lastFireTs = ts;
  return true;
};

Object.defineProperty(PhaserWeapon.prototype, "constructor", {
  "value": PhaserWeapon,
  "writable": false
});

function Projectile(game, projData) {
  const vertices = [
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3)
  ];
  const state = new Physics.State(
    [0, 0, 0],
    [0, 0, 0]
  );
  const translations = Object.seal({"x": 0, "y": 0, "z": 0});
  const rotations = Object.seal({"x": 0, "y": 0, "z": 0});
  const scales = Object.seal({"x": 0, "y": 0, "z": 0});
  const mvUniformMatrix = Utils.modelViewMatrix(
    new Float32Array(16),
    translations,
    rotations,
    scales
  );
  const hitbox = Object.seal({
    "left": 0,
    "right": 0,
    "top": 0,
    "bottom": 0,
    "depth": 0
  });

  this.game = game;
  this.projectileData = projData;
  this.dir = projData.dir;
  this.velocity = projData.velocity;
  this.damage = projData.damage;
  this.vertices = vertices;
  this.state = state;
  this.translations = translations;
  this.rotations = rotations;
  this.scales = scales;
  this.mvUniformMatrix = mvUniformMatrix;
  this.hitb = hitbox;
  this.isActive = false;
  this.prune = 0;
  this.texCoordsBufferIndexProj = projData.texType;
  this.texCoordsBufferIndexExpl = 0;
}

Object.defineProperty(Projectile.prototype, "showDestroyedFrames", {
  "value": 4,
  "writable": false
});

Projectile.prototype.reset = function(x, y, isActive) {
  const gameScale = this.game.modelScale;
  const modelScales = this.projectileData.modelScales;
  const state = this.state;
  const translations = this.translations;
  const rotations = this.rotations;
  const scales = this.scales;
  const mvUniformMatrix = this.mvUniformMatrix;
  const velocity = this.velocity;
  const dir = this.dir;
  state.position[0] = x;
  state.position[1] = y;
  state.velocity[0] = velocity * Math.cos(dir);
  state.velocity[1] = velocity * Math.sin(dir);
  translations.x = x;
  translations.y = y;
  rotations.z = -dir;
  scales.x = gameScale / modelScales[0];
  scales.y = gameScale / modelScales[1];
  scales.z = gameScale / modelScales[2];
  Utils.modelViewMatrix(mvUniformMatrix, translations, rotations, scales);
  this.prune = 0;
  this.isActive = isActive;
};

Projectile.prototype.draw = function(gl) {
  const game = this.game;
  const mvUniformMatrix = this.mvUniformMatrix;
  const prune = this.prune;
  gl.uniformMatrix4fv(game.mvUniform, false, mvUniformMatrix);
  if (prune) {
    const texCoordsBufferIndexExpl = this.texCoordsBufferIndexExpl;
    gl.activeTexture(game.textures.explosion.texId);
    gl.bindTexture(gl.TEXTURE_2D, game.textures.explosion.tex);
    gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.explosion.coordBuffers[texCoordsBufferIndexExpl]);
    gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(game.textureUniform, game.textures.explosion.texIdIndex);
  } else {
    const texCoordsBufferIndexProj = this.texCoordsBufferIndexProj;
    gl.activeTexture(game.textures.projectile.texId);
    gl.bindTexture(gl.TEXTURE_2D, game.textures.projectile.tex);
    gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.projectile.coordBuffers[texCoordsBufferIndexProj]);
    gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(game.textureUniform, game.textures.projectile.texIdIndex);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexRectangleBufferObject);
  gl.vertexAttribPointer(game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, game.verticesRectangle.length / 3);

  gl.bindTexture(gl.TEXTURE_2D, null);
};

Projectile.prototype.update = function(dt) {
  const game = this.game;
  const showDestroyedFrames = this.showDestroyedFrames;
  const mvUniformMatrix = this.mvUniformMatrix;
  const state = this.state;
  const prune = this.prune;
  if (prune) {
    if (prune > showDestroyedFrames) {
      this.isActive = false;
      return false;
    }
    this.prune += 1;
    return false;
  }

  Physics.integrateState(state, game.time, dt);
  mvUniformMatrix[12] = state.position[0];
  mvUniformMatrix[13] = state.position[1];

  return true;
};

Projectile.prototype.setExploded = function() {
  const mvUniformMatrix = this.mvUniformMatrix;
  const state = this.state;
  const translations = this.translations;
  const rotations = this.rotations;
  const scales = this.scales;
  this.prune += 1;
  translations.x = state.position[0];
  translations.y = state.position[1];
  rotations.z = Utils.random() * Utils.TWOPI;
  scales.y *= 3;
  Utils.modelViewMatrix(mvUniformMatrix, translations, rotations, scales);
};

Projectile.prototype.getPosition = function() {
  //   <|
  //  |>
  const game = this.game;
  const vertices = this.vertices;
  const mvUniformMatrix = this.mvUniformMatrix;
  const tri = game.verticesRectangleSub;
  const vert1 = tri[0];
  const vert2 = tri[1];
  const vert3 = tri[2];
  const vert4 = tri[3];
  const vert5 = tri[4];
  const vert6 = tri[5];

  const p1 = Utils.matrixMultiplyPoint(
    game.pUniformMatrix,
    Utils.matrixMultiplyPoint(mvUniformMatrix, vert1, vertices[0]),
    vertices[0]
  );
  const p2 = Utils.matrixMultiplyPoint(
    game.pUniformMatrix,
    Utils.matrixMultiplyPoint(mvUniformMatrix, vert2, vertices[1]),
    vertices[1]
  );
  const p3 = Utils.matrixMultiplyPoint(
    game.pUniformMatrix,
    Utils.matrixMultiplyPoint(mvUniformMatrix, vert3, vertices[2]),
    vertices[2]
  );
  const p4 = Utils.matrixMultiplyPoint(
    game.pUniformMatrix,
    Utils.matrixMultiplyPoint(mvUniformMatrix, vert4, vertices[3]),
    vertices[3]
  );
  const p5 = Utils.matrixMultiplyPoint(
    game.pUniformMatrix,
    Utils.matrixMultiplyPoint(mvUniformMatrix, vert5, vertices[4]),
    vertices[4]
  );
  const p6 = Utils.matrixMultiplyPoint(
    game.pUniformMatrix,
    Utils.matrixMultiplyPoint(mvUniformMatrix, vert6, vertices[5]),
    vertices[5]
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

  vertices[3][0] = p4[0];
  vertices[3][1] = p4[1];
  vertices[3][2] = p4[2];
  vertices[4][0] = p5[0];
  vertices[4][1] = p5[1];
  vertices[4][2] = p5[2];
  vertices[5][0] = p6[0];
  vertices[5][1] = p6[1];
  vertices[5][2] = p6[2];

  return vertices;
};

Projectile.prototype.getPositionLeft = function() {
  const game = this.game;
  const mvUniformMatrix = this.mvUniformMatrix;
  const tri = game.verticesRectangle;
  const x = tri[0], y = tri[1], z = tri[2], w = 1;
  const mvm = mvUniformMatrix;
  const c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

  return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
};

Projectile.prototype.getPositionRight = function() {
  const game = this.game;
  const mvUniformMatrix = this.mvUniformMatrix;
  const tri = game.verticesRectangle;
  const x = tri[3], y = tri[4], z = tri[5], w = 1;
  const mvm = mvUniformMatrix;
  const c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

  return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
};

Projectile.prototype.getPositionTop = function() {
  const game = this.game;
  const mvUniformMatrix = this.mvUniformMatrix;
  const tri = game.verticesRectangle;
  const x = tri[0], y = tri[1], z = tri[2], w = 1;
  const mvm = mvUniformMatrix;
  const c2r1 = mvm[1], c2r2 = mvm[5], c2r3 = mvm[9], c2r4 = mvm[13];

  return (x*c2r1 + y*c2r2 + z*c2r3 + w*c2r4) * game.pUniformMatrix[0];
};

Projectile.prototype.getPositionBottom = function() {
  const game = this.game;
  const mvUniformMatrix = this.mvUniformMatrix;
  const tri = game.verticesRectangle;
  const x = tri[15], y = tri[16], z = tri[17], w = 1;
  const mvm = mvUniformMatrix;
  const c2r1 = mvm[1], c2r2 = mvm[5], c2r3 = mvm[9], c2r4 = mvm[13];

  return (x*c2r1 + y*c2r2 + z*c2r3 + w*c2r4) * game.pUniformMatrix[0];
};

Projectile.prototype.getHitbox = function() {
  const hitbox = this.hitb;
  const mvUniformMatrix = this.mvUniformMatrix;
  hitbox.left = this.getPositionLeft();
  hitbox.right = this.getPositionRight();
  hitbox.top = this.getPositionTop();
  hitbox.bottom = this.getPositionBottom();
  hitbox.depth = mvUniformMatrix[14];
  return hitbox;
};

Projectile.prototype.isOffScreen = function() {
  const hitbox = this.getHitbox();
  const centerX = 0.5 * (hitbox.left + hitbox.right);
  const centerY = 0.5 * (hitbox.top + hitbox.bottom);
  if (centerX < -1.0 || centerX > 1.0 || centerY < -1.0 || centerY > 1.0) {
    return true;
  }
  return false;
};

Object.defineProperty(Projectile.prototype, "position", {"get": Projectile.prototype.getPosition});
Object.defineProperty(Projectile.prototype, "hitbox", {"get": Projectile.prototype.getHitbox});
Object.defineProperty(Projectile.prototype, "exploded", {"get": function() {return this.prune > 0;}});
Object.defineProperty(Projectile.prototype, "active", {"get": function() {return this.isActive;}});
Object.defineProperty(Projectile.prototype, "offScreen", {"get": Projectile.prototype.isOffScreen});
Object.defineProperty(Projectile.prototype, "constructor", {
  "value": Projectile,
  "writable": false
});
