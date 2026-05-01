import { clauseKey, containsLiteral, isTautology, litKey, normalizeClause, notL, type Clause, type CNF, type Literal } from './prop'

export type ResolutionResult =
  | { entailed: true; steps: number }
  | { entailed: false; steps: number }

function resolvents(ci: Clause, cj: Clause): Clause[] {
  const out: Clause[] = []
  for (const L of ci) {
    const nL = notL(L)
    if (!containsLiteral(cj, nL)) continue
    // (ci \ {L}) ∪ (cj \ {¬L})
    const res: Clause = []
    for (const x of ci) if (litKey(x) !== litKey(L)) res.push(x)
    for (const y of cj) if (litKey(y) !== litKey(nL)) res.push(y)
    const norm = normalizeClause(res)
    if (isTautology(norm)) continue
    out.push(norm)
  }
  return out
}

// Resolution refutation: KB ⊨ alpha iff KB ∧ ¬alpha is unsatisfiable
export function resolutionEntails(kb: CNF, alpha: CNF): ResolutionResult {
  // We expect alpha already in CNF; we negate it externally in the caller
  // by passing (¬alpha) as CNF clauses to add.
  let steps = 0
  const clauses: Clause[] = [...kb.map(normalizeClause), ...alpha.map(normalizeClause)].filter((c) => c.length > 0)

  const clauseSet = new Map<string, Clause>()
  for (const c of clauses) clauseSet.set(clauseKey(c), c)

  // Worklist pairs are quadratic; keep it simple (grid is small).
  let changed = true
  while (changed) {
    changed = false
    const all = [...clauseSet.values()]
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const ci = all[i]!
        const cj = all[j]!
        const rs = resolvents(ci, cj)
        for (const r of rs) {
          steps++
          if (r.length === 0) return { entailed: true, steps } // derived empty clause
          const k = clauseKey(r)
          if (!clauseSet.has(k)) {
            clauseSet.set(k, r)
            changed = true
          }
        }
      }
    }
  }
  return { entailed: false, steps }
}

// Negation helper for a *single* literal query like A or ¬A (used in this project).
export function negateLiteralQuery(q: Literal): CNF {
  return [[notL(q)]]
}

