/**
 * OGP 取得先 URL の検証（SSRF 対策）。
 *
 * このアプリは管理者が入力した任意の URL をサーバー側から fetch する。
 * 対策が無いと、Worker を踏み台にして到達できない先へリクエストを
 * 飛ばされる（クラウドのメタデータエンドポイント、内部ネットワークなど）。
 *
 * docs/06-technical-design.md の要求:
 *   http/https のみ / localhost 禁止 / private IP 禁止 /
 *   link-local・metadata IP 禁止 / redirect 後も再検証
 *
 * 注意: ホスト名が実行時に内部アドレスへ解決される DNS rebinding は
 * この層だけでは防げない。Workers からは名前解決の結果を見られないため、
 * ここでは「明らかに内部を指す入力」を落とすことに徹する。
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  // クラウドのメタデータサービス
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
])

/** .local などの内部向け TLD */
const BLOCKED_TLDS = ['.local', '.internal', '.localdomain', '.home.arpa']

export type UrlRejection =
  | 'invalid'
  | 'scheme'
  | 'credentials'
  | 'blocked-host'
  | 'private-address'

export type UrlCheck =
  | { ok: true; url: URL }
  | { ok: false; reason: UrlRejection }

export function checkFetchableUrl(input: string): UrlCheck {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return { ok: false, reason: 'invalid' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'scheme' }
  }

  // user:pass@host は、リダイレクト先で意図しない認証に使われうる
  if (url.username || url.password) {
    return { ok: false, reason: 'credentials' }
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, reason: 'blocked-host' }
  }
  if (BLOCKED_TLDS.some((tld) => hostname.endsWith(tld))) {
    return { ok: false, reason: 'blocked-host' }
  }

  if (isPrivateAddress(hostname)) {
    return { ok: false, reason: 'private-address' }
  }

  return { ok: true, url }
}

/** ホスト名が IP リテラルなら、内部向けアドレスかどうかを判定する。 */
function isPrivateAddress(hostname: string): boolean {
  // IPv6 リテラルは URL.hostname では [] が外れている
  const v6 = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname
  if (v6.includes(':')) return isPrivateIpv6(v6)

  const v4 = parseIpv4(hostname)
  return v4 ? isPrivateIpv4(v4) : false
}

/**
 * 10進やゼロ埋めなどの変則表記も潰したいので、厳密な4オクテット形式だけを
 * IPv4 として受け付ける。それ以外の数値だけのホスト名は弾く。
 */
function parseIpv4(hostname: string): Array<number> | null {
  if (!/^[0-9.]+$/.test(hostname)) return null

  const parts = hostname.split('.')
  if (parts.length !== 4) {
    // 2130706433 のような整数表記。ブラウザ/実装によっては解決されうるので弾く
    return [127, 0, 0, 1]
  }

  const octets = parts.map((p) => Number(p))
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return [127, 0, 0, 1]
  }
  return octets
}

function isPrivateIpv4([a, b]: Array<number>): boolean {
  if (a === undefined || b === undefined) return true
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10.0.0.0/8
  if (a === 127) return true // ループバック
  if (a === 169 && b === 254) return true // link-local / 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  if (a === 192 && b === 0) return true // 192.0.0.0/24, 192.0.2.0/24
  if (a >= 224) return true // マルチキャスト / 予約
  return false
}

function isPrivateIpv6(address: string): boolean {
  const addr = address.toLowerCase()
  if (addr === '::' || addr === '::1') return true
  if (addr.startsWith('fe80')) return true // link-local
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true // unique local
  // ::ffff:127.0.0.1 のような IPv4 射影
  if (addr.startsWith('::ffff:')) {
    const mapped = addr.slice('::ffff:'.length)
    const v4 = parseIpv4(mapped)
    return v4 ? isPrivateIpv4(v4) : true
  }
  return false
}
