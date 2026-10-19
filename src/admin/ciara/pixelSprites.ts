/* Minecraft-style pixel sprites for the WW+TG page. Each row is one line of pixels;
   '.' is transparent. Generated from the character grids in the page's art notes. */

export const AXOLOTL_SPRITE = [
  '...............g........',
  '.............g.g.g......',
  '...........ggg.ggg......',
  '.................ooooo..',
  '...oo...........obbbbbo.',
  '..obbo..........obbhbbo.',
  '.obbbo..ooooooooobwebbo.',
  '.obbbbo.obbbbbbbocbbbbo.',
  '.obbboobbbbbbbbbobbmmmo.',
  '..ooo..osssssssssooooo..',
  '...oo..oooooooooo.......',
  '.........tt....tt.......',
  '........................',
  '........................',
] as const

export const FROG_SPRITE = [
  '...www....www...',
  '...wpw....wpw...',
  '..gwwwggggwwwg..',
  '.gggggggggggggg.',
  '.gkggggggggggkg.',
  '.gggggggggggggg.',
  '.ggmmmmmmmmmmgg.',
  '.gggggggggggggg.',
  '.dddddddddddddd.',
  '.llllllllllllll.',
  'tt............tt',
  'tt............tt',
] as const

export const AXOLOTL_PALETTES = {
  pink: {
    'o': '#5a2d45',
    'b': '#ffb8d9',
    'h': '#ffe0f0',
    's': '#f08ac0',
    'g': '#ff5fa8',
    'w': '#ffffff',
    'e': '#2b1b26',
    'c': '#ff7fb0',
    'm': '#7a2e4f',
    't': '#f08ac0',
  },
  blue: {
    'o': '#1f3550',
    'b': '#8fd0ff',
    'h': '#d6efff',
    's': '#5aa8e6',
    'g': '#3f8fe0',
    'w': '#ffffff',
    'e': '#1b2633',
    'c': '#5fb8ff',
    'm': '#1f3550',
    't': '#5aa8e6',
  },
} as const

export const FROG_PALETTE = {
  'g': '#9fcf5a',
  'd': '#6aa33a',
  'l': '#e6f2b5',
  'k': '#ff9fb0',
  'm': '#3b2a2a',
  'w': '#ffffff',
  'p': '#1c1c1c',
  't': '#6aa33a',
} as const
