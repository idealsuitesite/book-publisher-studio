import type { ProjectDTO } from 'shared-types';
import { unstructuredFinding } from './bookFacts';

/**
 * First-open Proof nudge (MINI_DR_LIVING_PROOF_NUDGE, Option B of LIVING_PROOF_VISIBILITY_SCOPE).
 *
 * On the FIRST open of a HEALTHY project with no saved view, the workspace lands on the Proof once —
 * the author sees their rendered book at the moment "that's my book" lands hardest — then never
 * again. This is the pure decision; the caller (the workspace) does the localStorage I/O and, when
 * this returns true, sets the persisted flag so it fires at most once.
 *
 * Two behaviours this encodes, both load-bearing:
 *  - A returning author's SAVED view always wins — the nudge never pulls them away from where they
 *    work, and a second open resumes their last view, not the Proof again.
 *  - An unhealthy first open (0 chapters / UNSTRUCTURED_MANUSCRIPT) DEFERS: it returns false AND the
 *    caller must NOT set the flag, so the nudge fires on the first HEALTHY open instead — the author
 *    never lands on an empty Proof in place of the actionable "needs review" banner.
 */
export const proofNudgeKey = (id: string): string => `bps.proofNudged.${id}`;

export interface FirstViewContext {
  /** The resume-where-left value, if any. Truthy means a returning author with a remembered view. */
  savedView: string | null;
  /** Whether this project's one-time nudge has already fired (the persisted flag). */
  alreadyNudged: boolean;
  /** Whether the book is in the UNSTRUCTURED_MANUSCRIPT state — unhealthy for a Proof (§4.2). */
  unstructured: boolean;
}

export function shouldNudgeToProof(ctx: FirstViewContext): boolean {
  if (ctx.savedView) return false; // a saved view always wins — never override where they work
  if (ctx.alreadyNudged) return false; // fire at most once
  if (ctx.unstructured) return false; // health guard — defer (caller leaves the flag unset)
  return true;
}

/** Health signal for the nudge: the book will render a real Proof, i.e. it is not UNSTRUCTURED. */
export function isBookRenderable(project: ProjectDTO): boolean {
  return !unstructuredFinding(project.report);
}
