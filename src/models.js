/**
 * Procedural 3D Models Builder (C172, Mirage 2000, A320, Runway)
 */

export function createC172Model() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xededed, roughness: 0.3 });
  const blue  = new THREE.MeshStandardMaterial({ color: 0x1d4e89, roughness: 0.4 });
  const dark  = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.32, 7.8, 12), white);
  fuse.rotation.x = Math.PI / 2;
  g.add(fuse);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.12, 1.5), blue);
  wing.position.set(0, 0.55, -0.2);
  g.add(wing);

  const hStab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 0.85), blue);
  hStab.position.set(0, 0.2, 3.2);
  g.add(hStab);

  const vStab = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.45, 1.1), blue);
  vStab.position.set(0, 0.85, 3.1);
  g.add(vStab);

  const prop = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.04), dark);
  prop.position.set(0, 0, -3.95);
  g.add(prop);
  g.propMesh = prop;
  return g;
}

export function createM2000Model() {
  const g = new THREE.Group();
  const camo = new THREE.MeshStandardMaterial({ color: 0x5a6d7c, roughness: 0.3 });
  const fuse = new THREE.Mesh(new THREE.ConeGeometry(0.9, 13.5, 14), camo);
  fuse.rotation.x = -Math.PI / 2;
  g.add(fuse);

  const deltaShape = new THREE.Shape();
  deltaShape.moveTo(0, -1.8);
  deltaShape.lineTo(-4.6, 4.2);
  deltaShape.lineTo(4.6, 4.2);
  deltaShape.closePath();
  const deltaWing = new THREE.Mesh(
    new THREE.ExtrudeGeometry(deltaShape, { depth: 0.09, bevelEnabled: false }),
    camo
  );
  deltaWing.rotation.x = Math.PI / 2;
  deltaWing.position.set(0, -0.05, -1.2);
  g.add(deltaWing);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 2.2), camo);
  fin.position.set(0, 1.25, 3.4);
  g.add(fin);
  return g;
}

export function createA320Model() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf5f6f8, roughness: 0.2 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x9099a2, roughness: 0.4 });
  const engMat  = new THREE.MeshStandardMaterial({ color: 0x1f2429, roughness: 0.5 });

  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.8, 35.0, 18), bodyMat);
  fuse.rotation.x = Math.PI / 2;
  g.add(fuse);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 16), bodyMat);
  nose.position.set(0, 0, -17.5);
  g.add(nose);

  const wings = new THREE.Mesh(new THREE.BoxGeometry(34.1, 0.4, 4.2), wingMat);
  wings.position.set(0, -0.6, -1.0);
  g.add(wings);

  [-5.6, 5.6].forEach(side => {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.0, 4.8, 14), engMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side, -1.8, -1.8);
    g.add(pod);
  });

  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.8, 4.8), bodyMat);
  tailFin.position.set(0, 3.8, 14.5);
  g.add(tailFin);
  return g;
}

export function createRunway() {
  const runwayGroup = new THREE.Group();

  const runwayMat = new THREE.MeshLambertMaterial({ color: 0x18181a });
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(45, 2200), runwayMat);
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, 0.08, -500);
  runwayGroup.add(runway);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
  const runwayLine = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2000), lineMat);
  runwayLine.rotation.x = -Math.PI / 2;
  runwayLine.position.set(0, 0.12, -500);
  runwayGroup.add(runwayLine);

  return runwayGroup;
}
