/**
 * Calculate the great-circle distance between two points
 * on the Earth's surface using the Haversine formula.
 */
export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate ETA in minutes given distance (km) and speed (km/h)
 */
export function calculateETA(distanceKm: number, speedKmph: number): number {
  if (speedKmph <= 0) return Infinity;
  return Math.round((distanceKm / speedKmph) * 60);
}

/**
 * Linear interpolation between two coordinates
 */
export function interpolate(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  t: number
): [number, number] {
  return [
    startLat + (endLat - startLat) * t,
    startLng + (endLng - startLng) * t,
  ];
}
