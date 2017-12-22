/* global Physics Utils */
/* exported Powerup HealthPowerup */

function Powerup(game) {
  this.game = game;
  this.state = new Physics.State(
    [0, 0, 0],
    [0, 0, 0]
  );
  this.texCoordsBufferIndex = 0;
  this.translations = Object.seal({"x": 0, "y": 0, "z": 0});
  this.rotations = Object.seal({"x": 0, "y": 0, "z": 0});
  this.scales = Object.seal({"x": 0, "y": 0, "z": 0});
  this.mvUniformMatrix = new Float32Array(16);
  this.spawnX = 1.10 * game.aspect;
  this.hitbox = Object.seal({
    "left": 0,
    "right": 0,
    "top": 0,
    "bottom": 0,
    "depth": 0
  });
  this.active = false;
}

Powerup.prototype.draw = function(gl) {
  const game = this.game;
  const powerupTex = game.textures.powerup;
  const texCoordsBufferIndex = this.texCoordsBufferIndex;

  gl.activeTexture(powerupTex.texId);
  gl.bindTexture(gl.TEXTURE_2D, powerupTex.tex);
  gl.bindBuffer(gl.ARRAY_BUFFER, powerupTex.coordBuffers[texCoordsBufferIndex]);
  gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(game.textureUniform, powerupTex.texIdIndex);

  gl.uniformMatrix4fv(game.mvUniform, false, this.mvUniformMatrix);
  gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexRectangleBufferObject);
  gl.vertexAttribPointer(game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, game.verticesRectangle.length / 3);

  gl.bindTexture(gl.TEXTURE_2D, null);
};

Powerup.prototype.update = function(dt) {
  const game = this.game;
  const state = this.state;
  const mvUniformMatrix = this.mvUniformMatrix;
  Physics.integrateState(state, game.time, dt);
  mvUniformMatrix[12] = state.position[0];
};

Powerup.prototype.reset = function(data) {
  const stepFn = () => Utils.getRandomInt(0, 1);
  const game = this.game;
  const mvUniformMatrix = this.mvUniformMatrix;
  const translations = this.translations;
  const scales = this.scales;
  const rotations = this.rotations;
  const spawnX = this.spawnX;
  translations.x = spawnX;
  translations.y = (stepFn() ? 1 : -1) * Utils.random() * (1 - game.modelScale);
  translations.z = 0;
  scales.x = data.modelScales[0];
  scales.y = data.modelScales[1];
  scales.z = data.modelScales[2];
  rotations.x = 0;
  rotations.y = 0;
  rotations.z = 0;
  Utils.modelViewMatrix(mvUniformMatrix, translations, rotations, scales);
};

Powerup.prototype.getPositionLeft = function() {
  const game = this.game;
  const mvUniformMatrix = this.mvUniformMatrix;
  const tri = game.verticesRectangle;
  const x = tri[0], y = tri[1], z = tri[2], w = 1;
  const mvm = mvUniformMatrix;
  const c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

  return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
};

Powerup.prototype.getPositionRight = function() {
  const game = this.game;
  const mvUniformMatrix = this.mvUniformMatrix;
  const tri = game.verticesRectangle;
  const x = tri[3], y = tri[4], z = tri[5], w = 1;
  const mvm = mvUniformMatrix;
  const c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

  return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
};

Powerup.prototype.getPositionTop = function() {
  const game = this.game;
  const mvUniformMatrix = this.mvUniformMatrix;
  const tri = game.verticesRectangle;
  const x = tri[0], y = tri[1], z = tri[2], w = 1;
  const mvm = mvUniformMatrix;
  const c2r1 = mvm[1], c2r2 = mvm[5], c2r3 = mvm[9], c2r4 = mvm[13];

  return (x*c2r1 + y*c2r2 + z*c2r3 + w*c2r4) * game.pUniformMatrix[0];
};

Powerup.prototype.getPositionBottom = function() {
  const game = this.game;
  const mvUniformMatrix = this.mvUniformMatrix;
  const tri = game.verticesRectangle;
  const x = tri[15], y = tri[16], z = tri[17], w = 1;
  const mvm = mvUniformMatrix;
  const c2r1 = mvm[1], c2r2 = mvm[5], c2r3 = mvm[9], c2r4 = mvm[13];

  return (x*c2r1 + y*c2r2 + z*c2r3 + w*c2r4) * game.pUniformMatrix[0];
};

Powerup.prototype.getHitbox = function() {
  const hitbox = this.hitbox;
  hitbox.left = this.getPositionLeft();
  hitbox.right = this.getPositionRight();
  hitbox.top = this.getPositionTop();
  hitbox.bottom = this.getPositionBottom();
  return hitbox;
};

Object.defineProperty(Powerup.prototype, "offScreen", {
  "get": function() {
    return this.getPositionRight() < -1.0;
  }
});

function HealthPowerup(game) {
  Powerup.call(this, game);
  const type = "Health";
  const data = game.gameData.powerups[type];
  const state = this.state;
  state.velocity[0] = -data.speed;
  this.type = type;
  this.texCoordsBufferIndex = data.texCoordsBufferIndex;
}

HealthPowerup.prototype = Object.create(Powerup.prototype);

HealthPowerup.prototype.reset = function() {
  const game = this.game;
  const type = this.type;
  const data = game.gameData.powerups[type];
  Powerup.prototype.reset.call(this, data);
  this.active = true;
};
