// 生成 PWA 图标（纯 Node 实现 PNG 编码，不依赖第三方库）
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const PAPER = [247, 244, 238]
const PINE = [47, 75, 67]
const CLAY = [190, 112, 87]

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width, height, pixels) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// 抗锯齿：用 4x4 超采样计算每个像素的覆盖率
function drawIcon(size, { rounded = true, inset = 0.12 } = {}) {
  const pixels = Buffer.alloc(size * size * 4)
  const radius = size * 0.22
  const cx = size / 2
  const cy = size / 2
  const S = 4

  // 笔画：从右下到左上的斜线（イメージ「ノ」）
  const p1 = [size * (0.34 + inset * 0.2), size * (0.72 - inset * 0.1)]
  const p2 = [size * (0.68 - inset * 0.1), size * (0.3 + inset * 0.2)]
  const halfW = size * 0.065
  const dot = [size * 0.62, size * 0.72]
  const dotR = size * 0.048

  function distSeg(px, py) {
    const vx = p2[0] - p1[0]
    const vy = p2[1] - p1[1]
    const wx = px - p1[0]
    const wy = py - p1[1]
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)))
    const dx = wx - vx * t
    const dy = wy - vy * t
    return Math.sqrt(dx * dx + dy * dy)
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgHit = 0
      let strokeHit = 0
      let dotHit = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px = x + (sx + 0.5) / S
          const py = y + (sy + 0.5) / S
          let inside = true
          if (rounded) {
            const dx = Math.max(Math.abs(px - cx) - (size / 2 - radius), 0)
            const dy = Math.max(Math.abs(py - cy) - (size / 2 - radius), 0)
            inside = dx * dx + dy * dy <= radius * radius
          }
          if (!inside) continue
          bgHit++
          if (distSeg(px, py) <= halfW) strokeHit++
          if (Math.hypot(px - dot[0], py - dot[1]) <= dotR) dotHit++
        }
      }
      const i = (y * size + x) * 4
      const total = S * S
      const a = bgHit / total
      let r = PINE[0]
      let g = PINE[1]
      let b = PINE[2]
      const inkRatio = (strokeHit + dotHit) / Math.max(1, bgHit)
      if (dotHit > strokeHit) {
        r = CLAY[0]
        g = CLAY[1]
        b = CLAY[2]
      } else if (strokeHit > 0) {
        r = PAPER[0]
        g = PAPER[1]
        b = PAPER[2]
      }
      // 简单混色，避免生硬边缘
      const m = Math.min(1, inkRatio * 1.6)
      if (dotHit <= strokeHit && strokeHit > 0) {
        r = PINE[0] + (PAPER[0] - PINE[0]) * m
        g = PINE[1] + (PAPER[1] - PINE[1]) * m
        b = PINE[2] + (PAPER[2] - PINE[2]) * m
      }
      pixels[i] = Math.round(r)
      pixels[i + 1] = Math.round(g)
      pixels[i + 2] = Math.round(b)
      pixels[i + 3] = Math.round(a * 255)
    }
  }
  return encodePng(size, size, pixels)
}

writeFileSync(join(outDir, 'icon-192.png'), drawIcon(192))
writeFileSync(join(outDir, 'icon-512.png'), drawIcon(512))
writeFileSync(join(outDir, 'icon-180.png'), drawIcon(180))
writeFileSync(join(outDir, 'icon-maskable-512.png'), drawIcon(512, { rounded: false, inset: 0.06 }))

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#2F4B43"/>
  <path d="M22 46 L45 19" stroke="#F7F4EE" stroke-width="8.5" stroke-linecap="round"/>
  <circle cx="40" cy="46" r="3.2" fill="#BE7057"/>
</svg>
`
writeFileSync(join(root, 'public', 'favicon.svg'), favicon)

console.log('icons generated')
