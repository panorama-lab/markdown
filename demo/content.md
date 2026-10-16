---
title: Keeping Review Close to the Text
authors:
  - name: Panorama Markdown Team
    affiliation: Panorama Lab
abstract: |
  Academic drafts combine an evolving argument with a conversation about how
  that argument should change. This demonstration paper proposes a lightweight
  workflow that keeps prose, suggested edits, and review discussions in one
  readable Markdown document. It outlines design principles and an evaluation
  plan; it does not report an empirical study.
keywords:
  - academic writing
  - collaborative review
  - Markdown
comments:
  c-scope:
    by: Reviewer
    at: "2026-10-16T01:00:00.000Z"
    body: Could we distinguish readability in a text editor from usability in a visual editor?
  c-scope-reply:
    re: c-scope
    by: Author
    at: "2026-10-16T01:10:00.000Z"
    body: Agreed. The evaluation plan now treats those as separate questions.
  c-scope-followup:
    re: c-scope-reply
    by: Reviewer
    at: "2026-10-16T01:20:00.000Z"
    body: That distinction works. Please keep both questions in the study protocol.
  s-claim:
    by: Reviewer
    at: "2026-10-16T01:02:00.000Z"
    body: Narrow the claim because this paper describes a proposal rather than measured outcomes.
  s-context:
    by: Editor
    at: "2026-10-16T01:03:00.000Z"
    body: Explain why attaching a discussion to the exact passage is useful.
  s-redundancy:
    by: Editor
    at: "2026-10-16T01:04:00.000Z"
    body: Remove this sentence because it repeats the preceding paragraph without adding a mechanism.
  c-evaluation:
    by: Reviewer
    at: "2026-10-16T01:05:00.000Z"
    body: Define a resolved issue before collecting this measure. A decision can be recorded even when the suggestion is rejected.
  s-limit:
    by: Reviewer
    at: "2026-10-16T01:06:00.000Z"
    body: Include a concrete limitation of storing annotations directly in the source.
---

# Introduction {#introduction}

A research draft contains more than its current prose. Authors also need to preserve proposed changes, questions about evidence, and decisions made during revision. When those discussions live elsewhere, a reader must reconstruct which passage each message refers to.

Keeping review close to the text :delete[guarantees better collaboration]{#s-claim}:insert[may reduce the effort of reconnecting feedback with its context]{#s-claim}. This paper describes a workflow for exploring that possibility. It is a format demonstration, and all review conversations here are illustrative.

Our design goal is :comment[a paper that remains readable while its review history is visible]{#c-scope}. A plain text reader should be able to identify the original wording and the proposed change; a visual editor should make the same distinction easy to inspect and act on.

# A Reviewable Document {#workflow}

The document combines three layers: the argument itself, inline anchors for review, and metadata describing each discussion. Stable identifiers connect an annotated passage to its author, message, and replies. :insert[An anchored discussion lets a reviewer explain a proposed change beside the passage that motivated it.]{#s-context}

An insertion proposes new wording. A deletion marks wording that could be removed. An adjacent deletion and insertion express a replacement, so the reviewer can explain both halves in one thread. A comment raises a question without changing the passage.

:delete[These review features make it possible to review the document.]{#s-redundancy}

## Revision cycle

1. Read the draft and identify a passage that needs attention.
2. Propose a focused edit or attach a question to the original wording.
3. Discuss the proposal in its thread, preserving the reason for the decision.
4. Accept or reject the suggested edit, then reread the surrounding paragraph.

A rejected suggestion can still be useful: its explanation may clarify a constraint that future reviewers would otherwise rediscover. The workflow should therefore distinguish deciding on wording from answering the broader question behind it.

# Evaluation Plan {#evaluation}

A future study could compare a draft reviewed with inline discussions against a draft reviewed with a separate feedback document. Both conditions would use the same revision tasks and comparable passages. Task order should be counterbalanced to reduce practice effects.

The evaluation would examine:

- Time spent locating the passage associated with each review message.
- Accuracy when identifying original and proposed wording in a text editor.
- Ease of inspecting and deciding on suggestions in a visual editor.
- The proportion of :comment[issues with a recorded decision]{#c-evaluation} at the end of a revision session.

Participants should explain their decisions during a follow-up interview. A fast revision is not necessarily a careful one, so completion time should be interpreted alongside comprehension and the reasons participants give for accepting or rejecting edits.

No participant data have been collected for this demonstration. The measures above are a proposed protocol, not reported results.

# Limitations {#limitations}

Inline annotations can become distracting when many reviewers edit the same paragraph. :insert[Moving or rewriting an annotated passage can also make an existing discussion refer to wording that no longer captures its original context.]{#s-limit} An editor should help readers inspect the surrounding passage before acting on a suggestion.

The protocol in :ref[Evaluation Plan]{#evaluation} would test a small part of collaborative writing. It would not establish whether this workflow improves the quality of a published paper or works equally well for every discipline.

# Conclusion

A reviewable paper can keep its argument and the conversation about that argument in one place. The workflow in :ref[A Reviewable Document]{#workflow} offers a concrete starting point: focused edits, anchored questions, and replies that explain revision decisions. Its practical value remains a question for evaluation.
