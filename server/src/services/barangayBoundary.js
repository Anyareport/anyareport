import { readFileSync } from 'node:fs';

const barangayData = JSON.parse(
  readFileSync(new URL('../../../client/src/data/DMM.json', import.meta.url), 'utf8')
);
const barangayFeature = barangayData.features.find((feature) =>
  feature.properties?.name?.toLowerCase().includes('don mariano marcos')
);

if (
  !barangayFeature ||
  !['Polygon', 'MultiPolygon'].includes(barangayFeature.geometry.type)
) {
  throw new Error('Don Mariano Marcos boundary polygon is missing or invalid');
}

function getRingContainment(longitude, latitude, ring) {
  let inside = false;
  const epsilon = 1e-10;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j];
    const [x2, y2] = ring[i];
    const cross = (longitude - x1) * (y2 - y1) - (latitude - y1) * (x2 - x1);
    const onSegment =
      Math.abs(cross) <= epsilon &&
      longitude >= Math.min(x1, x2) - epsilon &&
      longitude <= Math.max(x1, x2) + epsilon &&
      latitude >= Math.min(y1, y2) - epsilon &&
      latitude <= Math.max(y1, y2) + epsilon;

    if (onSegment) return 'boundary';

    const intersects =
      y1 > latitude !== y2 > latitude &&
      longitude < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1;
    if (intersects) inside = !inside;
  }

  return inside ? 'inside' : 'outside';
}

function isInsidePolygon(longitude, latitude, rings) {
  const outer = getRingContainment(longitude, latitude, rings[0]);
  if (outer === 'outside') return false;

  return rings.slice(1).every(
    (hole) => getRingContainment(longitude, latitude, hole) !== 'inside'
  );
}

export function isInsideBarangayBoundary(latitude, longitude) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return false;
  }

  const geometry = barangayFeature.geometry;
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  return polygons.some((rings) => isInsidePolygon(longitude, latitude, rings));
}
