/** 2点間の距離（メートル）。地球を球とみなす近似で、数百m の判定には十分。 */
export function distanceInMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

  return 2 * R * Math.asin(Math.sqrt(h))
}

/** 施設名の比較用に表記ゆれを均す。 */
export function normalizePlaceName(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase()
}
