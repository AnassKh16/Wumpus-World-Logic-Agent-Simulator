import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import './App.css'
import { Grid } from './components/Grid'
import { KnowledgeBase } from './lib/logic/kb'
import { createEpisode, isDeathCell, isGoldCell, moveAgent, perceptAt } from './lib/wumpus/env'
import { tellPerceptFacts, tellPerceptRules, tellStartSafe } from './lib/wumpus/kbRules'
import { neighbors4, type CellKnowledge, type Coord, type Percept, type WorldState } from './lib/wumpus/types'
import { L_notP, L_notW } from './lib/logic/kb'

type RunStatus = 'running' | 'dead' | 'won' | 'stuck'

type LogEntry = {
  id: string
  atMs: number
  step: number
  kind: 'move' | 'info' | 'end'
  text: string
}

function keyCoord(p: Coord): string {
  return `${p.r},${p.c}`
}

function App() {
  const [rows, setRows] = useState(4)
  const [cols, setCols] = useState(4)
  const [pitProb, setPitProb] = useState(0.2)
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000))

  const [world, setWorld] = useState<WorldState>(() =>
    createEpisode({ rows: 4, cols: 4, pitProb: 0.2, seed }),
  )
  const [kb, setKb] = useState(() => {
    const k = new KnowledgeBase()
    k.tell(tellStartSafe())
    // Seed initial percept + rule at start.
    const p = perceptAt(world, world.agent)
    k.tell(tellPerceptFacts(world.agent, p))
    k.tell(tellPerceptRules(world, world.agent))
    return k
  })

  const [knowledge, setKnowledge] = useState<CellKnowledge[][]>(() =>
    Array.from({ length: world.rows }, () =>
      Array.from({ length: world.cols }, () => ({ kind: 'unknown' as const })),
    ),
  )
  const [percepts, setPercepts] = useState<Percept>(() => perceptAt(world, world.agent))
  const [inferenceSteps, setInferenceSteps] = useState(0)
  const [status, setStatus] = useState<RunStatus>('running')
  const [simSpeed, setSimSpeed] = useState<'slow' | 'norm' | 'fast'>('norm')
  const [isSimulating, setIsSimulating] = useState(false)

  const [showBreezeMap, setShowBreezeMap] = useState(false)
  const [showStenchMap, setShowStenchMap] = useState(false)
  const [showGlitterMap, setShowGlitterMap] = useState(false)
  const [revealPercepts, setRevealPercepts] = useState<'visited' | 'all'>('visited')
  const [credits, setCredits] = useState(0) // 0..3
  const [leverAnimating, setLeverAnimating] = useState(false)
  const [arcadeReady, setArcadeReady] = useState(false)
  const [showStartOverlay, setShowStartOverlay] = useState(false)

  const [flagMode, setFlagMode] = useState(false)
  const [flaggedKeys, setFlaggedKeys] = useState<Set<string>>(() => new Set())

  const [stepCount, setStepCount] = useState(0)
  const [moveCount, setMoveCount] = useState(0)
  const [log, setLog] = useState<LogEntry[]>(() => [
    {
      id: crypto.randomUUID?.() ?? String(Math.random()),
      atMs: Date.now(),
      step: 0,
      kind: 'info',
      text: 'Ready. Use manual moves or press Simulate to run step-by-step to the gold.',
    },
  ])
  const runStartedAt = useRef<number>(Date.now())
  const runEndedAt = useRef<number | null>(null)
  const simStartedAt = useRef<number | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)

  const visited = world.visited
  const speedMs = simSpeed === 'slow' ? 800 : simSpeed === 'fast' ? 120 : 350

  const [breezeHintKeys, setBreezeHintKeys] = useState<Set<string>>(() => new Set())
  const [stenchHintKeys, setStenchHintKeys] = useState<Set<string>>(() => new Set())
  const [glitterHintKeys, setGlitterHintKeys] = useState<Set<string>>(() => new Set())
  const [walkedPathKeys, setWalkedPathKeys] = useState<Set<string>>(() => new Set([keyCoord(world.start)]))

  const perceptMap = useMemo(() => {
    if (revealPercepts !== 'all') return undefined
    if (!showBreezeMap && !showStenchMap && !showGlitterMap) return undefined
    const map = Array.from({ length: world.rows }, () =>
      Array.from({ length: world.cols }, () => ({ breeze: false, stench: false, glitter: false })),
    )
    for (let r = 0; r < world.rows; r++) {
      for (let c = 0; c < world.cols; c++) {
        const p = perceptAt(world, { r, c })
        map[r]![c] = { breeze: p.breeze, stench: p.stench, glitter: p.glitter }
      }
    }
    return map
  }, [world, revealPercepts, showBreezeMap, showStenchMap, showGlitterMap])

  const plannedPathKeys = useMemo(() => new Set<string>(), [])
  useEffect(() => {
    setKnowledge((k) => {
      if (k[0]?.[0]?.kind === 'safe') return k
      const next = k.map((row) => row.map((x) => ({ ...x } as CellKnowledge)))
      if (next[0]?.[0]) next[0][0] = { kind: 'safe' }
      return next
    })
  }, [])

  useEffect(() => {
    if (!isSimulating) return
    if (status !== 'running') return
    const t = window.setInterval(() => {
      stepAgentSim()
    }, speedMs)
    return () => window.clearInterval(t)
  }, [isSimulating, status, speedMs, world, stepCount, flaggedKeys, kb])

  useEffect(() => {
    if (status === 'running') return
    setIsSimulating(false)
    if (runEndedAt.current == null) runEndedAt.current = Date.now()
  }, [status])

  useEffect(() => {
    const el = logRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [log.length])

  function pushLog(entry: Omit<LogEntry, 'id' | 'atMs'>) {
    setLog((prev) => [
      ...prev,
      {
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        atMs: Date.now(),
        ...entry,
      },
    ])
  }

  function resetSameEpisode() {
    // Reset board state but keep the same seed/world layout.
    const w = createEpisode({ rows: world.rows, cols: world.cols, pitProb, seed })
    setWorld(w)
    setStatus('running')
    setIsSimulating(false)
    setInferenceSteps(0)
    setStepCount(0)
    setMoveCount(0)
    runStartedAt.current = Date.now()
    runEndedAt.current = null

    const k = new KnowledgeBase()
    k.tell(tellStartSafe())
    const p = perceptAt(w, w.agent)
    k.tell(tellPerceptFacts(w.agent, p))
    k.tell(tellPerceptRules(w, w.agent))
    setKb(k)
    setPercepts(p)
    setKnowledge(
      Array.from({ length: w.rows }, () =>
        Array.from({ length: w.cols }, () => ({ kind: 'unknown' as const })),
      ).map((row, r) =>
        row.map((cell, c) => (r === 0 && c === 0 ? ({ kind: 'safe' as const } satisfies CellKnowledge) : cell)),
      ),
    )
    setBreezeHintKeys(new Set())
    setStenchHintKeys(new Set())
    setGlitterHintKeys(new Set())
    setWalkedPathKeys(new Set([keyCoord(w.start)]))
    setLeverAnimating(false)
    setArcadeReady(false)
    setShowStartOverlay(false)
    setFlagMode(false)
    setFlaggedKeys(new Set())
    simStartedAt.current = null
    setLog([
      {
        id: crypto.randomUUID?.() ?? String(Math.random()),
        atMs: Date.now(),
        step: 0,
        kind: 'info',
        text: 'Reset: same world layout, agent back to start.',
      },
    ])
  }

  function resetEpisode() {
    const nextSeed = Math.floor(Math.random() * 1_000_000)
    setSeed(nextSeed)
    const w = createEpisode({ rows, cols, pitProb, seed: nextSeed })
    setWorld(w)
    setStatus('running')
    setIsSimulating(false)
    setInferenceSteps(0)
    setStepCount(0)
    setMoveCount(0)
    runStartedAt.current = Date.now()
    runEndedAt.current = null
    const k = new KnowledgeBase()
    k.tell(tellStartSafe())
    const p = perceptAt(w, w.agent)
    k.tell(tellPerceptFacts(w.agent, p))
    k.tell(tellPerceptRules(w, w.agent))
    setKb(k)
    setPercepts(p)
    setKnowledge(
      Array.from({ length: w.rows }, () =>
        Array.from({ length: w.cols }, () => ({ kind: 'unknown' as const })),
      ).map((row, r) =>
        row.map((cell, c) => (r === 0 && c === 0 ? ({ kind: 'safe' as const } satisfies CellKnowledge) : cell)),
      ),
    )
    setBreezeHintKeys(new Set())
    setStenchHintKeys(new Set())
    setGlitterHintKeys(new Set())
    setWalkedPathKeys(new Set([keyCoord(w.start)]))
    setLeverAnimating(false)
    setArcadeReady(false)
    setShowStartOverlay(false)
    setFlagMode(false)
    setFlaggedKeys(new Set())
    simStartedAt.current = null
    setLog([
      {
        id: crypto.randomUUID?.() ?? String(Math.random()),
        atMs: Date.now(),
        step: 0,
        kind: 'info',
        text: `Randomized: new world generated. Find the gold (✨).`,
      },
    ])
  }

  function updateHintOverlays(at: Coord, p: Percept) {
    // Permanently reveal "proximity" hints based on percepts seen so far.
    if (showBreezeMap && p.breeze) {
      setBreezeHintKeys((prev) => {
        const next = new Set(prev)
        for (const n of neighbors4(world.rows, world.cols, at)) next.add(keyCoord(n))
        return next
      })
    }
    if (showStenchMap && p.stench) {
      setStenchHintKeys((prev) => {
        const next = new Set(prev)
        for (const n of neighbors4(world.rows, world.cols, at)) next.add(keyCoord(n))
        return next
      })
    }
    if (showGlitterMap && p.glitter) {
      setGlitterHintKeys((prev) => {
        const next = new Set(prev)
        for (const n of neighbors4(world.rows, world.cols, at)) next.add(keyCoord(n))
        return next
      })
    }
  }

  function applyMove(to: Coord, kind: 'manual' | 'simulate') {
    if (status !== 'running') return
    const from = world.agent
    const w2 = moveAgent(world, to)
    setWorld(w2)
    setMoveCount((m) => m + 1)

    const p2 = perceptAt(w2, to)
    const perceptFacts = tellPerceptFacts(to, p2)
    const perceptRules = tellPerceptRules(w2, to)
    const k2 = new KnowledgeBase()
    k2.tell(kb.getCNF())
    k2.tell(perceptFacts)
    k2.tell(perceptRules)
    setKb(k2)
    setPercepts(p2)

    updateHintOverlays(to, p2)

    setWalkedPathKeys((prev) => {
      const next = new Set(prev)
      next.add(keyCoord(to))
      return next
    })

    const nextK = knowledge.map((row) => row.map((x) => ({ ...x } as CellKnowledge)))
    nextK[to.r]![to.c] = { kind: 'safe' }
    // If agent died, reveal the hazard type at the death cell.
    if (isDeathCell(w2, to)) {
      const t = w2.truth[to.r]![to.c]!
      nextK[to.r]![to.c] = { kind: 'hazard', hazard: t.pit ? 'pit' : 'wumpus' }
    }
    setKnowledge(nextK)

    setStepCount((s) => s + 1)
    const stepNum = stepCount + 1
    pushLog({
      step: stepNum,
      kind: 'move',
      text: `${kind === 'manual' ? 'Manual' : 'AI'} move: (${from.r},${from.c}) -> (${to.r},${to.c}) | Percept: Breeze=${p2.breeze ? 1 : 0}, Stench=${p2.stench ? 1 : 0}, Sparkle=${p2.glitter ? 1 : 0}`,
    })

    if (isDeathCell(w2, to)) {
      setStatus('dead')
      if (runEndedAt.current == null) runEndedAt.current = Date.now()
      pushLog({ step: stepNum, kind: 'end', text: 'Agent died (pit or wumpus). Simulation ended.' })
      return
    }
    if (isGoldCell(w2, to)) {
      setStatus('won')
      if (runEndedAt.current == null) runEndedAt.current = Date.now()
      pushLog({ step: stepNum, kind: 'end', text: 'Gold found. Simulation ended.' })
      return
    }
  }

  function stepAgentSim() {
    if (status !== 'running') return

    const neigh = neighbors4(world.rows, world.cols, world.agent).filter((p) => !flaggedKeys.has(keyCoord(p)))
    const candidates = neigh.filter((p) => !world.visited[p.r]![p.c])
    const order = candidates.length ? candidates : neigh

    for (const p of order) {
      // ASK the KB: prove ¬P(p) and ¬W(p) before moving.
      const qPit = kb.askLiteral(L_notP(p.r, p.c))
      const qW = kb.askLiteral(L_notW(p.r, p.c))
      setInferenceSteps((s) => s + qPit.steps + qW.steps)
      if (qPit.entailed && qW.entailed) {
        applyMove(p, 'simulate')
        return
      }
    }

    setStatus('stuck')
    pushLog({ step: stepCount + 1, kind: 'end', text: 'No adjacent cell provably safe by KB. Simulation ended.' })
  }

  function onCoinDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setCredits((c) => Math.min(3, c + 1))
  }

  function startArcadeSimulation() {
    if (credits <= 0 || status !== 'running' || isSimulating) return
    setLeverAnimating(true)
    window.setTimeout(() => {
      setArcadeReady(true)
      setLeverAnimating(false)
      setShowStartOverlay(true)
      pushLog({ step: stepCount, kind: 'info', text: 'Arcade credit ready: lever pulled. Press Simulate to start AI run.' })
      window.setTimeout(() => setShowStartOverlay(false), 700)
    }, 600)
  }

  function startOneSimulationRun() {
    setCredits((c) => Math.max(0, c - 1))
    // Consumes the lever "ready" state: each credit run requires pulling again.
    setArcadeReady(false)
    simStartedAt.current = Date.now()
    runEndedAt.current = null
    setIsSimulating(true)
    pushLog({ step: stepCount, kind: 'info', text: 'Simulation started.' })
  }

  function onClickSimulate() {
    if (status !== 'running' || isSimulating) return
    if (!arcadeReady) {
      pushLog({ step: stepCount, kind: 'info', text: 'Simulate locked: insert coin and pull lever first.' })
      return
    }
    if (credits <= 0) {
      pushLog({ step: stepCount, kind: 'info', text: 'No credits left. Insert up to 3 coins.' })
      return
    }
    startOneSimulationRun()
  }

  function toggleFlagAt(p: Coord) {
    const kk = keyCoord(p)
    setFlaggedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(kk)) next.delete(kk)
      else next.add(kk)
      return next
    })
  }

  function tryManualMove(p: Coord) {
    if (isSimulating) return
    if (status !== 'running') return
    if (flagMode) {
      toggleFlagAt(p)
      return
    }
    if (flaggedKeys.has(keyCoord(p))) return
    const ns = neighbors4(world.rows, world.cols, world.agent)
    if (!ns.some((q) => q.r === p.r && q.c === p.c)) return
    applyMove(p, 'manual')
  }

  function runMs(): number {
    // Only count time during simulation (flagging/idle shouldn't increase it).
    if (simStartedAt.current == null) return 0
    const end = runEndedAt.current ?? (isSimulating ? Date.now() : simStartedAt.current)
    return end - simStartedAt.current
  }

  return (
    <>
      <div className="appFrame">
        <div className="appHeader">
          <div className="appHeaderTitle">Wumpus World — Logic Agent Simulator</div>
        </div>

        <div className="layout">
          <aside className="boxPanel">
            <div className="panelTitle">Legend</div>
            <div className="legendList">
              <div className="legendItem">
                <span className="legendSwatch swRoad" /> Unknown
              </div>
              <div className="legendItem">
                <span className="legendSwatch swSafe" /> Safe (proved)
              </div>
              <div className="legendItem">
                <span className="legendSwatch swHazard" /> Pit = 🕳 | Wumpus = 👾
              </div>
              <div className="legendItem">
                <span className="legendSwatch swAgent" /> Agent
              </div>
              <div className="legendItem">
                <span className="legendSwatch swGold" /> Gold = 💰
              </div>
              <div className="legendItem">
                <span className="legendSwatch swBreeze" /> Breeze hint = 🌪
              </div>
              <div className="legendItem">
                <span className="legendSwatch swStench" /> Stench hint = ☣
              </div>
              <div className="legendItem">
                <span className="legendSwatch swGlitter" /> Sparkle hint = ✨
              </div>
            </div>

            <div className="panelDivider" />

            <div className="panelTitle">Arcade Start</div>
            <div className="arcadeBox">
              <div
                className={`coinSlot ${credits > 0 ? 'active' : ''} ${arcadeReady ? 'ready' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onCoinDrop}
                title="Drop coin here"
              >
                {arcadeReady ? `CREDIT READY (${credits}/3)` : `CREDITS: ${credits}/3`}
              </div>
              <div className="arcadeControls">
                <span className="coinChip" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', 'coin')} title="Drag coin to slot">
                  🪙
                </span>
                <button
                  type="button"
                  className={`leverBtn ${leverAnimating ? 'pulling' : ''}`}
                  onClick={startArcadeSimulation}
                  disabled={credits <= 0 || status !== 'running' || isSimulating}
                >
                  <span className="leverIcon" aria-hidden="true" />
                  LEVER
                </button>
              </div>
            </div>

            <div className="panelDivider" />

            <div className="panelTitle">Flags</div>
            <div className="toggleList">
              <label className="toggleRow">
                <input type="checkbox" checked={flagMode} onChange={(e) => setFlagMode(e.target.checked)} />
                <span>Flag Mode (click cell)</span>
              </label>
              <div className="flagIconRow">
                <span className="flagIcon" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', 'flag')} title="Drag flag onto a cell">
                  🚩
                </span>
                <button type="button" className="winBtn" onClick={() => setFlaggedKeys(new Set())}>
                  Clear Flags
                </button>
              </div>
            </div>

            <div className="panelDivider" />

            <div className="panelTitle">Percept Hints</div>
            <div className="toggleList">
              <label className="toggleRow">
                <input type="checkbox" checked={showBreezeMap} onChange={(e) => setShowBreezeMap(e.target.checked)} />
                <span>Show Breeze proximity</span>
              </label>
              <label className="toggleRow">
                <input type="checkbox" checked={showStenchMap} onChange={(e) => setShowStenchMap(e.target.checked)} />
                <span>Show Stench proximity</span>
              </label>
              <label className="toggleRow">
                <input type="checkbox" checked={showGlitterMap} onChange={(e) => setShowGlitterMap(e.target.checked)} />
                <span>Show Sparkle proximity</span>
              </label>
              <label className="toggleRow">
                <span className="toggleLabel">Scope</span>
                <select value={revealPercepts} onChange={(e) => setRevealPercepts(e.target.value as 'visited' | 'all')}>
                  <option value="visited">Only what you've discovered</option>
                  <option value="all">Reveal all (debug)</option>
                </select>
              </label>
            </div>

            <div className="panelDivider" />

            <div className="panelTitle">Sim Speed</div>
            <div className="speedRow">
              <button
                type="button"
                className={`winBtn ${simSpeed === 'slow' ? 'active' : ''}`}
                onClick={() => setSimSpeed('slow')}
              >
                Slow
              </button>
              <button
                type="button"
                className={`winBtn ${simSpeed === 'norm' ? 'active' : ''}`}
                onClick={() => setSimSpeed('norm')}
              >
                Norm
              </button>
              <button
                type="button"
                className={`winBtn ${simSpeed === 'fast' ? 'active' : ''}`}
                onClick={() => setSimSpeed('fast')}
              >
                Fast
              </button>
            </div>
          </aside>

          <main className="center">
            <div className="gridTitle">Wumpus World</div>
            <div className="gridStage">
              {showStartOverlay && <div className="startOverlay">START!</div>}
              <div className="gridArea">
                <Grid
                  rows={world.rows}
                  cols={world.cols}
                  agent={world.agent}
                  visited={visited}
                  knowledge={knowledge}
                  gold={world.gold}
                  plannedPathKeys={isSimulating ? plannedPathKeys : new Set()}
                  walkedPathKeys={walkedPathKeys}
                  showBreeze={showBreezeMap}
                  showStench={showStenchMap}
                  showGlitter={showGlitterMap}
                  revealPercepts={revealPercepts}
                  breezeHintKeys={breezeHintKeys}
                  stenchHintKeys={stenchHintKeys}
                  glitterHintKeys={glitterHintKeys}
                  perceptMap={perceptMap}
                  flaggedKeys={flaggedKeys}
                  flagsEnabled={status === 'running'}
                  onFlagCell={(p) => toggleFlagAt(p)}
                  onCellClick={tryManualMove}
                />
              </div>
            </div>

            <div className="underGrid">
              <section className="boxPanel">
                <div className="panelTitle">Run Log</div>
                <div className="logBox" role="log" aria-label="Simulation log" ref={logRef}>
                  {log.slice(-160).map((e) => (
                    <div key={e.id} className={`logLine ${e.kind}`}>
                      <span className="logStep">#{e.step}</span>
                      <span className="logText">{e.text}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="boxPanel">
                <div className="panelTitle">End Stats</div>
                <div className="kv">
                  <div className="k">Time:</div>
                  <div className="v">{(runMs() / 1000).toFixed(1)}s</div>
                  <div className="k">Visited:</div>
                  <div className="v">
                    {visited.flat().filter(Boolean).length}/{world.rows * world.cols}
                  </div>
                  <div className="k">Gold:</div>
                  <div className="v">
                    ({world.gold.r},{world.gold.c})
                  </div>
                  <div className="k">Inference:</div>
                  <div className="v">{inferenceSteps}</div>
                </div>
              </section>
            </div>
          </main>

          <aside className="boxPanel">
            <div className="panelTitle">Status</div>
            <div className="kv">
              <div className="k">Mode:</div>
              <div className="v">{isSimulating ? 'SIMULATING' : 'MANUAL'}</div>
              <div className="k">Algorithm:</div>
              <div className="v">Logic + Resolution</div>
              <div className="k">Grid:</div>
              <div className="v">
                {world.rows}×{world.cols}
              </div>
              <div className="k">Seed:</div>
              <div className="v">{seed}</div>
              <div className="k">State:</div>
              <div className="v">{status.toUpperCase()}</div>
              <div className="k">Moves:</div>
              <div className="v">{moveCount}</div>
            </div>

            <div className="panelDivider" />

            <div className="panelTitle">Current Percept</div>
            <div className="chips">
              <span className={`chip ${percepts.breeze ? '' : 'muted'}`}>🌪 Breeze</span>
              <span className={`chip ${percepts.stench ? '' : 'muted'}`}>☣ Stench</span>
              <span className={`chip ${percepts.glitter ? '' : 'muted'}`}>✨ Sparkle</span>
            </div>

            <div className="panelDivider" />

            <div className="panelTitle">Inference</div>
            <div className="bigMetric">{inferenceSteps}</div>
            <div className="smallMuted">Total resolution steps</div>

            <div className="panelDivider" />

            <div className="controls">
              <div className="controlRow">
                <button type="button" className="winBtn" onClick={resetEpisode}>
                  Setup
                </button>
                <button
                  type="button"
                  className="winBtn"
                  onClick={onClickSimulate}
                  disabled={status !== 'running' || isSimulating || credits <= 0 || !arcadeReady}
                >
                  Simulate
                </button>
              </div>
              <div className="controlRow">
                <button type="button" className="winBtn" onClick={() => setIsSimulating(false)} disabled={!isSimulating}>
                  Pause
                </button>
                <button type="button" className="winBtn" onClick={resetSameEpisode}>
                  Reset
                </button>
              </div>
              <div className="controlRow">
                <button type="button" className="winBtn wide" onClick={resetEpisode}>
                  Randomize
                </button>
              </div>
            </div>

            <div className="panelDivider" />

            <div className="panelTitle">Environment</div>
            <div className="formGrid winForm">
              <label>
                <div className="label">Rows</div>
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={rows}
                  onChange={(e) => setRows(Math.max(2, Math.min(12, Number(e.target.value) || 2)))}
                />
              </label>
              <label>
                <div className="label">Cols</div>
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={cols}
                  onChange={(e) => setCols(Math.max(2, Math.min(12, Number(e.target.value) || 2)))}
                />
              </label>
              <label className="span2">
                <div className="label">Pit probability</div>
                <input
                  type="range"
                  min={0}
                  max={0.35}
                  step={0.01}
                  value={pitProb}
                  onChange={(e) => setPitProb(Number(e.target.value))}
                />
              </label>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}

export default App
