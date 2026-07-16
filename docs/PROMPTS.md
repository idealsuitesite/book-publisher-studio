# Useful Prompts

These prompts have proven effective for development.

---

## Session Start (Always Use This)
See [docs/START_HERE.md](START_HERE.md) for the reading order. Read those files before answering anything, then summarize:

Current architecture
Current sprint status
Current task
Remaining work
Risks
Next recommended action

Do not write code until you have completed this review.
---

## Code Review Checklist
Before implementing anything, verify:

 Does this violate Clean Architecture?
 Does this expose Domain objects?
 Does this break Dependency Inversion?
 Are all dependencies injected?
 Is this testable?
 Are there tests?
 Do all tests pass?
 Does this follow SOLID?
 Is TypeScript strict?
 Is there technical debt?
 ---

## Architecture Review
Verify these principles:

Domain has ZERO external dependencies
Application depends only on interfaces
Infrastructure implements interfaces
Presentation depends on Application
No circular dependencies
All DTOs are independent of Domain
Use Cases are pure orchestration
Mappers convert Domain → DTO only
Controllers are thin
All tests pass
---

## Refactoring Prompt
Before refactoring, consider:

Does the current code work?
Are all tests passing?
Is this refactoring necessary?
What's the minimal change?
Will tests still pass?
Does this reduce technical debt?
Does this improve readability?
Does this violate SOLID?
---

## Bug Fixing Prompt
To fix a bug:

Write a failing test that reproduces it
Verify test fails
Make minimal change to pass test
Verify test passes
Verify no regressions (run all tests)
Update CURRENT_STATE.md
Commit with clear message
---

## Feature Implementation
To implement a feature:

Review ARCHITECTURE.md
Identify which layer it belongs to
Design interfaces first
Write tests for behavior
Implement minimal solution
Verify all tests pass
Update documentation
Commit and push
---

## Testing Strategies

### Unit Test Template (Domain)

```typescript
describe('FeatureName', () => {
  it('should do X when Y', () => {
    const input = { /* ... */ };
    const result = function(input);
    expect(result).toBe(expected);
  });
});
```

### Integration Test Template (Application)

```typescript
describe('UseCase', () => {
  let useCase: UseCase;
  let dependency: Interface;

  beforeEach(() => {
    dependency = createMock();
    useCase = new UseCase(dependency);
  });

  it('should orchestrate correctly', async () => {
    const response = await useCase.execute(request);
    expect(response.success).toBe(true);
  });
});
```

### E2E Test Template (Presentation)

```typescript
describe('POST /api/endpoint', () => {
  it('should return 200 on success', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send(testData)
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
```

---

## Debugging Prompt
If something breaks:

Read the error message carefully
Run tests to identify which test fails
Check CURRENT_STATE.md for context
Review the last commit
Isolate the problem to one component
Add a test that reproduces it
Fix the test
Verify no regressions
---

## Documentation Update
After every session:

 Update docs/CURRENT_STATE.md

Update last edited time
Update sprint status
Update test counts


 Update docs/TODO.md

Mark completed items
Add new items if needed


 Update docs/ROADMAP.md if timeline changed
 Commit with message:
"Phase X, Sprint Y: [description]"


