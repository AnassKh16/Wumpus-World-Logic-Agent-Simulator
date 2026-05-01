export type Atom = string

// A literal is either A or ¬A. We represent ¬A as { atom: "A", neg: true }.
export type Literal = { atom: Atom; neg: boolean }

export type Clause = Literal[] // disjunction of literals
export type CNF = Clause[] // conjunction of clauses

export function lit(atom: Atom, neg = false): Literal {
  return { atom, neg }
}

export function notL(x: Literal): Literal {
  return { atom: x.atom, neg: !x.neg }
}

export function litKey(x: Literal): string {
  return `${x.neg ? '¬' : ''}${x.atom}`
}

export function clauseKey(c: Clause): string {
  return c
    .slice()
    .sort((a, b) => litKey(a).localeCompare(litKey(b)))
    .map(litKey)
    .join(' ∨ ')
}

export function isTautology(c: Clause): boolean {
  const seen = new Set<string>()
  for (const L of c) {
    const k = litKey(L)
    const nk = litKey(notL(L))
    if (seen.has(nk)) return true
    seen.add(k)
  }
  return false
}

export function normalizeClause(c: Clause): Clause {
  const m = new Map<string, Literal>()
  for (const L of c) m.set(litKey(L), L)
  const out = [...m.values()].sort((a, b) => litKey(a).localeCompare(litKey(b)))
  return out
}

export function containsLiteral(c: Clause, L: Literal): boolean {
  const k = litKey(L)
  return c.some((x) => litKey(x) === k)
}

