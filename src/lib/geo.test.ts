import { describe, expect, it } from 'vitest'

import { distanceInMeters, normalizePlaceName } from './geo'

describe('distanceInMeters', () => {
  it('同じ地点は0', () => {
    const p = { latitude: 35.6811, longitude: 139.7996 }
    expect(distanceInMeters(p, p)).toBe(0)
  })

  it('清澄庭園の2フィーチャ間はおよそ133m', () => {
    // Geoapify が同名で返す実データ。名寄せのしきい値判断の根拠になっている。
    const park = { latitude: 35.679981, longitude: 139.7977865 }
    const bike = { latitude: 35.680948, longitude: 139.796917 }
    expect(distanceInMeters(park, bike)).toBeGreaterThan(125)
    expect(distanceInMeters(park, bike)).toBeLessThan(140)
  })

  it('東京とパリはおよそ9700km', () => {
    const tokyo = { latitude: 35.6811, longitude: 139.7996 }
    const paris = { latitude: 48.8606, longitude: 2.3376 }
    const km = distanceInMeters(tokyo, paris) / 1000
    expect(km).toBeGreaterThan(9600)
    expect(km).toBeLessThan(9800)
  })

  it('経度の符号をまたいでも計算できる', () => {
    const a = { latitude: 51.5076, longitude: -0.0994 }
    const b = { latitude: 51.5076, longitude: 0.0994 }
    expect(distanceInMeters(a, b)).toBeGreaterThan(0)
  })
})

describe('normalizePlaceName', () => {
  it('全角と半角、大文字小文字、前後の空白を吸収する', () => {
    expect(normalizePlaceName('　ＰＡＲＣＯ ')).toBe('parco')
    expect(normalizePlaceName('Shibuya Parco')).toBe('shibuya parco')
  })

  it('異なる施設名は一致しない', () => {
    expect(normalizePlaceName('清澄庭園')).not.toBe(
      normalizePlaceName('清澄庭園サービスセンター'),
    )
  })
})
