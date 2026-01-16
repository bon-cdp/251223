# GLOQ Floorplan Viewer

Interactive massing tool for multifamily residential buildings. Generates optimized floor plans with perimeter-packed units, environmental data integration, and real-time metrics.

**Live Demo:** https://gloq-floorplan-viewer.web.app

## Features

### Floor Plan Generation
- **Perimeter Packing Algorithm**: Units placed continuously around all 4 sides of the floor plate
- **All units have windows**: Every unit touches an exterior wall
- **Dynamic sizing**: Unit depth calculated to fill space from perimeter to corridor
- **Skinny units for density**: Compact widths (12-22') maximize unit count

### Floor Types
- **Parking (B1)**: Perpendicular stalls with drive aisles, support rooms (trash, fire pump, MPOE, etc.)
- **Ground (L)**: Lobby, leasing office, mail room, fitness, amenities
- **Typical (2-7+)**: Residential units around perimeter, core in center

### Environmental Map View
Search any address and view:
- **Air Quality**: AQI with health recommendations (Google Air Quality API)
- **Weather**: Temperature, humidity, wind, UV index (Open-Meteo API)
- **Pollen**: Grass, tree, weed levels (Google Pollen API)
- **Solar**: Sunshine hours, panel potential (Google Solar API)

## Projects Included

| Project | Floor Plate | Units/Floor | Stories | Total Units |
|---------|-------------|-------------|---------|-------------|
| P1 | 139' x 139' | 19 | 8 | 116 |
| P4 | 155' x 155' | 20 | 10 | 348 |
| P7 | 172' x 172' | 22 | 10 | 429 |
| P9 | 99' x 99' | 14 | 34 | 427 |

## Tech Stack

- **React 18** + TypeScript
- **Vite** for build
- **Leaflet** for maps
- **Firebase Hosting**

## API Costs (Google Maps Platform)

| API | Free Tier | Beyond Free |
|-----|-----------|-------------|
| Air Quality | 100 queries/day | $5 per 1,000 |
| Pollen | 100 queries/day | $5 per 1,000 |
| Solar | 100 queries/day | $5 per 1,000 |
| Geocoding | 100 queries/day | $5 per 1,000 |

**Note**: Weather uses Open-Meteo (free, no API key required).

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Deploy to Firebase
firebase deploy --only hosting

# Regenerate floor plan data
npx tsx scripts/regenerate-outputs.ts
```

## Floor Generation Algorithm

```
┌──────────────────────────────────────────────────┐
│ 3BR │ 2BR │ 1BR │ Studio │ 1BR │ 2BR │ 3BR      │ ← North (7+ units)
├─────┼─────────────────────────────────────┼──────┤
│ 1BR │                                     │ 1BR  │
├─────┤         ┌─────────────┐             ├──────┤
│ 1BR │         │   CORE      │             │ 1BR  │ ← East/West (4+ each)
├─────┤         │ Elev Stair  │             ├──────┤
│ Stu │         │ Trash Mech  │             │ Stu  │
├─────┤         └─────────────┘             ├──────┤
│ 1BR │                                     │ 1BR  │
├─────┼─────────────────────────────────────┼──────┤
│ 3BR │ 2BR │ 1BR │ Studio │ 1BR │ 2BR │ 3BR      │ ← South (7+ units)
└──────────────────────────────────────────────────┘

Key: All units touch exterior wall = windows for everyone!
```

### Unit Dimensions (Compact)
- **Studio**: 12' wide x dynamic depth
- **1BR**: 14' wide x dynamic depth
- **2BR**: 18' wide x dynamic depth
- **3BR**: 22' wide x dynamic depth

Depth is calculated dynamically: `UNIT_DEPTH = halfSide - margin - coreSize/2 - corridorWidth`

## File Structure

```
web-viewer/
├── public/data/           # Pre-computed floor plan JSON
│   ├── p1_building.json   # Building specs
│   ├── p1_output.json     # Generated floor plans
│   └── ...
├── src/
│   ├── components/
│   │   ├── floorplan/     # Floor plan viewer, navigation
│   │   ├── map/           # Environmental map
│   │   ├── panels/        # Metrics, details, legend
│   │   └── toolbar/       # Canvas tools
│   ├── hooks/             # Data loading, floor metrics
│   ├── utils/
│   │   ├── generateFromExtracted.ts  # Floor generation algorithm
│   │   └── environmentalApis.ts      # Google API integrations
│   └── types/             # TypeScript interfaces
└── scripts/
    └── regenerate-outputs.ts  # Rebuild floor plan data
```

## Credits

- Floor plan generation: Claude (Anthropic)
- Environmental APIs: Google Maps Platform
- Weather data: Open-Meteo
- Map tiles: Google Maps

---

Built for GLOQ | Generated with Claude Code
