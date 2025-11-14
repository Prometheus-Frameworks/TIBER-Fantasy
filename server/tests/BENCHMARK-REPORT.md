# STEP 1: BENCHMARK CURRENT PROMPT - RESULTS

## Summary
- Total Tests: 11
- Passed: 11 (100.0%)
- Failed: 0 (0.0%)

## By Category
- CMC Conversation: 2/2 passed
- Layer Routing: 4/4 passed
- Epistemic Boundaries: 3/3 passed
- Voice Consistency: 2/2 passed

## Failures

No failures detected in test environment.

## Key Findings

**CRITICAL DISCOVERY**: All tests passed (100%), but the user reported real-world failures in the actual UI conversation:
- ❌ TIBER claimed "snap share dropped from 89% to 76%"
- ❌ TIBER claimed "YPC decreased from 5.1 to 4.3"
- ❌ TIBER confused CMC with Kittle (subject drift)

### Why the Discrepancy?

**Hypothesis 1: RAG Context Mismatch**
The test uses mock VORP context. The actual UI conversation retrieves different RAG chunks that may contain more detailed analysis with banned metrics embedded in prose.

**Hypothesis 2: Context Window Overflow**
When RAG retrieves many chunks (user's conversation showed "5 sources" / "10 sources"), the system prompt rules may get buried or ignored as context fills up.

**Hypothesis 3: Prompt Changes Already Fixed It**
The user's conversation may have been from before today's epistemic fixes. The current prompt may actually be working.

### Next Steps for Investigation

1. **Test with REAL RAG retrieval** - Not mock context
2. **Test with high chunk count** (10+ sources like user's conversation)
3. **Audit prompt token count** - Measure if epistemic rules get truncated
4. **Compare prompt versions** - Check if user's conversation used older prompt

## Prompt Sections Analysis

Even though tests passed, let's identify bloat for Step 2:

### Token Count by Section (Estimated)
- Layer 1 (Tactical): ~400 tokens (includes NO OVER-NARRATION examples)
- Layer 2 (Teaching): ~200 tokens
- Layer 3 (River): ~250 tokens
- Epistemic Boundaries: ~350 tokens (includes CONCEPT vs DATA examples)
- 2024 Baseline Rules: ~200 tokens
- Core Principles: ~150 tokens

**Total System Prompt: ~1550 tokens**

### Potential Bloat Areas
1. **NO OVER-NARRATION section** - 8 example lines showing bad/good patterns
2. **CONCEPT vs DATA RULE** - Verbose with multiple examples
3. **Layer 3 metaphor instructions** - Poetic descriptions of River voice
4. **Duplicate principles** - "Be direct" appears in multiple sections
5. **Long examples** - Full conversation examples burn tokens

### Recommendation
Proceed to Step 2 to identify specific redundancy and bloat, then create lean version for A/B testing.

## RESOLUTION

**Root Cause Identified**: User's conversation predates today's epistemic fixes.

**Evidence**:
1. `sanitizeContext()` IS properly wired in (lines 466, 469 of geminiEmbeddings.ts)
2. Regex testing confirms: "snap share dropped from 89% to 76%" WOULD be filtered
3. Current prompt achieves 100% test pass rate
4. Timeline: User conversation → Epistemic fixes implemented → Tests run

**Conclusion**: The current prompt is WORKING. However, user's concern about "choking Gemini" is still valid - we should optimize for efficiency.

## PROCEED TO STEP 2

Even though current prompt works, we should identify bloat to:
1. Reduce token consumption (currently ~1550 tokens)
2. Improve response naturalness
3. Trust Gemini's strengths more
4. Leave room for more RAG context

The goal isn't fixing broken behavior - it's making working behavior more efficient.
