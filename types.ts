export type Coord = { r: number; c: number }

export type Percept = {
  breeze: boolean
  stench: boolean
  glitter: boolean
}

export type Hazard = 'pit' | 'wumpus'

export type CellTruth = {
  pit: boolean
  wumpus: boolean
  gold: boolean
}

export type CellKnowledge =
  | { kind: 'unknown' }
  | { kind: 'safe' }
  | { kind: 'hazard'; hazard: Hazard }

export type WorldState = {
  rows: number
  cols: number
  start: Coord
  agent: Coord
  truth: CellTruth[][]
  visited: boolean[][]
  gold: Coord
}

export function coordKey(p: Coord): string {
  return `${p.r},${p.c}`
}

export function inBounds(rows: number, cols: number, p: Coord): boolean {
  return p.r >= 0 && p.r < rows && p.c >= 0 && p.c < cols
}

export function neighbors4(rows: number, cols: number, p: Coord): Coord[] {
  const cand: Coord[] = [
    { r: p.r - 1, c: p.c },
    { r: p.r + 1, c: p.c },
    { r: p.r, c: p.c - 1 },
    { r: p.r, c: p.c + 1 },
  ]
  return cand.filter((q) => inBounds(rows, cols, q))
}

