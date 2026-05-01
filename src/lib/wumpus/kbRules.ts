import { lit, type CNF, type Literal } from '../logic/prop'
import { A_B, A_P, A_S, A_W } from '../logic/kb'
import { neighbors4, type Coord, type Percept, type WorldState } from './types'

function cnfAnd(...parts: CNF[]): CNF {
  return parts.flat()
}

// Encode X ↔ (Y1 ∨ ... ∨ Yk) in CNF:
// (¬X ∨ Y1 ∨ ... ∨ Yk) ∧ (X ∨ ¬Y1) ∧ ... ∧ (X ∨ ¬Yk)
function equivToOr(x: Literal, ys: Literal[]): CNF {
  const cnf: CNF = []
  cnf.push([lit(x.atom, !x.neg), ...ys]) // ¬x ∨ ys... (note: x is a literal, but we use its atom)
  for (const y of ys) cnf.push([x, lit(y.atom, !y.neg)])
  return cnf
}

export function tellStartSafe(): CNF {
  return [[lit(A_P(0, 0), true)], [lit(A_W(0, 0), true)]]
}

export function tellPerceptFacts(at: Coord, percept: Percept): CNF {
  const B = lit(A_B(at.r, at.c), false)
  const S = lit(A_S(at.r, at.c), false)
  const cnf: CNF = []
  cnf.push([percept.breeze ? B : lit(B.atom, true)])
  cnf.push([percept.stench ? S : lit(S.atom, true)])
  return cnf
}

export function tellPerceptRules(world: WorldState, at: Coord): CNF {
  const neigh = neighbors4(world.rows, world.cols, at)
  const B = lit(A_B(at.r, at.c), false)
  const S = lit(A_S(at.r, at.c), false)
  const pitAdj = neigh.map((q) => lit(A_P(q.r, q.c), false))
  const wAdj = neigh.map((q) => lit(A_W(q.r, q.c), false))
  return cnfAnd(equivToOr(B, pitAdj), equivToOr(S, wAdj))
}

