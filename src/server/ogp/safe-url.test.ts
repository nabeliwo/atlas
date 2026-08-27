import { describe, expect, it } from 'vitest'

import { checkFetchableUrl } from './safe-url'

describe('checkFetchableUrl', () => {
  it('通常の外部URLは許可する', () => {
    for (const url of [
      'https://example.com/blog/1',
      'http://example.com',
      'https://photos.google.com/share/abc',
      'https://xn--eckwd4c7c.example/path?a=1#x',
      'https://8.8.8.8/',
      'https://example.com:8443/x',
    ]) {
      expect(checkFetchableUrl(url), url).toMatchObject({ ok: true })
    }
  })

  it('http/https 以外のスキームを拒否する', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<script>',
      'file:///etc/passwd',
      'ftp://example.com',
      'gopher://example.com',
    ]) {
      expect(checkFetchableUrl(url), url).toMatchObject({ ok: false })
    }
  })

  it('URL として壊れているものを拒否する', () => {
    for (const url of ['', 'not a url', 'http://', '://example.com']) {
      expect(checkFetchableUrl(url), url).toMatchObject({ ok: false })
    }
  })

  it('認証情報つきURLを拒否する', () => {
    expect(checkFetchableUrl('https://user:pass@example.com')).toMatchObject({
      ok: false,
      reason: 'credentials',
    })
  })

  it('localhost と内部向けTLDを拒否する', () => {
    for (const url of [
      'http://localhost',
      'http://localhost:8080/x',
      'http://LOCALHOST/',
      'http://localhost./',
      'http://foo.local',
      'http://db.internal',
      'http://metadata.google.internal/computeMetadata/v1/',
    ]) {
      expect(checkFetchableUrl(url), url).toMatchObject({ ok: false })
    }
  })

  it('プライベート IPv4 を拒否する', () => {
    for (const url of [
      'http://127.0.0.1',
      'http://127.1.2.3',
      'http://10.0.0.1',
      'http://10.255.255.255',
      'http://172.16.0.1',
      'http://172.31.255.254',
      'http://192.168.1.1',
      'http://0.0.0.0',
      'http://100.64.0.1',
      'http://224.0.0.1',
    ]) {
      expect(checkFetchableUrl(url), url).toMatchObject({ ok: false })
    }
  })

  it('クラウドのメタデータアドレスを拒否する', () => {
    expect(
      checkFetchableUrl('http://169.254.169.254/latest/meta-data/'),
    ).toMatchObject({ ok: false, reason: 'private-address' })
  })

  it('整数表記など変則的な IPv4 を拒否する', () => {
    for (const url of [
      'http://2130706433', // 127.0.0.1 の10進表記
      'http://0177.0.0.1',
      'http://127.1',
    ]) {
      expect(checkFetchableUrl(url), url).toMatchObject({ ok: false })
    }
  })

  it('ループバック・link-local な IPv6 を拒否する', () => {
    for (const url of [
      'http://[::1]/',
      'http://[::]/',
      'http://[fe80::1]/',
      'http://[fd00::1]/',
      'http://[::ffff:127.0.0.1]/',
    ]) {
      expect(checkFetchableUrl(url), url).toMatchObject({ ok: false })
    }
  })

  it('172.16.0.0/12 の外側は許可する', () => {
    expect(checkFetchableUrl('http://172.15.0.1')).toMatchObject({ ok: true })
    expect(checkFetchableUrl('http://172.32.0.1')).toMatchObject({ ok: true })
  })
})
