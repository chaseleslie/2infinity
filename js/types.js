/* global Physics Utils */
/* exported StarMap Star */

"use strict";

function StarMap(game, numStars) {
  const stepFn = this.stepFn;
  const stars = [];
  numStars = numStars || 256;
  const constellations = [];
  const numStarTypes = game.gameData.stars.depths.length;

  for (let k = 0; k < numStars; k += 1) {
    const typeIndex = Utils.getRandomInt(0, numStarTypes - 1);
    const star = new Star(game, typeIndex);
    const scaleBounds = star.scaleBounds;
    const scales = star.scales;
    const translations = star.translations;
    const state = star.state;
    const mvUniformMatrix = star.mvUniformMatrix;
    const posY = (stepFn() ? 1 : -1) * Utils.random() * (scaleBounds - scales.y);
    star.reset(0, posY);
    // TODO calc initial x pos based on transform matrices
    translations.x = -4 + 8 * Utils.random();
    state.position[0] = translations.x;
    mvUniformMatrix[12] = translations.x;
    stars.push(star);
  }

  const stellas = game.gameData.stars.constellations;
  for (let k = 0, n = stellas.length; k < n; k += 1) {
    const stell = stellas[k];
    constellations.push(new Constellation(game, stell));
  }

  this.game = game;
  this.stars = stars;
  this.constellations = constellations;
}

StarMap.prototype.stepFn = function() {
  return Utils.getRandomInt(0, 1);
};

StarMap.prototype.draw = function(gl) {
  const stars = this.stars;
  const constellations = this.constellations;

  for (let k = 0; k < stars.length; k += 1) {
    const star = stars[k];
    star.draw(gl);
  }

  for (let k = 0, n = constellations.length; k < n; k += 1) {
    constellations[k].draw(gl);
  }
};

StarMap.prototype.update = function(dt) {
  const stepFn = this.stepFn;
  const stars = this.stars;
  const constellations = this.constellations;

  for (let k = 0; k < stars.length; k += 1) {
    const star = stars[k];
    star.update(dt);
    if (star.offScreen) {
      // TODO calc x/y pos based on transform matrices
      const scaleBounds = star.scaleBounds;
      const scale = star.scale;
      const scales = star.scales;
      const x = 1 + (scale / 4) + (Utils.random() * scales.x);
      const y = (stepFn() ? 1 : -1) * Utils.random() * (scaleBounds - scales.y);
      star.reset(x, y);
    }
  }

  for (let k = 0, n = constellations.length; k < n; k += 1) {
    constellations[k].update(dt);
  }
};

function Constellation(game, {name, coords, scale}) {
  const stars = [];
  const numStars = Math.trunc(coords.length / 2);
  const typeIndex = 1;

  for (let k = 0; k < numStars; k += 1) {
    const star = new Star(game, typeIndex);
    star.reset(-100, 0);
    stars.push(star);
  }

  const stellaCoords = [];
  for (let k = 0; k < coords.length; k += 2) {
    stellaCoords.push([coords[k], coords[k + 1]]);
  }

  this.game = game;
  this.name = name;
  this.coords = stellaCoords;
  this.scale = scale;
  this.stars = stars;
}

Constellation.prototype.draw = function(gl) {
  const stars = this.stars;

  for (let k = 0; k < stars.length; k += 1) {
    const star = stars[k];
    star.draw(gl);
  }
};

Constellation.prototype.update = function(dt) {
  const stepFn = StarMap.prototype.stepFn;
  const stars = this.stars;
  let allOffscreen = true;

  for (let k = 0; k < stars.length; k += 1) {
    const star = stars[k];
    star.update(dt);
    if (!star.offScreen) {
      allOffscreen = false;
    }
  }

  if (!allOffscreen) {
    return;
  }

  // TODO calc x/y pos based on transform matrices
  const game = this.game;
  const starData = game.gameData.stars;
  const scaleBounds = starData.scaleBounds;
  const scale = this.scale;
  const stellaCoords = this.coords;
  const starScale = stars[0].scale;
  const centerX = 1 + (0.25 * starScale) + scale;
  const centerY = (stepFn() ? 1 : -1) * Utils.random() * scaleBounds;
  for (let k = 0, n = stars.length; k < n; k += 1) {
    const coords = stellaCoords[k];
    const star = stars[k];
    const x = centerX - (0.5 * scale) + (coords[0] * scale);
    const y = centerY - (0.5 * scale) + (coords[1] * scale);
    star.reset(x, y);
  }
};

function Star(game, typeIndex) {
  const starData = game.gameData.stars;
  const depths = starData.depths;
  const velocities = starData.velocities;
  const scale = starData.scale;
  const scaleBounds = starData.scaleBounds;
  const depth = depths[typeIndex];
  const velocity = velocities[typeIndex];
  const state = new Physics.State(
    [0, 0, depth],
    [-velocity, 0, 0]
  );

  const translations = Object.seal({"x": 0, "y": 0, "z": depth});
  const rotations = Object.freeze({"x": 0, "y": 0, "z": 0});
  const scales = Object.freeze({
    "x": game.modelScale / (scale * game.aspect),
    "y": game.modelScale / scale,
    "z": game.modelScale / scale
  });
  const mvUniformMatrix = Utils.modelViewMatrix(
    new Float32Array(16),
    translations,
    rotations,
    scales
  );

  this.game = game;
  this.texCoordsBufferIndex = 0;
  this.typeIndex = typeIndex;
  this.scale = scale;
  this.scaleBounds = scaleBounds;
  this.state = state;
  this.translations = translations;
  this.rotations = rotations;
  this.scales = scales;
  this.mvUniformMatrix = mvUniformMatrix;
}

Star.prototype.reset = function(x, y) {
  const scales = this.scales;
  const translations = this.translations;
  const rotations = this.rotations;
  const state = this.state;
  const mvUniformMatrix = this.mvUniformMatrix;

  state.position[0] = x;
  state.position[1] = y;
  translations.x = x;
  translations.y = y;

  Utils.modelViewMatrix(mvUniformMatrix, translations, rotations, scales);
};

Star.prototype.draw = function(gl) {
  const game = this.game;
  const texCoordsBufferIndex = this.texCoordsBufferIndex;
  const mvUniformMatrix = this.mvUniformMatrix;
  const coordBuffers = game.textures.star.coordBuffers[texCoordsBufferIndex];

  gl.activeTexture(game.textures.star.texId);
  gl.bindTexture(gl.TEXTURE_2D, game.textures.star.tex);
  gl.bindBuffer(gl.ARRAY_BUFFER, coordBuffers);
  gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(game.textureUniform, game.textures.star.texIdIndex);

  gl.uniformMatrix4fv(game.mvUniform, false, mvUniformMatrix);
  gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexRectangleBufferObject);
  gl.vertexAttribPointer(game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, game.verticesRectangle.length / 3);

  gl.bindTexture(gl.TEXTURE_2D, null);
};

Star.prototype.update = function(dt) {
  const game = this.game;
  const state = this.state;
  const mvUniformMatrix = this.mvUniformMatrix;

  Physics.integrateState(state, game.time, dt);
  mvUniformMatrix[12] = state.position[0];
};

Star.prototype.getPositionRight = function() {
  const game = this.game;
  const mvUniformMatrix = this.mvUniformMatrix;
  const tri = game.verticesRectangle;
  const x = tri[3], y = tri[4], z = tri[5], w = 1;
  const mvm = mvUniformMatrix;
  const c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

  return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
};

Star.prototype.offScreen = function() {
  const scaleBounds = this.scaleBounds;
  return this.getPositionRight() < -scaleBounds;
};

Object.defineProperty(Star.prototype, "offScreen", {get: Star.prototype.offScreen});
