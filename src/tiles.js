/**
 * OpenStreetMap Tile Loader and Geographic Coordinate Conversion
 */

export const ORIGIN_LAT = 48.7519;
export const ORIGIN_LON = 2.1158;
export const METERS_PER_LAT = 111139.0;
export const METERS_PER_LON = 111139.0 * Math.cos(ORIGIN_LAT * Math.PI / 180.0);
export const ZOOM = 14;

export function latLonToTile(lat, lon, z) {
  const n = Math.pow(2, z);
  const latRad = lat * Math.PI / 180.0;
  return {
    x: Math.floor(((lon + 180.0) / 360.0) * n),
    y: Math.floor((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0 * n)
  };
}

export function tileToLatLon(x, y, z) {
  const n = Math.pow(2, z);
  return {
    lat: Math.atan(Math.sinh(Math.PI * (1.0 - (2.0 * y) / n))) * 180.0 / Math.PI,
    lon: (x / n) * 360.0 - 180.0
  };
}

export class TileManager {
  constructor(scene) {
    this.scene = scene;
    this.tileGroup = new THREE.Group();
    this.scene.add(this.tileGroup);

    this.textureLoader = new THREE.TextureLoader();
    this.activeTiles = new Map();

    this.defaultGroundCanvas = document.createElement('canvas');
    this.defaultGroundCanvas.width = 64;
    this.defaultGroundCanvas.height = 64;
    const dCtx = this.defaultGroundCanvas.getContext('2d');
    dCtx.fillStyle = '#2f4327';
    dCtx.fillRect(0, 0, 64, 64);
    this.defaultGroundTex = new THREE.CanvasTexture(this.defaultGroundCanvas);
  }

  update(cLat, cLon) {
    const current = latLonToTile(cLat, cLon, ZOOM);
    const radius = 2;
    const neededKeys = new Set();

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const tx = current.x + dx;
        const ty = current.y + dy;
        const key = `${ZOOM}_${tx}_${ty}`;
        neededKeys.add(key);

        if (!this.activeTiles.has(key)) {
          const nw = tileToLatLon(tx, ty, ZOOM);
          const se = tileToLatLon(tx + 1, ty + 1, ZOOM);
          const x0 = (nw.lon - ORIGIN_LON) * METERS_PER_LON;
          const z0 = -(nw.lat - ORIGIN_LAT) * METERS_PER_LAT;
          const x1 = (se.lon - ORIGIN_LON) * METERS_PER_LON;
          const z1 = -(se.lat - ORIGIN_LAT) * METERS_PER_LAT;

          const geo = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0));
          const mat = new THREE.MeshLambertMaterial({ map: this.defaultGroundTex });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set((x0 + x1) / 2.0, 0, (z0 + z1) / 2.0);
          this.tileGroup.add(mesh);

          this.textureLoader.load(
            `https://tile.openstreetmap.org/${ZOOM}/${tx}/${ty}.png`,
            (tex) => {
              tex.minFilter = THREE.LinearFilter;
              mat.map = tex;
              mat.needsUpdate = true;
            },
            undefined,
            () => {}
          );

          this.activeTiles.set(key, { mesh, geo, mat });
        }
      }
    }

    for (const [k, item] of this.activeTiles.entries()) {
      if (!neededKeys.has(k)) {
        this.tileGroup.remove(item.mesh);
        item.geo.dispose();
        item.mat.dispose();
        this.activeTiles.delete(k);
      }
    }
  }
}
