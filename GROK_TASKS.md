# GROK SYSTEM CONSOLIDATION TASKS

## ROLE: System Engineering Lead - Technical Execution Specialist

## IMMEDIATE TASK QUEUE

### **TASK 1: Dynasty Algorithm Consolidation**
**Objective:** Eliminate competing dynasty scoring systems, implement compass methodology as primary

**Files to Process:**
- `server/dynastyScoringAlgorithm.ts` (40% Production, 25% Age, 20% Opportunity)
- `server/enhancedDynastyScoringAlgorithm.ts` (40% Production, 35% Opportunity, 20% Age)
- Keep: `server/compassCalculations.ts` (25% equal weighting - PROVEN SYSTEM)

**Actions Required:**
1. Deprecate both dynasty scoring files
2. Extend compass system to QB/TE positions
3. Update all API endpoints to use compass methodology
4. Remove old algorithm imports from routes.ts

### **TASK 2: Duplicate Service Elimination**
**Objective:** Remove redundant data processors and services

**Duplicates to Remove:**
- `modules/wr_ratings_processor.py` (Python CSV processor - keep TypeScript version)
- Choose: `realTimeADPService.ts` OR `cleanADPService.ts` (eliminate one)
- Consolidate: Multiple ranking endpoints into single configurable endpoint

**Actions Required:**
1. Delete redundant Python CSV processor
2. Choose primary ADP service (recommend realTimeADPService.ts)
3. Update imports across codebase
4. Remove unused service references

### **TASK 3: Backup File Integration**
**Objective:** Extract valuable algorithms from backup, integrate into main system

**Source File:** `server/routes-backup-full.ts`

**Algorithms to Extract:**
- Enhanced WR Algorithm (lines 1435-1500)
- Prometheus methodology (lines 2070-2130)
- 2024-weighted analysis (lines 1413-1435)
- Jake Maraia validation (around line 1776)

**Actions Required:**
1. Extract algorithms from backup file
2. Integrate into main routes.ts with compass framework
3. Create algorithm switching capability
4. Delete backup file after extraction

### **TASK 4: API Endpoint Rationalization**
**Objective:** Consolidate multiple ranking endpoints into unified system

**Current Redundant Endpoints:**
- `/api/rankings` (general)
- `/api/rankings/enhanced-wr` (backup only)
- `/api/rankings/prometheus/:position` (backup only)
- `/api/rankings/2024-weighted` (backup only)
- `/api/wr-ratings/rankings` (current active)

**Target Unified Endpoint:**
```
/api/compass/:position?algorithm=default|enhanced|prometheus&source=csv|live
```

**Actions Required:**
1. Create unified compass endpoint
2. Implement algorithm parameter switching
3. Deprecate old endpoints gradually
4. Update frontend to use new endpoint

### **TASK 5: Error Cleanup**
**Objective:** Fix LSP diagnostics and code issues

**Current Issues:**
- 4 LSP diagnostics in `modules/wr_ratings_processor.py`
- Import conflicts from deprecated services
- Type mismatches from algorithm changes

**Actions Required:**
1. Fix Python module diagnostics
2. Update TypeScript types for unified system
3. Resolve import conflicts
4. Test all consolidated endpoints

## EXECUTION PROTOCOL

**Communication Style:** Minimal, technical confirmations only
- "Task 1 acknowledged. Beginning dynasty algorithm consolidation."
- "Algorithm extraction complete. Integrating with compass framework."
- "Endpoint consolidation complete. Testing unified system."

**Quality Standards:**
- Zero breaking changes to frontend
- Maintain all existing functionality
- Preserve authentic data sources
- Follow Flask methodology patterns

**Validation Checklist:**
□ All duplicate files removed
□ Compass system extended to all positions  
□ Unified API endpoint functional
□ Frontend compatibility maintained
□ LSP diagnostics resolved

## HANDOFF TO CLAUDE

After completing consolidation:
1. Document unified system architecture
2. List integration points for frontend updates
3. Provide API endpoint migration guide
4. Flag any architectural decisions requiring strategic input

---

**ACTIVATION:** Ready for Grok to begin systematic execution
**PRIORITY:** High - Foundation for all other improvements
**TIMELINE:** Complete consolidation before frontend integration