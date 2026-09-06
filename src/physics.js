/**
 * 6-DOF Flight Dynamics Engine
 */

import { ORIGIN_LAT, ORIGIN_LON, METERS_PER_LAT, METERS_PER_LON } from './tiles.js';

export class PhysicsEngine {
  constructor(aircraftNode, models) {
    this.aircraftNode = aircraftNode;
    this.models = models;

    this.pos = new THREE.Vector3(0, 0, 250);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.angVel = new THREE.Vector3(0, 0, 0);

    this.throttle = 0.0;
    this.actualThrustRatio = 0.0;
    this.flaps = 0;
    this.currentNz = 1.0;
  }

  setInitialGroundPosition(groundAlt) {
    this.pos.y = groundAlt;
  }

  step(dt, spec, inputs, tileManager, soundEngine) {
    // Spooling thrust
    this.actualThrustRatio += (this.throttle - this.actualThrustRatio) * spec.spoolUp * dt * 4.0;

    const q = this.aircraftNode.quaternion;
    const invQ = q.clone().invert();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const up  = new THREE.Vector3(0, 1, 0).applyQuaternion(q);

    const localVel = this.vel.clone().applyQuaternion(invQ);
    const u = -localVel.z;
    const v = localVel.x;
    const w = localVel.y;
    const airspeed = this.vel.length();
    const safeAirspeed = Math.max(airspeed, 1.0);

    const alpha = Math.atan2(-w, Math.max(u, 1.0));
    const beta  = Math.atan2(v,  Math.max(u, 1.0));

    const rho = 1.225 * Math.exp(-this.pos.y / 8500.0);
    const qDyn = 0.5 * rho * (airspeed * airspeed);

    const hNorm = Math.max(0.0, Math.min(1.0, this.pos.y / spec.wingSpan));
    const groundEffect = 1.0 - hNorm;

    const flapCL = this.flaps * 0.35;
    let CL = (spec.CL0 + spec.CLalpha * alpha + flapCL) * (1.0 + 0.12 * groundEffect);
    let isStalled = false;

    if (Math.abs(alpha) > spec.alphaStall) {
      isStalled = true;
      CL = (spec.CL0 + flapCL) * Math.sign(alpha) * 0.65 * Math.cos(alpha);
    }

    const AR = (spec.wingSpan * spec.wingSpan) / spec.wingArea;
    let CDi = (CL * CL) / (Math.PI * AR * spec.e);
    CDi *= (1.0 - 0.45 * groundEffect);
    const CD = spec.CD0 + (this.flaps * 0.03) + CDi + (isStalled ? 0.32 * (Math.abs(alpha) - spec.alphaStall) : 0);

    const localLift = qDyn * spec.wingArea * CL;
    const localDrag = qDyn * spec.wingArea * CD;

    const localAeroForce = new THREE.Vector3(
      -qDyn * spec.wingArea * 0.28 * beta,
      localLift * Math.cos(alpha) - localDrag * Math.sin(alpha),
      -(localLift * Math.sin(alpha) + localDrag * Math.cos(alpha))
    );

    const totalAeroForce = localAeroForce.applyQuaternion(q);
    const thrustForce = fwd.clone().multiplyScalar(this.actualThrustRatio * spec.maxThrust);
    const gravityForce = new THREE.Vector3(0, -spec.mass * 9.81, 0);

    const totalForce = totalAeroForce.clone().add(thrustForce).add(gravityForce);
    const accel = totalForce.divideScalar(spec.mass);

    this.vel.addScaledVector(accel, dt);
    this.pos.addScaledVector(this.vel, dt);

    const nonGravAccel = totalAeroForce.clone().add(thrustForce).divideScalar(spec.mass);
    this.currentNz = 1.0 + (nonGravAccel.dot(up) / 9.81);

    const flowSpeed = Math.max(safeAirspeed, this.actualThrustRatio * 25.0);
    const qDynCtrl = 0.5 * rho * (flowSpeed * flowSpeed);

    const pitchTorque = (qDynCtrl * spec.wingArea * spec.chord) * (
      -0.48 * (alpha - 0.03) +
      spec.ctrlPitch * inputs.pitch -
      spec.dampPitch * (spec.chord / flowSpeed) * this.angVel.x
    );

    const rollTorque = (qDyn * spec.wingArea * spec.wingSpan) * (
      spec.ctrlRoll * inputs.roll -
      0.15 * beta -
      spec.dampRoll * (spec.wingSpan / safeAirspeed) * this.angVel.z
    );

    const yawTorque = (qDynCtrl * spec.wingArea * spec.wingSpan) * (
      -0.30 * beta +
      spec.ctrlYaw * inputs.yaw -
      spec.dampYaw * (spec.wingSpan / flowSpeed) * this.angVel.y
    );

    this.angVel.x += (pitchTorque / spec.Iyy) * dt;
    this.angVel.z += (rollTorque  / spec.Ixx) * dt;
    this.angVel.y += (yawTorque   / spec.Izz) * dt;

    const gAlt = spec.groundAlt;
    if (this.pos.y <= gAlt) {
      this.pos.y = gAlt;
      if (this.vel.y < 0) this.vel.y = 0;
      const rollMu = inputs.brakes ? 8.5 : 0.035;
      this.vel.x *= Math.max(0, 1.0 - 5.0 * dt);
      this.vel.z *= Math.max(0, 1.0 - rollMu * dt);
      this.angVel.z *= Math.max(0, 1.0 - 12.0 * dt);

      const currentPitch = new THREE.Euler().setFromQuaternion(this.aircraftNode.quaternion, 'YXZ').x;
      if (currentPitch > 0.22 && this.angVel.x > 0) this.angVel.x = 0;
      if (currentPitch < -0.04 && this.angVel.x < 0) this.angVel.x = 0;
    }

    this.aircraftNode.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
      this.angVel.x * dt, this.angVel.y * dt, this.angVel.z * dt, 'YXZ'
    ))).normalize();
    this.aircraftNode.position.copy(this.pos);

    if (this.models.c172 && this.models.c172.propMesh) {
      this.models.c172.propMesh.rotation.z += (this.actualThrustRatio * 110 + airspeed * 2 + 15) * dt;
    }

    const currentLat = ORIGIN_LAT - (this.pos.z / METERS_PER_LAT);
    const currentLon = ORIGIN_LON + (this.pos.x / METERS_PER_LON);

    if (tileManager) {
      tileManager.update(currentLat, currentLon);
    }

    if (soundEngine) {
      soundEngine.update(spec, this.actualThrustRatio, airspeed);
    }

    window.__simState = {
      name: spec.name,
      altitude_m: this.pos.y,
      airspeed_ms: airspeed,
      airspeed_kts: airspeed * 1.94384,
      altitude_ft: (this.pos.y - gAlt) * 3.28084,
      vertical_speed_fpm: this.vel.y * 196.85,
      alpha_deg: alpha * (180.0 / Math.PI),
      throttle_pct: Math.round(this.throttle * 100),
      thrust_pct: Math.round(this.actualThrustRatio * 100),
      g_force: this.currentNz,
      lat: currentLat,
      lon: currentLon,
      isStalled,
      pos: { x: this.pos.x, y: this.pos.y, z: this.pos.z }
    };
  }
}
