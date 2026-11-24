/**
 * 简单的进入密码校验。
 * 说明：这只是页面访问门槛，密码以 SHA-256 哈希形式写在前端代码里，
 * 不能替代服务器端鉴权；学习数据本身仍然只保存在当前设备的 IndexedDB 中。
 */

const PASSWORD_HASH = 'db6a70ca7c359bd847e3061023ce5f15358d3c92fbed620238f57fdc29773f78'

const UNLOCK_KEY = 'ravens-note:unlock'
const REMEMBER_MS = 7 * 24 * 60 * 60 * 1000

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n))
}

/** 纯 JS 的 SHA-256，避免在局域网 HTTP 下因 crypto.subtle 不可用而失效 */
export function sha256Hex(input: string): string {
  const msg = new TextEncoder().encode(input)
  const bitLen = msg.length * 8
  const padded = new Uint8Array(Math.ceil((msg.length + 9) / 64) * 64)
  padded.set(msg)
  padded[msg.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296))
  view.setUint32(padded.length - 4, bitLen >>> 0)

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const w = new Uint32Array(64)

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }

    const next = new Uint32Array(h)
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(next[4], 6) ^ rotr(next[4], 11) ^ rotr(next[4], 25)
      const ch = (next[4] & next[5]) ^ (~next[4] & next[6])
      const t1 = (next[7] + S1 + ch + K[i] + w[i]) | 0
      const S0 = rotr(next[0], 2) ^ rotr(next[0], 13) ^ rotr(next[0], 22)
      const maj = (next[0] & next[1]) ^ (next[0] & next[2]) ^ (next[1] & next[2])
      const t2 = (S0 + maj) | 0

      next[7] = next[6]
      next[6] = next[5]
      next[5] = next[4]
      next[4] = (next[3] + t1) | 0
      next[3] = next[2]
      next[2] = next[1]
      next[1] = next[0]
      next[0] = (t1 + t2) | 0
    }

    for (let i = 0; i < 8; i += 1) h[i] = (h[i] + next[i]) | 0
  }

  return Array.from(h, (x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}

export function isUnlocked(): boolean {
  try {
    if (sessionStorage.getItem(UNLOCK_KEY) === '1') return true
  } catch {
    // 隐私模式下不可用时忽略
  }
  try {
    const raw = localStorage.getItem(UNLOCK_KEY)
    if (!raw) return false
    const until = Number(raw)
    if (Number.isFinite(until) && until > Date.now()) return true
    localStorage.removeItem(UNLOCK_KEY)
  } catch {
    // 忽略
  }
  return false
}

export function unlockWithPassword(password: string, remember: boolean): boolean {
  if (sha256Hex(password.trim()) !== PASSWORD_HASH) return false
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1')
  } catch {
    // 忽略
  }
  if (remember) {
    try {
      localStorage.setItem(UNLOCK_KEY, String(Date.now() + REMEMBER_MS))
    } catch {
      // 忽略
    }
  }
  return true
}

export function lockDevice(): void {
  try {
    sessionStorage.removeItem(UNLOCK_KEY)
  } catch {
    // 忽略
  }
  try {
    localStorage.removeItem(UNLOCK_KEY)
  } catch {
    // 忽略
  }
}
