/* global Utils */
/* exported Physics */

var Physics = (function() {

const isArrayLike = Utils.isArrayLike;

function State(pos, vel) {
  this.position = null;
  this.velocity = null;

  if (isArrayLike(pos) && pos.length >= 3) {
    this.position = new Float32Array(pos);
  } else {
    this.position = new Float32Array(3);
  }

  if (isArrayLike(vel) && vel.length >= 3) {
    this.velocity = new Float32Array(vel);
  } else {
    this.velocity = new Float32Array(3);
  }
}

State.prototype.setPosition = function(pos) {
  if (isArrayLike(pos) && pos.length >= 3) {
    this.position[0] = pos[0];
    this.position[1] = pos[1];
    this.position[2] = pos[2];
  }
};
State.prototype.multPosition = function(pos) {
  if (typeof pos === "number") {
    this.position[0] *= pos;
    this.position[1] *= pos;
    this.position[2] *= pos;
  } else if (isArrayLike(pos) && pos.length >= 3) {
    this.position[0] *= pos[0];
    this.position[1] *= pos[1];
    this.position[2] *= pos[2];
  }
};
State.prototype.addPosition = function(pos) {
  if (typeof pos === "number") {
    this.position[0] += pos;
    this.position[1] += pos;
    this.position[2] += pos;
  } else if (isArrayLike(pos) && pos.length >= 3) {
    this.position[0] += pos[0];
    this.position[1] += pos[1];
    this.position[2] += pos[2];
  }
};

State.prototype.setVelocity = function(vel) {
  if (isArrayLike(vel) && vel.length >= 3) {
    this.velocity[0] = vel[0];
    this.velocity[1] = vel[1];
    this.velocity[2] = vel[2];
  }
};
State.prototype.multVelocity = function(vel) {
  if (typeof vel === "number") {
    this.velocity[0] *= vel;
    this.velocity[1] *= vel;
    this.velocity[2] *= vel;
  } else if (isArrayLike(vel) && vel.length >= 3) {
    this.velocity[0] *= vel[0];
    this.velocity[1] *= vel[1];
    this.velocity[2] *= vel[2];
  }
};
State.prototype.addVelocity = function(vel) {
  if (typeof vel === "number") {
    this.velocity[0] += vel;
    this.velocity[1] += vel;
    this.velocity[2] += vel;
  } else if (isArrayLike(vel) && vel.length >= 3) {
    this.velocity[0] += vel[0];
    this.velocity[1] += vel[1];
    this.velocity[2] += vel[2];
  }
};

function StateDerivative(vel, acc) {
  this.velocity = null;
  this.acceleration = null;

  if (isArrayLike(vel) && vel.length >= 3) {
    this.velocity = new Float32Array(vel);
  } else {
    this.velocity = new Float32Array(3);
  }

  if (isArrayLike(acc) && acc.length >= 3) {
    this.acceleration = new Float32Array(acc);
  } else {
    this.acceleration = new Float32Array(3);
  }
}

StateDerivative.prototype.setVelocity = function(vel) {
  if (isArrayLike(vel) && vel.length >= 3) {
    this.velocity[0] = vel[0];
    this.velocity[1] = vel[1];
    this.velocity[2] = vel[2];
  }
};
StateDerivative.prototype.multVelocity = function(vel) {
  if (typeof vel === "number") {
    this.velocity[0] *= vel;
    this.velocity[1] *= vel;
    this.velocity[2] *= vel;
  } else if (isArrayLike(vel) && vel.length >= 3) {
    this.velocity[0] *= vel[0];
    this.velocity[1] *= vel[1];
    this.velocity[2] *= vel[2];
  }
};
StateDerivative.prototype.addVelocity = function(vel) {
  if (typeof vel === "number") {
    this.velocity[0] += vel;
    this.velocity[1] += vel;
    this.velocity[2] += vel;
  } else if (isArrayLike(vel) && vel.length >= 3) {
    this.velocity[0] += vel[0];
    this.velocity[1] += vel[1];
    this.velocity[2] += vel[2];
  }
};

StateDerivative.prototype.setAcceleration = function(acc) {
  if (isArrayLike(acc) && acc.length >= 3) {
    this.acceleration[0] = acc[0];
    this.acceleration[1] = acc[1];
    this.acceleration[2] = acc[2];
  }
};
StateDerivative.prototype.multAcceleration = function(acc) {
  if (typeof acc === "number") {
    this.acceleration[0] *= acc;
    this.acceleration[1] *= acc;
    this.acceleration[2] *= acc;
  } else if (isArrayLike(acc) && acc.length >= 3) {
    this.acceleration[0] *= acc[0];
    this.acceleration[1] *= acc[1];
    this.acceleration[2] *= acc[2];
  }
};
StateDerivative.prototype.addVelocity = function(acc) {
  if (typeof acc === "number") {
    this.acceleration[0] += acc;
    this.acceleration[1] += acc;
    this.acceleration[2] += acc;
  } else if (isArrayLike(acc) && acc.length >= 3) {
    this.acceleration[0] += acc[0];
    this.acceleration[1] += acc[1];
    this.acceleration[2] += acc[2];
  }
};

const zeroedArray = new Float32Array([0, 0, 0]);
const freeState = new State(zeroedArray, zeroedArray);
const freeDerivs = [
  new StateDerivative(),
  new StateDerivative(),
  new StateDerivative(),
  new StateDerivative()
];

function evaluateState(stateInitial, t, dt, stateDerivative, outStateDeriv, acc) {
  const initialPos = stateInitial.position;
  const initialVel = stateInitial.velocity;
  const derivVel = stateDerivative.velocity;
  const derivAcc = stateDerivative.acceleration;
  const state = freeState;

  state.position[0] = initialPos[0] + derivVel[0] * dt;
  state.position[1] = initialPos[1] + derivVel[1] * dt;
  state.position[2] = initialPos[2] + derivVel[2] * dt;

  state.velocity[0] = initialVel[0] + derivAcc[0] * dt;
  state.velocity[1] = initialVel[1] + derivAcc[1] * dt;
  state.velocity[2] = initialVel[2] + derivAcc[2] * dt;

  outStateDeriv.velocity[0] = state.velocity[0];
  outStateDeriv.velocity[1] = state.velocity[1];
  outStateDeriv.velocity[2] = state.velocity[2];
  outStateDeriv.acceleration[0] = acc[0];
  outStateDeriv.acceleration[1] = acc[1];
  outStateDeriv.acceleration[2] = acc[2];

  return outStateDeriv;
}

function integrateState(state, t, dt, acc) {
  acc = acc || zeroedArray;
  var deriv1 = freeDerivs[0];
  var deriv2 = freeDerivs[1];
  var deriv3 = freeDerivs[2];
  var deriv4 = freeDerivs[3];
  deriv1 = evaluateState(state, t, 0, deriv1, deriv1, acc);
  deriv2 = evaluateState(state, t, dt * 0.5, deriv1, deriv2, acc);
  deriv3 = evaluateState(state, t, dt * 0.5, deriv2, deriv3, acc);
  deriv4 = evaluateState(state, t, dt, deriv3, deriv4, acc);

  const vel1 = deriv1.velocity;
  const vel2 = deriv2.velocity;
  const vel3 = deriv3.velocity;
  const vel4 = deriv4.velocity;
  const statePos = state.position;
  statePos[0] += (1.0 / 6 * (vel1[0] + 2 * (vel2[0] + vel3[0]) + vel4[0])) * dt;
  statePos[1] += (1.0 / 6 * (vel1[1] + 2 * (vel2[1] + vel3[1]) + vel4[1])) * dt;
  statePos[2] += (1.0 / 6 * (vel1[2] + 2 * (vel2[2] + vel3[2]) + vel4[2])) * dt;

  const acc1 = deriv1.acceleration;
  const acc2 = deriv2.acceleration;
  const acc3 = deriv3.acceleration;
  const acc4 = deriv4.acceleration;
  const stateVel = state.velocity;
  stateVel[0] += (1.0 / 6 * (acc1[0] + 2 * (acc2[0] + acc3[0]) + acc4[0])) * dt;
  stateVel[1] += (1.0 / 6 * (acc1[1] + 2 * (acc2[1] + acc3[1]) + acc4[1])) * dt;
  stateVel[2] += (1.0 / 6 * (acc1[2] + 2 * (acc2[2] + acc3[2]) + acc4[2])) * dt;
}

function copyState(dst, src) {
  dst.position[0] = src.position[0];
  dst.position[1] = src.position[1];
  dst.position[2] = src.position[2];
  dst.velocity[0] = src.velocity[0];
  dst.velocity[1] = src.velocity[1];
  dst.velocity[2] = src.velocity[2];
}

function interpolateState(dst, state1, state2, alpha) {
  const alpha1 = 1 - alpha;
  dst.position[0] = (state1.position[0] * alpha1) + (state2.position[0] * alpha);
  dst.position[1] = (state1.position[1] * alpha1) + (state2.position[1] * alpha);
  dst.position[2] = (state1.position[2] * alpha1) + (state2.position[2] * alpha);
  dst.velocity[0] = (state1.velocity[0] * alpha1) + (state2.velocity[0] * alpha);
  dst.velocity[1] = (state1.velocity[1] * alpha1) + (state2.velocity[1] * alpha);
  dst.velocity[2] = (state1.velocity[2] * alpha1) + (state2.velocity[2] * alpha);
}

return {
  "State": State,
  "StateDerivative": StateDerivative,
  "evaluateState": evaluateState,
  "integrateState": integrateState,
  "copyState": copyState,
  "interpolateState": interpolateState
};

})();
