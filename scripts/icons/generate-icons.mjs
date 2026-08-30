/**
 * Regenerate every app icon from public/favicon.svg so the PWA icon always
 * matches the browser icon. Run after changing the favicon:
 *
 *   node scripts/icons/generate-icons.mjs
 *
 * - icon-192/icon-512: the favicon as-is (rounded corners, transparent outside)
 * - apple-touch-icon: full-bleed square — iOS applies its own corner rounding,
 *   and transparent corners would be composited onto black
 * - maskable-192/512: full-bleed background with the artwork scaled into the
 *   maskable safe zone, since launchers crop these to their own shape
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const favicon = readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8')

// Full-bleed variant: drop the corner rounding from the background rect.
const square = favicon.replace(/ rx="\d+" ry="\d+"/, '')

// Maskable variant: shrink the artwork to 78% over the full-bleed background,
// keeping every stroke inside the launcher's safe zone.
const maskable = square.replace('<g><g fill=', '<g transform="translate(22 22) scale(0.78)"><g fill=')

function render(svg, size, file) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(new URL(`../../public/icons/${file}`, import.meta.url), png)
  console.log(`${file} (${size}x${size}, ${png.length} bytes)`)
}

render(favicon, 192, 'icon-192.png')
render(favicon, 512, 'icon-512.png')
render(square, 180, 'apple-touch-icon.png')
render(maskable, 192, 'maskable-192.png')
render(maskable, 512, 'maskable-512.png')
