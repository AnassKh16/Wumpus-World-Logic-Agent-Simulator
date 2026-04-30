import { neighbors4, type Coord, type Percept, type WorldState } from './types'

export type EpisodeConfig = {
  rows: number
  cols: number
  pitProb: number // 0..1
  seed?: number
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function makeRng(seed?: number): () => number {
  if (typeof seed === 'number') return mulberry32(seed)
  return () => Math.random()
}

export function createEpisode(cfg: EpisodeConfig): WorldState {
  const rows = Math.max(2, Math.floor(cfg.rows))
  const cols = Math.max(2, Math.floor(cfg.cols))
  const pitProb = Math.min(0.6, Math.max(0, cfg.pitProb))
  const start: Coord = { r: 0, c: 0 }
  const rng = makeRng(cfg.seed)

  const truth = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ pit: false, wumpus: false, gold: false })),
  )
  const visited = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false))

  // Place pits (never on start)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === start.r && c === start.c) continue
      if (rng() < pitProb) truth[r]![c]!.pit = true
    }
  }

  // Place exactly one wumpus, never on start or a pit.
  const candidates: Coord[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === start.r && c === start.c) continue
      if (!truth[r]![c]!.pit) candidates.push({ r, c })
    }
  }
  if (candidates.length === 0) {
    // Extremely unlikely unless pitProb is huge; ensure at least one candidate.
    truth[rows - 1]![cols - 1]!.pit = false
    candidates.push({ r: rows - 1, c: cols - 1 })
  }
  const w = candidates[Math.floor(rng() * candidates.length)]!
  truth[w.r]![w.c]!.wumpus = true

  // Place exactly one gold, never on start or a hazard.
  const goldCandidates: Coord[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === start.r && c === start.c) continue
      const t = truth[r]![c]!
      if (!t.pit && !t.wumpus) goldCandidates.push({ r, c })
    }
  }
  // If hazards filled the map (extremely unlikely), force bottom-right safe.
  if (goldCandidates.length === 0) {
    const forced = { r: rows - 1, c: cols - 1 }
    truth[forced.r]![forced.c]!.pit = false
    truth[forced.r]![forced.c]!.wumpus = false
    goldCandidates.push(forced)
  }
  const g = goldCandidates[Math.floor(rng() * goldCandidates.length)]!
  truth[g.r]![g.c]!.gold = true

  const world: WorldState = {
    rows,
    cols,
    start,
    agent: { ...start },
    truth,
    visited,
    gold: { ...g },
  }
  world.visited[start.r]![start.c] = true
  return world
}

export function perceptAt(world: WorldState, p: Coord): Percept {
  const neigh = neighbors4(world.rows, world.cols, p)
  let breeze = false
  let stench = false
  for (const q of neigh) {
    const t = world.truth[q.r]![q.c]!
    if (t.pit) breeze = true
    if (t.wumpus) stench = true
  }
  const here = world.truth[p.r]![p.c]!
  return { breeze, stench, glitter: here.gold }
}

export function isDeathCell(world: WorldState, p: Coord): boolean {
  const t = world.truth[p.r]![p.c]!
  return t.pit || t.wumpus
}

export function isGoldCell(world: WorldState, p: Coord): boolean {
  return !!world.truth[p.r]![p.c]!.gold
}

export function moveAgent(world: WorldState, to: Coord): WorldState {
  const next: WorldState = {
    ...world,
    agent: { ...to },
    visited: world.visited.map((row) => row.slice()),
  }
  next.visited[to.r]![to.c] = true
  return next
}

