# Wumpus World Logic Agent Simulator

A React + TypeScript web application for **Question 6** (Knowledge-Based Agent).  
The agent explores a Wumpus-style world, receives percepts dynamically, and uses a **Propositional Logic Knowledge Base** with **CNF + Resolution Refutation** to decide safe moves.

## Objective Covered

- Dynamic Wumpus world environment (custom rows/cols, random hazards)
- Percept-driven reasoning (`Breeze`, `Stench`, `Sparkle`)
- KB with `TELL` (new clauses from percepts/rules) and `ASK` (resolution refutation)
- Visual grid + real-time dashboard for percepts and inference steps

## Core Features

- **Dynamic Grid Size**: User controls rows and columns.
- **Dynamic Hazards**:
  - Random pits based on configurable pit probability
  - Exactly one random Wumpus each episode
  - Agent initially does not know hazard locations
- **Percept Generation**:
  - Breeze if adjacent to any pit
  - Stench if adjacent to Wumpus
  - Sparkle when on gold
- **Logic Inference Engine**:
  - Rules encoded in propositional CNF
  - Resolution refutation used to answer `ASK` queries
  - Before AI moves to a candidate cell, it checks entailment of:
    - `¬P(r,c)` and `¬W(r,c)`
- **Web Visualization**:
  - Unknown/unvisited cells
  - Safe/visited cells
  - Hazard-revealed cells (on death reveal)
  - Arcade controls, flagging, path and hint overlays
- **Metrics Dashboard**:
  - Current percept at agent position
  - Total inference steps (resolution operations)

## Tech Stack

- React 19
- TypeScript
- Vite
- Custom propositional logic + resolution implementation

## Project Structure

- `src/App.tsx` — Main UI, simulation loop, agent decisions
- `src/components/Grid.tsx` — Grid rendering and interactions
- `src/lib/wumpus/env.ts` — World generation + percept computation
- `src/lib/wumpus/kbRules.ts` — Wumpus rules encoded into CNF
- `src/lib/logic/prop.ts` — Propositional literals/clauses/CNF utilities
- `src/lib/logic/resolution.ts` — Resolution refutation algorithm
- `src/lib/logic/kb.ts` — KB wrapper (`tell`, `askLiteral`)

## Local Setup

```bash
cd wumpus-logic-agent
npm install
npm run dev
```

Open the shown local URL (usually `http://localhost:5173`).

## Build for Production

```bash
cd wumpus-logic-agent
npm run build
npm run preview
```

## Deployed on Vercel

https://wumpus-logic-agent-seven.vercel.app/

## Output

<img width="856" height="824" alt="image" src="https://github.com/user-attachments/assets/c7f82016-8381-452f-bdb6-4dd248c16c9c" />
