/**
 * Build full-bleed PWA icons from lomiva-icon.png.
 * Source is a rounded tile with transparent corners + padded bars; we flatten
 * onto navy and scale the bars so launcher tiles look edge-to-edge (not nested).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const source = readFileSync(join(publicDir, 'lomiva-icon.png'))

/** Matches in-source navy (~#0f2a4a); full-bleed so no corner letterboxing. */
const NAVY = { r: 15, g: 42, b: 66, alpha: 1 }

async function barsBoundingBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let x0 = info.width
  let y0 = info.height
  let x1 = 0
  let y1 = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      if (a < 200) continue
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      // Bars: white or teal — not the navy field
      if (lum > 80 || g > 100) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
    }
  }
  if (x1 < x0) throw new Error('Could not detect logo bars in lomiva-icon.png')
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

/**
 * @param {number} size canvas size
 * @param {number} barFill fraction of canvas taken by the bars' longest side
 */
async function makeIcon(size, barFill) {
  const bbox = await barsBoundingBox(source)
  // Tiny pad so bar anti-alias isn't clipped
  const pad = 2
  const meta = await sharp(source).metadata()
  const left = Math.max(0, bbox.left - pad)
  const top = Math.max(0, bbox.top - pad)
  const width = Math.min(meta.width - left, bbox.width + pad * 2)
  const height = Math.min(meta.height - top, bbox.height + pad * 2)

  const longest = Math.max(width, height)
  const targetLongest = Math.round(size * barFill)
  const scale = targetLongest / longest
  const outW = Math.max(1, Math.round(width * scale))
  const outH = Math.max(1, Math.round(height * scale))

  const logo = await sharp(source)
    .extract({ left, top, width, height })
    .flatten({ background: NAVY })
    .resize(outW, outH, { fit: 'fill' })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: NAVY,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
}

const outputs = [
  // "any": bars dominate the tile (Lavaderos-like fullness)
  { name: 'pwa-192.png', size: 192, barFill: 0.78 },
  { name: 'pwa-512.png', size: 512, barFill: 0.78 },
  { name: 'apple-touch-icon.png', size: 180, barFill: 0.78 },
  { name: 'favicon-32.png', size: 32, barFill: 0.78 },
  // maskable: inside ~80% safe zone, still larger than the old nested squircle
  { name: 'pwa-512-maskable.png', size: 512, barFill: 0.68 },
]

for (const { name, size, barFill } of outputs) {
  await (await makeIcon(size, barFill)).toFile(join(publicDir, name))
  console.log(`Generated public/${name} (barFill ${barFill})`)
}
