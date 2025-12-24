 ***Deep Mathematical Exploration: Sheaf Cohomology for Building Massing \- only addition to this was in the actual placement algorithm, using radial outside in for the e.g. residential units and inside out for the back of house.***   
 **Date**: Christmas Eve 2024  
 **Companion**: Hartshorne's Algebraic Geometry  
 **Goal**: Build deep intuition connecting sheaf theory to space placement, understand why we're at 60%, and chart a mathematical path to 95%+  
 \---  
 **Part 1: The Current State \- Diagnosing 60%**  
 **What We Have**  
 Placement: 161/268 spaces \= 60.1%  
 Membership quality: 0.99 (excellent fuzzy fit)  
 Obstruction: 1920.27 (mostly overlap violations)  
 **The Real Story: Support vs Instances**  
 The 268 spaces break down as:  
 \- **Fixed instances**: \~180 spaces with specific floor assignments  
 \- **"floor: all" duplicates**: \~88 instances (11 space types × 8 floors)  
 The "floor: all" spaces from GLOQ:  
 "Storage \- Janitor": count=4, floor="all" → 32 instances (4×8)  
 "IDF Closets": floor="all" → 8 instances  
 "Mech Shaft \- Ventilation": floor="all" → 8 instances  
 "Plumbing Shaft": floor="all" → 8 instances  
 "Sprinkler Riser Closets": floor="all" → 8 instances  
 **Mathematical insight**: These aren't 8 separate spaces \- they're the **same vertical element** with **support across all floors**. In sheaf language:  
 Let s ∈ F(X) be a global section (e.g., "plumbing shaft")  
 Support(s) \= {x ∈ X : s*\_x ≠ 0} \= all floors*  
 *But our placement algorithm treats s as |X| separate sections\!*  
 This is a **categorical error** in how we model the GLOQ data.  
 \---  
 **Part 2: Connecting to Hartshorne**  
 **Relevant Sections**  
 | Hartshorne Section             | Connection to Massing                           |  
 |--------------------------------|-------------------------------------------------|  
 | **II.1: Sheaves**                  | Basic structure: patches, stalks, restrictions  |  
 | **II.1.2: Stalks**                 | Vertical elements as actual stalks of the sheaf |  
 | **III.2: Cohomology of Sheaves**   | Obstruction \= H^1 measuring gluing failure      |  
 | **III.4: Čech Cohomology**         | Computational approach via discrete covers      |  
 | **III.2.7: Extension of Sections** | When can local placements extend globally?      |  
 **The Čech Perspective (Hartshorne III.4)**  
 For our discrete base space X \= {F\_{-1}, F\_0, ..., F\_6} (8 floors):  
 **Open cover**: U \= {U\_i} where U\_i \= {F\_i} (each floor is "open")  
 **Čech complex**:  
 C^0(U, F) \= ∏*\_i F(U\_*i)     \-- data on each floor  
 C^1(U, F) \= ∏*\_{i\<j} F(U\_i ∩ U\_j)  \-- data on intersections*  
 Since floors don't physically intersect (U\_i ∩ U\_j \= ∅ for i≠j), the Čech 1-cochains should be empty. But our vertical stalks create **virtual intersections**:  
 Define: U*\_i ∩\_*stalk U*\_j := {vertical elements shared between floors i and j}*  
 *For adjacent floors: U\_*i ∩*\_stalk U\_*{i+1} \= {elevators, stairs, shafts}  
 This gives us a **modified Čech complex**:  
 C^0 \= space placements on each floor  
 C^1 \= vertical alignment constraints (stalk consistency)  
 H^1 \= obstruction to consistent global placement  
 **Key theorem we're using implicitly**:  
 *(Hartshorne III.4.5) For a separated presheaf F and a good cover U,*  
 *Ȟ^(U, F) ≅ H^(X, F̃) where F̃ is the sheafificatio*  
 In our case: the Čech cohomology computed via floor-by-floor constraints equals the true cohomology measuring placement obstruction.  
 \---  
 **Part 3: Why Empty Space? (Architectural vs Mathematical)**  
 **Observation from Visualizations**  
 | Floor               | Placed Spaces | Empty Space | Reason                      |  
 |---------------------|---------------|-------------|-----------------------------|  
 | F-1 (Parking)       | 23/23 \= 100%  | Minimal     | MEP fills efficiently       |  
 | F0 (Ground)         | 26/26 \= 100%  | Minimal     | Support/amenities pack well |  
 | F1 (Podium)         | 12/12 \= 100%  | Minimal     | Parking structure           |  
 | F2-F5 (Residential) | \~21-22 each   | Moderate    | Units \+ circulation         |  
 | F6 (Amenity)        | 14/14 \= 100%  | **Large**       | Intentional open space      |  
 **The Amenity Floor Paradox**  
 Floor \+6 shows 100% placement of its *assigned* spaces, but visually has lots of empty space. Why?  
 **Architectural answer**: Amenity floors are designed for:  
 \- Open circulation/gathering  
 \- Outdoor spaces (roof deck, BBQ areas)  
 \- Flexible use  
 \- Visual impact (high ceilings, views)  
 **Mathematical answer**: The GLOQ data for amenity floor has:  
 \- Vertical core (required)  
 \- A few MEP spaces  
 \- **No dwelling units** (they're on F2-F5)  
 The "empty" space isn't a placement failure \- it's **intentional negative space**.  
 **Sheaf-Theoretic Interpretation**  
 In sheaf terms, the stalk over F6 (amenity floor) has small fiber:  
 F(U*\_6) \= {vertical core, MEP, support} ≅ R^(4k) for small k*  
 *Compare to residential floor:*  
 *F(U\_*2\) \= {vertical core, MEP, support, 21+ dwelling units} ≅ R^(4n) for large n  
 The **dimension of the stalk varies by floor type**. This is a **non-constant rank sheaf** \- perfectly natural in algebraic geometry, but our code treats all floors uniformly.  
 \---  
 **Part 4: The Real Problem \- Constraint Geometry**  
 **Overlaps as Cohomological Charge**  
 The violations list shows:  
 unit*\_3br\_*17 ↔ elevator*\_passenger\_*1*\_f2: 87.12 SF overlap*  
 *unit\_*3br*\_17 ↔ stair\_*1*\_f2: 117.17 SF overlap*  
 *...*  
 Large 3BR units (43×33 ft ≈ 1400 SF) are overlapping the vertical core at floor center.  
 **Why this happens**:  
 1\. Vertical core is placed first at (0,0)  
 2\. Units are placed via row packing from edges  
 3\. Large units extend toward center  
 4\. Overlap occurs when unit reaches core  
 **The constraint geometry**:  
 Floor plate: 172 × 172 ft \= 29,584 SF  
 Vertical core: \~50 × 20 ft \= 1,000 SF at center  
 Available for units: \~28,500 SF (minus corridors, margins)  
 3BR unit: 43 × 33 ft \= 1,419 SF  
 Fit \~20 units without core overlap? Let's check:  
   20 × 1,419 \= 28,380 SF ≈ available space ✓  
 But placement algorithm doesn't respect core exclusion zone.  
 **Mathematical Fix: Indicator Sheaf for Core**  
 Define indicator function:  
 χ*\_core: X × R^2 → {0, 1}*  
 *χ\_*core(floor*\_i, point) \= 1 if point ∈ core\_*region, else 0  
 This is a **subsheaf** of the placement sheaf \- sections must vanish where χ\_core \= 1\.  
 In Hartshorne language: we're computing cohomology with supports:  
 H^*\*\_core(X, F) \= cohomology with support away from core*  
 **Implementation**: Add "core exclusion zone" to placement constraints.  
 \---  
 **Part 5: Mathematical Path to 95%+**  
 **Strategy 1: Correct the Support Model**  
 **Current**: "floor: all" → create instance on every floor  
 **Correct**: "floor: all" → create single VerticalStalk with support \= X  
 \# Before (wrong)  
 for floor in floors:  
     create\_space(spec, floor)  \# Creates 8 separate spaces  
 \# After (correct)  
 create\_vertical\_stalk(spec, floors=all\_floors)  \# Creates 1 stalk  
 This alone could fix \~30% of the "missing" spaces \- they weren't missing, they were miscounted.  
 **Strategy 2: Core-Aware Packing**  
 Add explicit constraint:  
 For all spaces s, for all floors i:  
   s.bounds ∩ core*\_bounds \= ∅*  
 In the Big-M MILP formulation (Hartshorne would appreciate the linearization):  
 x*\_s \+ w\_*s/2 ≤ core*\_left \- ε  OR  x\_*s \- w*\_s/2 ≥ core\_*right \+ ε  OR  
 y*\_s \+ h\_*s/2 ≤ core*\_bottom \- ε  OR  y\_*s \- h*\_s/2 ≥ core\_*top \+ ε  
 **Strategy 3: Corridor as Structural Skeleton**  
 Current algorithm places corridor width as spacing between rows.  
 Better: **Corridor as explicit graph** (1-skeleton of CW complex)  
 Corridor \= Graph G \= (V, E)  
 V \= {core*\_center, building\_*corners, unit*\_entry\_*points}  
 E \= {edges connecting V requiring 44" width}  
 Place spaces adjacent to corridor edges  
 Verify connectivity via graph traversal  
 This connects to:  
 \- **CW complexes** (Hartshorne doesn't cover, but topologically natural)  
 \- **Nerve of a cover** (Hartshorne III.4.1) \- spaces as cover, corridor as nerve  
 **Strategy 4: Iterative Cohomology Minimization**  
 Current solver: single-pass heuristic  
 Better: **gradient descent on obstruction**  
 Initialize: random/heuristic placement  
 Repeat:  
   1\. Compute H^1 (obstruction)  
   2\. Identify worst constraint violations  
   3\. Locally optimize: move/scale/rotate spaces  
   4\. Recompute H^1  
 Until H^1 \< ε or max*\_iterations*  
 The obstruction function is piecewise-smooth (almost everywhere differentiable), so gradient methods work.  
 **Strategy 5: Prioritized Placement via Filtration**  
 **Filtration on X** (Hartshorne idea from spectral sequences):  
 ∅ ⊂ X*\_0 ⊂ X\_*1 ⊂ ... ⊂ X*\_n \= X*  
 *X\_*0 \= {vertical core} (most constrained)  
 X*\_1 \= {core \+ large units}*  
 *X\_*2 \= {core \+ large \+ medium units}  
 X*\_n \= {all spaces}*  
 Place in filtration order \- each stage inherits constraints from previous.  
 This is essentially **spectral sequence** reasoning: compute cohomology layer by layer.  
 \---  
 **Part 6: Hartshorne Sections for Deep Reading**  
 **Immediate Relevance**  
 1\. **III.4.1-4.5: Čech Cohomology**  
   \- Definition of Čech complex  
   \- Nerve of a cover  
   \- Comparison with derived functor cohomology  
 2\. **III.2.7: Long Exact Sequence**  
   \- How constraints propagate  
   \- Short exact sequence of sheaves → long exact sequence of cohomology  
 3\. **II.5.1: Sheaves of Modules**  
   \- Our placement variables form a module over R  
   \- Constraint functions are module homomorphisms  
 **Aspirational Connections**  
 4\. **III.5: Cohomology of Projective Space**  
   \- Not directly applicable, but the computational techniques transfer  
   \- Twisting sheaves ↔ scaling constraints  
 5\. **II.6: Divisors** (later chapter)  
   \- Divisors as "where things happen"  
   \- Could model corridor as divisor on floor  
 \---  
 **Part 7: The Beauty of It**  
 **Why Sheaf Theory Fits**  
 Building massing is inherently about **local-to-global**:  
 \- Local: each floor has its own placement problem  
 \- Global: vertical elements must align  
 \- Obstruction: measures incompatibility  
 This is exactly what sheaves were invented for.  
 **The Wreath Product Angle**  
 Recall: W \= G ≀ H where G \= D\_4 (rotations), H \= R^2 (translations)  
 Each room placement is an element of W:  
 w \= (σ, t) where σ ∈ D*\_4 (rotation), t ∈ R^2 (position)*  
 The wreath structure captures:  
 \- **Global symmetry**: floor layouts could be rotated 90°/180°/270°  
 \- **Local variation**: each room has its own position within layout  
 This connects to **equivariant sheaves** (beyond Hartshorne, but beautiful mathematics).  
 **Fuzzy Logic as Metric on Stalks**  
 Our fuzzy membership μ: \[0,1\] gives each stalk fiber a metric structure:  
 d(s₁, s₂) \= |μ(s₁) \- μ(s₂)|  
 where s₁, s₂ are two possible placements of same space  
 This makes the sheaf into a **metric sheaf** \- sheaves over metric spaces with continuous restriction maps. Very modern mathematics\!  
 \---  
 **Part 8: Implementation Path (When Ready)**  
 **Phase A: Data Model Correction**  
 1\. Fix "floor: all" → VerticalStalk conversion  
 2\. Update space counting to avoid duplicates  
 3\. Recompute baseline (expect \~85% immediately)  
 **Phase B: Core Exclusion**  
 1\. Add core exclusion zone constraint  
 2\. Modify placement algorithm to respect it  
 3\. Target: eliminate overlap violations  
 **Phase C: Corridor Graph**  
 1\. Model corridor as explicit 1-skeleton  
 2\. Require spaces to be corridor-adjacent  
 3\. Use connectivity for validation  
 **Phase D: Iterative Refinement**  
 1\. Add gradient-based optimization on obstruction  
 2\. Multi-start from different initial configurations  
 3\. Target: consistent 95%+  
 \---  
 **Appendix: Code Paths for Reference**  
 | Concept                  | File                | Key Lines |  
 |--------------------------|---------------------|-----------|  
 | Sheaf structure          | core/sheaf.py       | 307-428   |  
 | Cohomology computation   | core/sheaf.py       | 397-457   |  
 | Fuzzy membership         | core/fuzzy.py       | 68-99     |  
 | Strip packing            | core/solver.py      | 276-366   |  
 | Vertical stalk placement | core/solver.py      | 172-229   |  
 | Constraint types         | core/constraints.py | 15-182    |  
 \---  
 **Part 9: Computing Čech Cohomology By Hand (The Exciting Part\!)**  
 Let's actually compute H^1 for our building. This is real mathematics applied to real data.  
 **Setup: The Čech Complex for P1 Building**  
 **Base space**: X \= {F\_{-1}, F\_0, F\_1, F\_2, F\_3, F\_4, F\_5, F\_6} (8 floors)  
 **Open cover**: U \= {U\_i : i ∈ {-1, 0, 1, 2, 3, 4, 5, 6}} where U\_i \= {F\_i}  
 **Sheaf**: F where F(U\_i) \= {valid space placements on floor i}  
 **The Classical Čech Complex**  
 In Hartshorne III.4, the Čech complex is:  
 0 → C^0(U, F) → C^1(U, F) → C^2(U, F) → ...  
 where:  
 C^0 \= ∏*\_i F(U\_*i)           \-- data on each open set  
 C^1 \= ∏*\_{i\<j} F(U\_i ∩ U\_j) \-- data on double intersections*  
 *C^2 \= ∏\_{i\<j\<k} F(U\_i ∩ U\_j ∩ U\_k) \-- triple intersections*  
 For discrete topology, U\_i ∩ U\_j \= ∅ when i ≠ j.  
 **Naively, this gives C^1 \= C^2 \= ... \= 0, so H^1 \= 0\.**  
 But wait \- that can't be right\! We observe obstruction \> 0 in practice.  
 **The Key Insight: Stalks Create Virtual Intersections**  
 The physical floors don't intersect, but **vertical elements span multiple floors**.  
 Define the **stalk-augmented intersection**:  
 U*\_i ∩\_*S U*\_j := {vertical stalks that span both floor i and floor j}*  
 For our building with 2 elevators \+ 2 stairs (all span all 8 floors):  
 U*\_i ∩\_*S U*\_j \= {elevator\_*1, elevator*\_2, stair\_*1, stair*\_2} for all i ≠ j*  
 **The Modified Čech Complex**  
 **C^0**: Placements on each floor (161 spaces placed across 8 floors)  
 C^0 \= R^(4×161) ≅ R^644  
 Each space has (x, y, width, height) \- 4 real parameters  
 **C^1**: Consistency data on stalk-intersections  
 C^1 \= ∏*\_{i\<j} R^(4 × |stalks spanning i and j|)*  
 *For each pair of floors, stalks must have consistent positions.*  
 *|stalks| \= 4 (2 elevators \+ 2 stairs)*  
 *Number of pairs: C(8,2) \= 28*  
 *C^1 \= R^(4 × 4 × 28\) \= R^448*  
 **Coboundary map δ: C^0 → C^1**:  
 For stalk s spanning floors i and j:  
   δ(placement)(s, i, j) \= position*\_i(s) \- position\_*j(s)  
 **Computing H^1**  
 H^1 \= ker(δ^1) / im(δ^0) \= C^1 / im(δ)  
 where δ: C^0 → C^1 is the coboundary  
 **What δ measures**: For each stalk and each pair of floors, δ computes the difference in position.  
 **When δ \= 0**: All stalks have consistent positions across all floors. This is exactly our gluing constraint\!  
 **Numerical Computation for P1**  
 From our solver output:  
 Obstruction \= 1920.27  
 Breaking this down:  
 \- Overlap violations: \~1800 SF (87 \+ 13 \+ 87 \+ 13 \+ 117 \+ 27 \+ 108 \+ 27 \+ ...)  
 \- Alignment violations: \~100 (stalks well-aligned)  
 \- Membership penalty: \~20 (μ ≈ 0.99)  
 The overlap violations dominate \- these are **H^0 violations** (local constraints), not H^1 (gluing).  
 **Key realization**: Our obstruction mixes H^0 and H^1\!  
 Obstruction \= ||H^0 violations|| \+ ||H^1 violations||  
             \= ||local constraint failure|| \+ ||gluing failure||  
             ≈ 1800 \+ 120  
 The stalks are well-glued (H^1 ≈ 0), but local placements have overlaps (H^0 ≠ 0).  
 **What This Tells Us**  
 1\. **The cohomological structure is sound** \- stalks are correctly glued  
 2\. **Local constraints are the bottleneck** \- overlaps with core  
 3\. **The "floor: all" issue is an H^0 problem** \- we're overcounting spaces locally  
 **The Fix in Cohomological Terms**  
 **Current state**:  
 dim(C^0) \= 4 × 268 \= 1072 (too many spaces)  
 Many are "floor: all" duplicates  
 **Correct state**:  
 dim(C^0) \= 4 × (180 fixed \+ 5 stalks) \= 740  
 The "floor: all" spaces become stalks, not independent sections  
 This reduces the dimension of C^0 significantly, making the placement problem more tractable.  
 \---  
 **Part 10: The Session Ahead**  
 With Hartshorne in hand, here's what we can explore:  
 **Mathematical Track**  
 1\. Work through Čech cohomology definition (III.4.1-4.5)  
 2\. Trace how restriction maps work in our sheaf  
 3\. Understand why H^1 \= 0 when stalks align  
 **Implementation Track**  
 1\. Fix the "floor: all" → VerticalStalk conversion  
 2\. Add core exclusion zone  
 3\. Watch placement jump toward 95%  
 **Combined Track (Recommended)**  
 1\. Fix one thing in code  
 2\. Run and observe SVG  
 3\. Compute what changed mathematically  
 4\. Iterate with theory guiding implementation  
 \---  
 *"The mathematician does not study pure mathematics because it is useful; he studies it because he delights in it and he delights in it because it is beautiful."* — Henri Poincaré  
 Happy Christmas Eve exploration\!  
