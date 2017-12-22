/* global Physics Utils */
/* exported StarMap Star */

"use strict";

function StarMap(game, numStars) {
  const stars = [];
  numStars = numStars || 256;
  for (let k = 0; k < numStars; k += 1) {
    stars.push(new Star(game));
  }

  this.draw = function(gl) {
    for (let k = 0; k < numStars; k += 1) {
      const star = stars[k];
      star.draw(gl);
    }
  };
  this.update = function(dt) {
    for (let k = 0; k < numStars; k += 1) {
      const star = stars[k];
      star.update(dt);
      if (star.offScreen) {
        star.reset();
      }
    }
  };
}

function Star(game) {
  const stepFn = () => Utils.getRandomInt(0, 1);
  const depths = [0.8, 0.9, 1.0];
  const speedAndDepth = Utils.getRandomInt(0, depths.length - 1);
  const scale = 12;
  const scaleBounds = scale / 4;
  const depthPos = depths[speedAndDepth];
  const speeds = [
    0.0001, 0.00005, 0.00002
  ];
  const speed = speeds[speedAndDepth];
  const state = new Physics.State(
    [0, 0, depthPos],
    [-speed, 0, 0]
  );
  const texCoordsBufferIndex = 0;

  const translations = Object.seal({"x": 0, "y": 0, "z": depthPos});
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

  this.reset = function() {
    const vertPos = (stepFn() ? 1 : -1) * Utils.random() * (scaleBounds - scales.y);
    const horizPos = 1 + (scale / 4) + (Utils.random() * scales.x);

    state.position[0] = horizPos;
    state.position[1] = vertPos;
    translations.x = horizPos;
    translations.y = vertPos;

    Utils.modelViewMatrix(mvUniformMatrix, translations, rotations, scales);
  };

  this.draw = function(gl) {
    gl.activeTexture(game.textures.star.texId);
    gl.bindTexture(gl.TEXTURE_2D, game.textures.star.tex);
    gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.star.coordBuffers[texCoordsBufferIndex]);
    gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(game.textureUniform, game.textures.star.texIdIndex);

    gl.uniformMatrix4fv(game.mvUniform, false, mvUniformMatrix);
    gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexRectangleBufferObject);
    gl.vertexAttribPointer(game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, game.verticesRectangle.length / 3);

    gl.bindTexture(gl.TEXTURE_2D, null);
  };

  this.update = function(dt) {
    Physics.integrateState(state, game.time, dt);
    mvUniformMatrix[12] = state.position[0];
  };

  function getPositionRight() {
    const tri = game.verticesRectangle;
    const x = tri[3], y = tri[4], z = tri[5], w = 1;
    const mvm = mvUniformMatrix;
    const c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

    return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
  }

  function offScreen() {
    return getPositionRight() < -scaleBounds;
  }

  Object.defineProperty(this, "positionRight", {get: getPositionRight});
  Object.defineProperty(this, "offScreen", {get: offScreen});

  this.reset();
  translations.x = -4 + 8 * Utils.random();
  state.position[0] = translations.x;
  mvUniformMatrix[12] = translations.x;
}
