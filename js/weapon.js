/* global Physics Utils */
/* exported Weapon Projectile */

"use strict";

function Weapon(game, type, numProj, projDir, coolDown, pTexType, isActive) {
  type = type || 0;
  numProj = numProj || 50;
  projDir = projDir || 0;
  var active = isActive || false;
  const projectiles = [];
  var weapon = game.gameData.weapons[type];
  var projType = weapon.projectileType;
  var projCount = weapon.projectileCount;
  var projCoolDown = coolDown || game.gameData.projectiles[projType].coolDown;
  var projTexType = pTexType;
  var projDeltaAngle = weapon.projectileDeltaAngle;
  var weaponLastTs = 0;
  const point = {"x": 0, "y": 0, "z": 0};

  for (let k = 0; k < numProj; k += 1) {
    projectiles.push(new Projectile(game, projType, 0, 0, false, projDir, projTexType));
  }

  this.reset = function(type, numProj, projDir, coolDown, pTexType, isActive) {
    type = type || 0;
    numProj = numProj || 50;
    projDir = projDir || 0;
    active = isActive || false;
    weapon = game.gameData.weapons[type];
    projType = weapon.projectileType;
    projCount = weapon.projectileCount;
    projCoolDown = coolDown || game.gameData.projectiles[projType].coolDown;
    projTexType = pTexType;
    projDeltaAngle = weapon.projectileDeltaAngle;
    weaponLastTs = 0;

    if (projectiles.length < numProj) {
      for (let k = numProj - projectiles.length; k; k -= 1) {
        projectiles.push(new Projectile(game, projType, 0, 0, false, projDir, projTexType));
      }
    }
  };

  this.draw = function(gl) {
    for (let k = 0; k < projectiles.length; k += 1) {
      let proj = projectiles[k];
      if (proj.active) {
        proj.draw(gl);
      }
    }
  };

  this.update = function(dt, enemies) {
    let score = 0;
    for (let k = 0; k < projectiles.length; k += 1) {
      const proj = projectiles[k];
      if (!proj.active) {
        continue;
      }

      let offScreen = false;
      const projHitbox = proj.hitbox;
      const centerX = (projHitbox.left + projHitbox.right) / 2;
      const centerY = (projHitbox.top + projHitbox.bottom) / 2;
      if (centerX < -1.0 || centerX > 1.0 || centerY < -1.0 || centerY > 1.0) {
        offScreen = true;
      }

      if (offScreen) {
        proj.reset(projType, 0, 0, false, projDir);
        continue;
      }
      proj.update(dt);

      if (proj.exploded) {
        continue;
      }

      const hitbox = proj.hitbox;
      for (let n = 0; n < enemies.length; n += 1) {
        const enemy = enemies[n];
        const enemyActive = enemy.active && enemy.hitpoints > 0;
        if (enemyActive && enemy.positionDepth === hitbox.depth && enemy.intersectsWith(hitbox)) {
          const projPos = proj.position;
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
    return score;
  };

  this.fireWeapon = function(ts, dt, projDir, hitbox) {
    var numFoundProj = 0;
    const aspect = game.aspect;
    const hitboxCenterX = hitbox.left + 0.5 * (hitbox.right - hitbox.left);
    const hitboxCenterY = hitbox.bottom + 0.5 * (hitbox.top - hitbox.bottom);
    const hitboxRadius = Math.abs(hitbox.right - hitboxCenterX);
    const oddProjCount = projCount & 1;
    const medianProjCount = Math.ceil(0.5 * projCount);
    const cos = Math.cos;
    const sin = Math.sin;

    if (ts < (weaponLastTs + projCoolDown)) {
      return false;
    }
    weaponLastTs = ts;

    /* Reuse existing projectile objects */
    for (let k = 0; k < projectiles.length; k += 1) {
      const proj = projectiles[k];
      if (!proj.active) {
        numFoundProj += 1;
        let pDeltaAngle = 0;
        if (projCount === 1) {
          pDeltaAngle = 0;
        } else if (oddProjCount) {
          if (numFoundProj === medianProjCount) {
            pDeltaAngle = 0;
          } else if (numFoundProj < medianProjCount) {
            pDeltaAngle = numFoundProj * projDeltaAngle;
          } else if (numFoundProj > medianProjCount) {
            pDeltaAngle = -(numFoundProj - medianProjCount) * projDeltaAngle;
          }
        } else if (!oddProjCount) {
          pDeltaAngle = Math.floor(0.5 * (numFoundProj - 1)) * projDeltaAngle + 0.5 * projDeltaAngle;
          pDeltaAngle = (numFoundProj & 1) ? -pDeltaAngle : pDeltaAngle;
        }

        const pDir = projDir + pDeltaAngle;
        const xVal = aspect * (hitboxCenterX + hitboxRadius * cos(pDir));
        const yVal = aspect * (hitboxCenterY + hitboxRadius * sin(pDir));
        proj.reset(projType, xVal, yVal, true, pDir, projTexType);
        if (numFoundProj >= projCount) {
          break;
        }
      }
    }

    /* Create new Projectile objects as needed */
    if (numFoundProj < projCount) {
      for (let k = 0, n = projCount - numFoundProj; k < n; k += 1) {
        numFoundProj += 1;
        let pDeltaAngle = 0;
        if (projCount === 1) {
          pDeltaAngle = 0;
        } else if (oddProjCount) {
          if (numFoundProj === medianProjCount) {
            pDeltaAngle = 0;
          } else if (numFoundProj < medianProjCount) {
            pDeltaAngle = numFoundProj * projDeltaAngle;
          } else if (numFoundProj > medianProjCount) {
            pDeltaAngle = -(numFoundProj - medianProjCount) * projDeltaAngle;
          }
        } else if (!oddProjCount) {
          pDeltaAngle = Math.floor(0.5 * (numFoundProj - 1)) * projDeltaAngle + 0.5 * projDeltaAngle;
          pDeltaAngle = (numFoundProj & 1) ? -pDeltaAngle : pDeltaAngle;
        }

        const pDir = projDir + pDeltaAngle;
        const xVal = hitboxCenterX + hitboxRadius * cos(pDir);
        const yVal = hitboxCenterY + hitboxRadius * sin(pDir);
        projectiles.push(new Projectile(game, projType, xVal, yVal, true, pDir, projTexType));
      }
    }

    return true;
  };

  Object.defineProperty(this, "projectiles", {get: function() {return projectiles;}});
  Object.defineProperty(this, "active", {get: function() {return active;}});
}

function Projectile(game, type, x, y, isActive, dir, pTexType) {
  var projType = game.gameData.projectiles[type];
  var velocity = projType.velocity;
  var dmg = projType.damage;
  var active = isActive || false;
  dir = dir || 0;
  var prune = 0;
  const showDestroyedFrames = 4;
  var depthPos = 0.0;
  const vertices = [
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3)
  ];
  const state = new Physics.State(
    [x, y, depthPos],
    [velocity * Math.cos(dir), velocity * Math.sin(dir), 0]
  );
  var texCoordsBufferIndexProj = pTexType;
  var texCoordsBufferIndexExpl = 0;

  const translateVec = {"x": x, "y": y, "z": 0};
  const rotations = {"x": 0, "y": 0, "z": -dir};
  const scales = {
    "x": game.modelScale / projType.modelScales[0],
    "y": game.modelScale / projType.modelScales[1],
    "z": game.modelScale / projType.modelScales[2]
  };
  const mvUniformMatrix = Utils.modelViewMatrix(
    new Float32Array(16),
    translateVec,
    rotations,
    scales
  );
  const hitbox = {
    "left": 0,
    "right": 0,
    "top": 0,
    "bottom": 0,
    "depth": 0
  };

  this.reset = function(pType, x1, y1, isActive, direc, texType) {
    projType = game.gameData.projectiles[pType];
    velocity = projType.velocity;
    scales.x = game.modelScale / projType.modelScales[0];
    scales.y = game.modelScale / projType.modelScales[1];
    scales.z = game.modelScale / projType.modelScales[2];
    pTexType = texType;
    texCoordsBufferIndexProj = texType;
    dmg = projType.damage;
    active = isActive || false;
    dir = direc || 0;

    state.position[0] = x1;
    state.position[1] = y1;
    state.velocity[0] = velocity * Math.cos(dir);
    state.velocity[1] = velocity * Math.sin(dir);

    translateVec.x = x1;
    translateVec.y = y1;
    rotations.z = -direc;
    Utils.modelViewMatrix(mvUniformMatrix, translateVec, rotations, scales);
    prune = 0;
  };

  this.draw = function(gl) {
    gl.uniformMatrix4fv(game.mvUniform, false, mvUniformMatrix);
    if (prune) {
      gl.activeTexture(game.textures.explosion.texId);
      gl.bindTexture(gl.TEXTURE_2D, game.textures.explosion.tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.explosion.coordBuffers[texCoordsBufferIndexExpl]);
      gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(game.textureUniform, game.textures.explosion.texIdIndex);
    } else {
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

  this.update = function(dt) {
    if (prune) {
      if (prune > showDestroyedFrames) {
        active = false;
        return false;
      }
      prune += 1;
      return false;
    }

    Physics.integrateState(state, game.time, dt);
    mvUniformMatrix[12] = state.position[0];
    mvUniformMatrix[13] = state.position[1];

    return true;
  };

  this.setExploded = function() {
    prune += 1;
    mvUniformMatrix[0] = scales.x;
    mvUniformMatrix[5] = scales.y * 3;
    mvUniformMatrix[10] = scales.z;
    mvUniformMatrix[14] = 0.0;
    mvUniformMatrix[15] = 1;
  };

  function getPosition() {
    //   <|
    //  |>
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
  }

  function getPositionLeft() {
    const tri = game.verticesTriangle;
    const x = tri[0], y = tri[1], z = tri[2], w = 1;
    const mvm = mvUniformMatrix;
    const c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

    return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
  }

  function getPositionRight() {
    const tri = game.verticesTriangle;
    const x = tri[3], y = tri[4], z = tri[5], w = 1;
    const mvm = mvUniformMatrix;
    const c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

    return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
  }

  function getPositionTop() {
    const tri = game.verticesTriangle;
    const x = tri[0], y = tri[1], z = tri[2], w = 1;
    const mvm = mvUniformMatrix;
    const c2r1 = mvm[1], c2r2 = mvm[5], c2r3 = mvm[9], c2r4 = mvm[13];

    return (x*c2r1 + y*c2r2 + z*c2r3 + w*c2r4) * game.pUniformMatrix[0];
  }

  function getPositionBottom() {
    const tri = game.verticesTriangle;
    const x = tri[6], y = tri[7], z = tri[8], w = 1;
    const mvm = mvUniformMatrix;
    const c2r1 = mvm[1], c2r2 = mvm[5], c2r3 = mvm[9], c2r4 = mvm[13];

    return (x*c2r1 + y*c2r2 + z*c2r3 + w*c2r4) * game.pUniformMatrix[0];
  }

  function getHitbox() {
    hitbox.left = getPositionLeft();
    hitbox.right = getPositionRight();
    hitbox.top = getPositionTop();
    hitbox.bottom = getPositionBottom();
    hitbox.depth = mvUniformMatrix[14];
    return hitbox;
  }

  Object.defineProperty(this, "position", {get: getPosition});
  Object.defineProperty(this, "positionLeft", {get: getPositionLeft});
  Object.defineProperty(this, "positionRight", {get: getPositionRight});
  Object.defineProperty(this, "positionTop", {get: getPositionTop});
  Object.defineProperty(this, "positionBottom", {get: getPositionBottom});
  Object.defineProperty(this, "positionDepth", {get: function() {return mvUniformMatrix[14];}});
  Object.defineProperty(this, "hitbox", {get: getHitbox});
  Object.defineProperty(this, "damage", {get: function() {return dmg;}});
  Object.defineProperty(this, "prune", {get: function() {return prune >= showDestroyedFrames;}});
  Object.defineProperty(this, "exploded", {get: function() {return prune > 0;}});
  Object.defineProperty(this, "active", {get: function() {return active;}});
  Object.defineProperty(this, "direction", {get: function() {return dir;}});
}
