# GLOQ Massing Solver - Monorepo Overview

This is a **sheaf-theoretic building massing solver** monorepo containing a Python backend solver and a React web viewer.

## Repository Structure

```
251223/
├── web-viewer/                # React web viewer (see web-viewer/AGENTS.md)
├── data/                      # Sample PDFs and input data
└── .github/                   # GitHub configuration and Copilot instructions
```

## Projects Overview

| Project                   | Location      | Technology                 | Purpose                       |
| ------------------------- | ------------- | -------------------------- | ----------------------------- |
| **GLOQ Floorplan Viewer** | `web-viewer/` | React 19, TypeScript, Vite | Interactive floor plan editor |

## Core Mathematical Model

The building is modeled as a **sheaf over discrete floor indices**:
- **Patches (FloorPatch)**: Local sections representing each floor with spaces to place
- **Stalks (VerticalStalk)**: Vertical elements (elevators, stairs, shafts) that pierce through floors
- **Gluing constraints**: Ensure vertical alignment across floors via stalk consistency
- **Cohomology**: Measures obstruction to valid placement (0 = perfect solution)

### Mathematical Summary
- **Base Space ($X$)**: The set of discrete floors $\{F_{-1}, F_0, \dots, F_n\}$
- **Sheaf ($F$)**: Assigns valid space configurations to each floor
- **Čech Cohomology**: $H^1(X, F)$ measures vertical misalignment (obstruction)
- **Fuzzy Logic**: Spaces can deviate ±25% from target area with membership function $\mu(A) \in [0,1]$

## Data Flow (End-to-End)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WEB VIEWER                                     │
│  public/data/*.json → useSolverData.ts → FloorPlanViewer.tsx → Canvas  │
│                                    ↓                                     │
│                        types/solverOutput.ts (TypeScript)               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Web Viewer
```bash
cd web-viewer
npm install
npm run dev
```

## Key Conventions

- **Coordinate system**: Center-based rectangles, Y-up, units in feet
- **Rotation**: 0, 90, 180, 270 degrees only (90-degree snap)
- **Placement order**: Vertical stalks → dwelling units → support → MEP
- **Space ID format**: `{category}_{type}_{index}_f{floor}` (e.g., `unit_studio_5_f3`)

## Space Categories

| Category      | Description                        | Floor Assignment        |
| ------------- | ---------------------------------- | ----------------------- |
| `DWELLING`    | Apartments (studio, 1BR, 2BR, 3BR) | Typical floors          |
| `MEP`         | Mechanical/Electrical/Plumbing     | All floors              |
| `CIRCULATION` | Corridors, lobbies                 | All floors              |
| `VERTICAL`    | Elevators, stairs, shafts          | Vertical (spans floors) |
| `RETAIL`      | Ground floor retail                | Ground floor            |
| `AMENITY`     | Shared amenities                   | Ground/typical          |

## Agent-Specific Documentation

- **Web viewer development**: See `web-viewer/AGENTS.md`
- **GitHub Copilot instructions**: See `.github/copilot-instructions.md`

## Example Files

| File                      | Purpose                                   |
| ------------------------- | ----------------------------------------- |
| `web-viewer/public/data/` | Pre-computed floor plans (P1, P4, P7, P9) |

## Development Guidelines

1. **Protocol-based rendering**: Extend existing protocols instead of ad-hoc utilities
2. **Fuzzy scaling**: Built into algorithm; spaces track `membership` score
3. **Constraint violations**: Tracked with magnitude (0 = satisfied)

## Recent Updates

- Polygon editor with undo/redo support
- Space search and filtering
- Collapsible side panels
- Keyboard shortcuts (Escape, arrows, V/E/H/A/M)
- Loading skeleton UI with shimmer animation
- Floor navigation improvements
