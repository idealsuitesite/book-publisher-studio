import { InMemoryProjectRepository } from './InMemoryProjectRepository';
import { describeProjectRepositoryContract } from '../../test-utils/projectRepositoryContract';

// The behavioural contract lives in ONE place and runs against every implementation
// (PERSISTENCE.md §6). This file's twenty-odd hand-written tests moved there the day a second
// implementation appeared — two divergent test suites would have let the port drift.
describeProjectRepositoryContract('InMemoryProjectRepository', () => new InMemoryProjectRepository());
