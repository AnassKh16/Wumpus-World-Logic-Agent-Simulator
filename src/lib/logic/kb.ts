import { lit, type Atom, type CNF, type Literal } from './prop'
import { negateLiteralQuery, resolutionEntails } from './resolution'

// Minimal KB for this assignment:
// - Stores CNF clauses directly (we "TELL" by adding CNF).
// - "ASK" is done by resolution refutation.
export class KnowledgeBase {
  private clauses: CNF = []

  tell(cnf: CNF) {
    for (const c of cnf) this.clauses.push(c)
  }

  getCNF(): CNF {
    return this.clauses.slice()
  }

  // ASK if KB ⊨ q (q is a single literal)
  askLiteral(q: Literal): { entailed: boolean; steps: number } {
    const negQ = negateLiteralQuery(q)
    const res = resolutionEntails(this.clauses, negQ)
    return { entailed: res.entailed, steps: res.steps }
  }
}

// Atom naming convention used by the Wumpus project.
export function A_P(r: number, c: number): Atom {
  return `P_${r}_${c}`
}
export function A_W(r: number, c: number): Atom {
  return `W_${r}_${c}`
}
export function A_B(r: number, c: number): Atom {
  return `B_${r}_${c}`
}
export function A_S(r: number, c: number): Atom {
  return `S_${r}_${c}`
}

export function L_P(r: number, c: number): Literal {
  return lit(A_P(r, c), false)
}
export function L_notP(r: number, c: number): Literal {
  return lit(A_P(r, c), true)
}
export function L_W(r: number, c: number): Literal {
  return lit(A_W(r, c), false)
}
export function L_notW(r: number, c: number): Literal {
  return lit(A_W(r, c), true)
}

