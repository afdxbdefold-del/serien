# Pipeline Refactoring - Phase 3 Integration Plan

## Goal
Integrate `content-workflow.ts` and `article-creator.ts` into `pipeline-v1.ts`

## Current State
- **pipeline-v1.ts**: 1524 lines
- **Modules ready**: content-workflow.ts (350 lines), article-creator.ts (217 lines)
- **Already integrated**: post-processors.ts ✅

## Integration Strategy

### Step 1: Integrate content-workflow.ts
**Target Steps in pipeline-v1.ts**:
- Step 4: AI GENERATE (~60 lines)
- Step 5: HEADLINE TRANSLATION / EDITORIAL REWRITE (~40 lines)
- Step 5.5: WAS BEDEUTET DAS (~20 lines) - KEEP IN MAIN (not in module)
- Step 5.6: META DESCRIPTION (~50 lines) - KEEP IN MAIN (not in module)
- Step 5.7: DISCOVER STRUCTURE (~30 lines) - KEEP IN MAIN (not in module)
- Step 6: QUALITY CHECK (~160 lines)
- Step 6.3: FACT SAFETY (~150 lines)
- Step 6.5: ANTI-AI FILTER (~90 lines)
- Step 7: DISCOVER GATE (~140 lines)

**Lines to be replaced**: ~740 lines → ~50 lines (single function call)
**Net reduction**: ~690 lines

### Step 2: Integrate article-creator.ts
**Target Steps in pipeline-v1.ts**:
- Step 8: PUBLISH (~240 lines of database transaction logic)

**Lines to be replaced**: ~240 lines → ~30 lines (single function call)
**Net reduction**: ~210 lines

### Total Expected Result
- **Before**: 1524 lines
- **After**: ~620 lines
- **Reduction**: ~900 lines (-59%)

## Implementation Plan

### Phase 3.1: Integrate content-workflow.ts
1. Add import statement
2. Prepare input data structure
3. Replace Steps 4-7 with runContentWorkflow() call
4. Map result to existing variables
5. Handle edge cases (SKIP, errors)
6. Test with a sample article

### Phase 3.2: Integrate article-creator.ts
1. Add import statement
2. Prepare ArticleCreationData structure
3. Replace Step 8 with createArticle() call
4. Test with a sample article

### Phase 3.3: Testing
1. Run full pipeline with a real article
2. Verify all steps execute correctly
3. Check article is published to database
4. Verify post-processing runs correctly

## Risks & Mitigation

### Risk 1: Module interface mismatch
- **Mitigation**: Carefully map variables between pipeline and modules
- **Rollback**: Git history available

### Risk 2: Missing edge cases
- **Mitigation**: Keep error handling comprehensive
- **Testing**: Test with various article types

### Risk 3: Performance regression
- **Mitigation**: No logic changes, just reorganization
- **Monitoring**: Check pipeline execution time

## Success Criteria
- ✅ Pipeline executes without errors
- ✅ Article is published correctly
- ✅ All quality gates work as before
- ✅ Post-processing runs correctly
- ✅ Code is more maintainable (< 700 lines main file)
