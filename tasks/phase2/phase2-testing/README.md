# Phase 2 Testing & Verification

## Directory Structure

```
phase2-testing/
├── README.md                    # This file - overview and navigation
├── quick-start.md               # 5-minute smoke test
├── manual/
│   ├── manual-testing-guide.md  # Comprehensive step-by-step manual tests
│   └── test-helpers.ts        # Console utilities for testing
├── integration/
│   └── integration-test-plan.md # End-to-end scenario testing
└── verification/
    └── verification-checklist.md # Component-by-component checklist
```

---

## How to Use This Testing Suite

### 1. Quick Start (5 minutes)
**File**: `quick-start.md`

Run the quick start guide to:
- Verify build works
- Test basic utilities
- Check UI components
- Do visual inspection

**When to use**: First time testing, or after code changes

**Outcome**: Quick pass/fail indicator

---

### 2. Manual Testing (1-2 hours)
**File**: `manual/manual-testing-guide.md`

Run the comprehensive manual testing guide covering:
- Shape generation (5 shapes)
- Corridor routing
- Grid fitting
- Unit growing
- Voronoi partitioning
- Full pipeline integration
- Edge cases
- Performance benchmarks
- Visual verification
- Regression testing

**When to use**: After quick start passes, before feature freeze

**Outcome**: Detailed pass/fail for each test, bug reports

---

### 3. Integration Testing (2-3 hours)
**File**: `integration/integration-test-plan.md`

Run integration scenarios:
- 10 realistic scenarios
- Edge cases and stress tests
- Memory leak detection
- Performance under load

**When to use**: Before release, after all components pass manual tests

**Outcome**: Integration defects, performance metrics

---

### 4. Verification Checklist (1 hour)
**File**: `verification/verification-checklist.md`

Use this checklist to:
- Systematically verify each component
- Track pass/fail status
- Document edge case handling
- Perform regression checks

**When to use**: Throughout development, final QA pass

**Outcome**: Complete verification status, signoff decision

---

## Testing Workflow

### Initial Testing (First Run)

```
1. Quick Start (5 min)
   ↓ Pass?
2. Manual Testing (1-2 hr)
   ↓ All pass?
3. Integration Testing (2-3 hr)
   ↓ All pass?
4. Verification Checklist (1 hr)
   ↓ All pass?
✅ Ready for merge
```

### Regression Testing (After Changes)

```
1. Quick Start (5 min)
   ↓ Pass?
2. Affected Manual Tests (30 min)
   ↓ Pass?
3. Verification Checklist (affected items) (30 min)
   ↓ Pass?
✅ Safe to commit
```

### Release Testing (Before Deploy)

```
1. Quick Start (5 min)
2. Full Manual Testing (1-2 hr)
3. Integration Testing (2-3 hr)
4. Complete Verification Checklist (1 hr)
5. Performance Benchmark (30 min)
6. Cross-Browser Testing (1 hr)
✅ Ready for release
```

---

## Test Coverage Matrix

| Component | Quick Start | Manual | Integration | Verification |
|------------|--------------|---------|--------------|----------------|
| Types | ✓ | ✓ | - | ✓ |
| Clipper Wrapper | - | ✓ | - | ✓ |
| Shape Generation | ✓ | ✓ | ✓ | ✓ |
| Skeleton | ✓ | ✓ | ✓ | ✓ |
| Corridor Router | ✓ | ✓ | ✓ | ✓ |
| MassingGrid | ✓ | ✓ | ✓ | ✓ |
| Grid Operations | - | ✓ | - | ✓ |
| Vectorization | - | ✓ | - | ✓ |
| Unit Grower | - | ✓ | ✓ | ✓ |
| Voronoi Partitioner | - | ✓ | ✓ | ✓ |
| Rectangle Fitter | - | ✓ | ✓ | ✓ |
| Grid Fitting | - | ✓ | ✓ | ✓ |
| UI Components | ✓ | ✓ | ✓ | ✓ |
| Full Pipeline | - | ✓ | ✓ | ✓ |
| Edge Cases | - | ✓ | ✓ | ✓ |
| Performance | - | ✓ | ✓ | ✓ |
| Regression | ✓ | ✓ | - | ✓ |

**Legend**:
- ✓ = Covered in this phase
- - = Not applicable or covered elsewhere

---

## Expected Results

### Success Criteria

#### All Tests Must Pass:
- No TypeScript compilation errors
- No ESLint errors in massing code
- Build completes successfully
- No runtime exceptions
- All units have corridor access
- >90% units have exterior access
- >80% area coverage
- Performance within targets

#### Performance Targets:
- Shape generation: <10ms
- Skeleton computation: <200ms
- Grid creation: <50ms
- Full pipeline: <500ms (medium floor)
- No memory leaks

#### Quality Targets:
- Units are compact (not overly elongated)
- Corridors form continuous network
- Output is visually plausible
- No overlapping units
- All cells 2x2ft (correct resolution)

---

## Reporting Bugs

### Bug Report Template

```markdown
## Bug Title

**Component**: [Shape Generation / Corridor / Grid / Placement / UI]

**Severity**: Critical / High / Medium / Low

**Test Case**: Reference to specific test (e.g., Test 2.3)

### Reproduction Steps
1.
2.
3.

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happened]

### Environment
- Browser: [Chrome/Firefox/Safari/Edge]
- OS: [Mac/Windows/Linux]
- Screen Size: [1920x1080 / other]

### Console Output
```
[Paste any error messages]
```

### Screenshots
[Attach relevant screenshots]

### Additional Context
[Any other relevant information]
```

---

## Test Results Tracking

### Pass Rate Calculator

```
Pass Rate = (Total Tests Passed / Total Tests) × 100

Example:
- Quick Start: 5/5 = 100%
- Manual Tests: 35/40 = 87.5%
- Integration: 8/10 = 80%
- Verification: 95/100 = 95%

Overall Pass Rate: (5+35+8+95) / (5+40+10+100) = 143/155 = 92%
```

### Go/No-Go Decision

| Pass Rate | Decision |
|-----------|----------|
| 95%+ | ✅ GO - Ready for release |
| 90-94% | ⚠️  CAUTION - Minor issues, document known limitations |
| 80-89% | ❌ NO-GO - Fix blockers, re-test |
| <80% | ❌ NO-GO - Major issues, significant rework needed |

---

## Continuous Testing

### During Development

1. Run Quick Start after significant changes
2. Re-run affected manual tests
3. Update verification checklist as you fix items

### Before Each Commit

1. Run `npm run build`
2. Run `npm run lint`
3. Run Quick Start (5 min)
4. Fix any failures

### Before Pull Request

1. Full Manual Testing pass
2. Integration Testing for affected scenarios
3. Complete Verification Checklist
4. Performance benchmark

---

## Automated Testing (Future)

The current testing suite is manual. Consider adding:

1. **Unit Tests** (Jest/Vitest)
   - Test each function in isolation
   - Mock external dependencies
   - Coverage target: >80%

2. **Integration Tests** (Playwright/Cypress)
   - Automated UI interactions
   - Visual regression testing
   - Cross-browser CI

3. **Performance Tests**
   - Benchmark in CI
   - Detect regressions automatically
   - Track trends over time

4. **E2E Tests**
   - Full user workflows
   - Real data scenarios
   - Production-like environment

---

## Contact & Support

### Questions About Testing
- Review the specific test document for detailed instructions
- Check console for error messages
- Verify DevTools is open and correct tab selected

### Issues Found
- Document using bug report template
- Include reproduction steps
- Attach screenshots if relevant

### Test Execution Help
- Each test document includes "How to verify" sections
- Test helpers provide console utilities
- Quick start for 5-minute validation

---

## Version History

| Version | Date | Changes |
|---------|--------|----------|
| 1.0 | 2025-02-05 | Initial testing suite created |

---

**Last Updated**: 2025-02-05
**Maintained By**: Development Team
