import type { CellKnowledge, Coord } from '../lib/wumpus/types'

export type GridProps = {
  rows: number
  cols: number
  agent: Coord
  visited: boolean[][]
  knowledge: CellKnowledge[][]
  gold: Coord
  plannedPathKeys: Set<string>
  walkedPathKeys: Set<string>
  showBreeze: boolean
  showStench: boolean
  showGlitter: boolean
  revealPercepts: 'visited' | 'all'
  breezeHintKeys: Set<string>
  stenchHintKeys: Set<string>
  glitterHintKeys: Set<string>
  perceptMap?: { breeze: boolean; stench: boolean; glitter: boolean }[][]
  flaggedKeys: Set<string>
  flagsEnabled?: boolean
  onFlagCell?: (p: Coord) => void
  onCellClick?: (p: Coord) => void
}

function keyOf(r: number, c: number): string {
  return `${r},${c}`
}

export function Grid({
  rows,
  cols,
  agent,
  visited,
  knowledge,
  gold,
  plannedPathKeys,
  walkedPathKeys,
  showBreeze,
  showStench,
  showGlitter,
  revealPercepts,
  breezeHintKeys,
  stenchHintKeys,
  glitterHintKeys,
  perceptMap,
  flaggedKeys,
  flagsEnabled = true,
  onFlagCell,
  onCellClick,
}: GridProps) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const k = knowledge[r]![c]!
          const isAgent = agent.r === r && agent.c === c
          const isVisited = visited[r]![c]!
          const isGold = gold.r === r && gold.c === c
          const k0 = keyOf(r, c)
          const inPlannedPath = plannedPathKeys.has(k0)
          const inWalkedPath = walkedPathKeys.has(k0)
          const isHazard = k.kind === 'hazard'
          const isFlagged = flaggedKeys.has(k0)

          const hintedHere = breezeHintKeys.has(k0) || stenchHintKeys.has(k0) || glitterHintKeys.has(k0)
          const canReveal = revealPercepts === 'all' || isVisited || hintedHere
          const showB =
            showBreeze &&
            canReveal &&
            (revealPercepts === 'all'
              ? (perceptMap?.[r]?.[c]?.breeze ?? false)
              : breezeHintKeys.has(k0))
          const showS =
            showStench &&
            canReveal &&
            (revealPercepts === 'all'
              ? (perceptMap?.[r]?.[c]?.stench ?? false)
              : stenchHintKeys.has(k0))
          const showG =
            showGlitter &&
            canReveal &&
            (revealPercepts === 'all'
              ? (perceptMap?.[r]?.[c]?.glitter ?? false)
              : glitterHintKeys.has(k0))

          const overlayClass =
            showB && showS && showG
              ? 'cellHintBSG'
              : showB && showS
                ? 'cellHintBS'
                : showB && showG
                  ? 'cellHintBG'
                  : showS && showG
                    ? 'cellHintSG'
                    : showB
                      ? 'cellBreezeHint'
                      : showS
                        ? 'cellStenchHint'
                        : showG
                          ? 'cellGlitterHint'
                          : ''

          const classes = [
            'cell',
            k.kind === 'safe' ? 'cellSafe' : '',
            isHazard ? 'cellHazard' : '',
            k.kind === 'unknown' ? 'cellUnknown' : '',
            isVisited ? 'cellVisited' : '',
            isAgent ? 'cellAgent' : '',
            isGold ? 'cellGold' : '',
            isFlagged ? 'cellFlagged' : '',
            inPlannedPath && !isHazard ? 'cellPath' : '',
            inWalkedPath && !isHazard ? 'cellWalked' : '',
            overlayClass,
          ]
            .filter(Boolean)
            .join(' ')

          const label =
            k.kind === 'hazard'
              ? k.hazard === 'pit'
                ? '🕳'
                : '👾'
              : isAgent
                ? '🤖'
                : isGold
                  ? '💰'
                  : isFlagged
                    ? '🚩'
                : ''

          return (
            <button
              key={`${r},${c}`}
              type="button"
              className={classes}
              onClick={() => onCellClick?.({ r, c })}
              onDragOver={(e) => {
                if (!flagsEnabled) return
                e.preventDefault()
              }}
              onDrop={(e) => {
                if (!flagsEnabled) return
                const t = e.dataTransfer.getData('text/plain')
                if (t === 'flag') onFlagCell?.({ r, c })
              }}
              title={`(${r},${c})`}
            >
              {(showB || showS || showG) && (
                <span className="cellHint">
                  {showB ? '🌪' : ''}
                  {showS ? '☣' : ''}
                  {showG ? '✨' : ''}
                </span>
              )}
              <span className="cellInner">{label}</span>
            </button>
          )
        }),
      )}
    </div>
  )
}

