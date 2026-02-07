                                                                                                                                                                                                                                                                           
  ┌─────────────────────────────────────────────────────────────────────────┐                                                                                                                                                                                                 
  │                        GENERATION FLOW                                   │                                                                                                                                                                                                
  └─────────────────────────────────────────────────────────────────────────┘                                                                                                                                                                                                 
                                                                                                                                                                                                                                                                              
  INPUT (Building Specs):                                                                                                                                                                                                                                                     
    web-viewer/public/data/                                                                                                                                                                                                                                                   
    ├── p1_building.json    ← Building specs (units, floors, parking, etc.)                                                                                                                                                                                                   
    ├── p4_building.json                                                                                                                                                                                                                                                      
    ├── p7_building.json                                                                                                                                                                                                                                                      
    └── p9_building.json                                                                                                                                                                                                                                                      
                                                                                                                                                                                                                                                                              
                      ↓ (read by)                                                                                                                                                                                                                                             
                                                                                                                                                                                                                                                                              
  GENERATION ALGORITHM:                                                                                                                                                                                                                                                       
    web-viewer/src/utils/generateFromExtracted.ts   ← ⭐ THE KEY FILE                                                                                                                                                                                                         
    └── generateSolverResultFromExtracted()         ← Main function                                                                                                                                                                                                           
        ├── generateParkingFloor()                  ← Parking layout                                                                                                                                                                                                          
        ├── generateGroundFloor()                   ← Lobby, amenities                                                                                                                                                                                                        
        └── generateResidentialFloor()              ← Unit packing                                                                                                                                                                                                            
                                                                                                                                                                                                                                                                              
                      ↓ (called by)                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                              
  REGENERATION SCRIPT:                                                                                                                                                                                                                                                        
    web-viewer/scripts/regenerate-outputs.ts        ← Runs generation                                                                                                                                                                                                         
    └── Run with: npx tsx scripts/regenerate-outputs.ts                                                                                                                                                                                                                       
                                                                                                                                                                                                                                                                              
                      ↓ (outputs)                                                                                                                                                                                                                                             
                                                                                                                                                                                                                                                                              
  OUTPUT (Floor Plans):                                                                                                                                                                                                                                                       
    web-viewer/public/data/                                                                                                                                                                                                                                                   
    ├── p1_output.json      ← Generated floor plans with placed spaces                                                                                                                                                                                                        
    ├── p4_output.json                                                                                                                                                                                                                                                        
    ├── p7_output.json                                                                                                                                                                                                                                                        
    └── p9_output.json                                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                                                              
  ┌─────────────────────────────────────────────────────────────────────────┐                                                                                                                                                                                                 
  │                         VIEWING FLOW                                     │                                                                                                                                                                                                
  └─────────────────────────────────────────────────────────────────────────┘                                                                                                                                                                                                 
                                                                                                                                                                                                                                                                              
    web-viewer/src/hooks/useSolverData.ts           ← Loads *_output.json                                                                                                                                                                                                     
                      ↓                                                                                                                                                                                                                                                       
    web-viewer/src/App.tsx                          ← Main app coordinator                                                                                                                                                                                                    
                      ↓                                                                                                                                                                                                                                                       
    web-viewer/src/components/floorplan/                                                                                                                                                                                                                                      
    ├── EditableFloorPlanViewer.tsx                 ← SVG canvas renderer                                                                                                                                                                                                     
    ├── FloorNavigation.tsx                         ← Floor selector                                                                                                                                                                                                          
    └── FloorPlanViewer.tsx                         ← Read-only viewer                                                                                                                                                                                                        
                                                                                                                                                                                                                                                                              
  Summary - Only these matter for your plan:                                                                                                                                                                                                                                  
  ┌──────────────────────┬──────────────────────────────────────────────────────┐                                                                                                                                                                                             
  │       Purpose        │                         File                         │                                                                                                                                                                                             
  ├──────────────────────┼──────────────────────────────────────────────────────┤                                                                                                                                                                                             
  │ Generation algorithm │ src/utils/generateFromExtracted.ts                   │                                                                                                                                                                                             
  ├──────────────────────┼──────────────────────────────────────────────────────┤                                                                                                                                                                                             
  │ Run generation       │ scripts/regenerate-outputs.ts                        │                                                                                                                                                                                             
  ├──────────────────────┼──────────────────────────────────────────────────────┤                                                                                                                                                                                             
  │ Building inputs      │ public/data/p*_building.json                         │                                                                                                                                                                                             
  ├──────────────────────┼──────────────────────────────────────────────────────┤                                                                                                                                                                                             
  │ Generated outputs    │ public/data/p*_output.json                           │                                                                                                                                                                                             
  ├──────────────────────┼──────────────────────────────────────────────────────┤                                                                                                                                                                                             
  │ Viewer entry         │ src/App.tsx                                          │                                                                                                                                                                                             
  ├──────────────────────┼──────────────────────────────────────────────────────┤                                                                                                                                                                                             
  │ Canvas rendering     │ src/components/floorplan/EditableFloorPlanViewer.tsx │                                                                                                                                                                                             
  └──────────────────────┴──────────────────────────────────────────────────────┘                                                                                                                                                                                             
  To update generation and view:
  cd web-viewer
  # 1. Edit src/utils/generateFromExtracted.ts
  # 2. Regenerate outputs
  npx tsx scripts/regenerate-outputs.ts
  # 3. Build (copies public/ into dist/)
  npm run build
  # 4. Deploy
  npx firebase deploy --only hosting
  ⚠️  ORDER MATTERS: regenerate BEFORE build. Vite copies public/ → dist/ at build time.


  ┌─────────────────────────────────────────────────────────────────────────┐
  │                   MASSING SOLVER ASSUMPTIONS                            │
  └─────────────────────────────────────────────────────────────────────────┘

  1. COORDINATE SYSTEM
     - Center-origin: (0,0) is the center of every floor plate
     - All spaces use this coordinate system
     - Boundary polygon is centered so its centroid = (0,0)

  2. PARCEL GEOMETRY
     - Real parcel shapes from GeoJSON coordinates (hardcoded for P1, P4, P7, P9)
     - Converted from lat/lng to feet using LA-area constants:
         FT_PER_DEG_LNG = 288,200    FT_PER_DEG_LAT = 364,000
     - Scaled to match building's floor_plate_sf from the building JSON
     - 3-foot inset applied for setbacks before floor generation
     - Irregular parcels (>4 vertices) use radial slice algorithm
     - Near-rectangular parcels (4 vertices) use perimeter packing algorithm

  3. CORE LAYOUT
     - 2-column compact core centered at origin
     - Column width = max(stair width, elevator width) = 10 ft
     - Column gap = 1 ft, row gap = 1 ft
     - Stair dimensions: 10 ft × 12 ft (industry standard)
     - Elevator dimensions: 8 ft × 8 ft (industry standard)
     - Stairs capped at 2, elevators capped at 3 (from building JSON)
     - Core appears on EVERY floor (parking through residential)

  4. CORRIDOR / O-RING
     - 5 ft wide corridor ring surrounds core on all sides
     - Corridor is IMPLICIT — not rendered as a visible space
     - The gap between units and core IS the corridor
     - Corridor ring defines the inner boundary for unit ray-casting

  5. RESIDENTIAL FLOORS — RADIAL SLICE (irregular parcels)
     - Units are trapezoidal/polygonal slices from boundary to corridor ring
     - Cut points placed along boundary perimeter, spaced by unit frontage
     - Frontage widths: Studio=16', 1BR=20', 2BR=28', 3BR=34'
     - Frontages scaled uniformly so total equals boundary perimeter
     - Cut points snapped to nearby boundary vertices (within 1 ft)
     - Rays cast from each cut point toward origin, intersecting corridor ring
     - Inner edge follows corridor ring (with shortest-path corner walking)
     - Units span FULL DEPTH from boundary to ring (no depth adjustment)
     - Gap filling: after placement, each unit extended to meet its neighbor,
       eliminating wedge-shaped gaps between units
     - Units with area < 200 SF or any edge < 2 ft are rejected as degenerate
     - Every unit's outer wall IS the building boundary (guaranteed windows)

  6. RESIDENTIAL FLOORS — PERIMETER PACKING (rectangular parcels)
     - Units placed as rectangles around perimeter: N → E → S → W
     - Compact widths: Studio=12', 1BR=14', 2BR=18', 3BR=22'
     - Depth computed from corridor outer edge to property setback
     - North/South depth differs from East/West (rectangular core)
     - Collision detection against core + support rooms
     - Support rooms placed at corridor ring corners

  7. SUPPORT ROOMS (residential floors)
     - 4 rooms: Trash, Mech, Stor, Elec (5 ft × 5 ft each)
     - Placed at the 4 dead corners of the O-ring corridor
     - Inside the ring, not in the unit zone
     - No overlap with radial slice units

  8. PARKING FLOORS (B levels)
     - Double-loaded layout: max 2 rows deep per aisle side
     - Cars can only access from front or back (no 3+ deep stacking)
     - Stall dimensions: 9 ft wide × 18 ft deep (scaled for polygon)
     - Drive aisle: 24 ft wide (implicit — not rendered)
     - 4 row positions: inner-N, inner-S, outer-N, outer-S
     - Support rooms: Storage, Trash/Recycle, Fan Room, Fire Pump,
       Domestic Water, MPOE (scaled for tight polygons)
     - Grid-scan placement for irregular polygon boundaries

  9. GROUND FLOOR
     - Lobby, Leasing, Mail/Package, Lounge, Fitness, Restrooms,
       Trash, Bike Storage, and 2 optional dwelling units
     - Corridor footprint reserved for collision detection (implicit)
     - Room sizes scaled down for tight irregular polygons
     - Grid-scan placement with polygon containment check

  10. MAP VIEW
      - Floor spaces rendered as Leaflet polygon overlays
      - Feet-to-lat/lng transform accounts for:
          GeoJSON → scale to area → 3ft inset → re-center offset
      - Parcel outline shown at 0.3px stroke, hidden when spaces visible
      - Dynamic legend shows active space types

  11. UNIT COUNTS & DISTRIBUTION
      - Total units from building JSON, divided evenly across residential floors
      - Units per floor = ceil(total_units / residential_floors)
      - Unit types cycled from the dwelling_units array
      - Actual placed count may be less than target due to degenerate geometry
      - Area deviation tracked per unit (actual vs target from building JSON)

  12. GENERAL
      - This is a MASSING STUDY, not construction documents
      - Area deviations are expected and acceptable
      - Overlap detection uses bounding-box intersection for rect spaces
        and polygon-area checks for polygon spaces
      - No structural, MEP, or code-compliance validation is performed