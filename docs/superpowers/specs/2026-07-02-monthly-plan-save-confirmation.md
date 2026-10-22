# Monthly Plan Save Confirmation Button — Design Spec

**Date:** 2026-07-02
**Module:** PMS Project Detail — Monthly Plan tab (`MonthlyPlanPanel.jsx`)
**Status:** Approved by user

## Context

The Monthly Plan table (`PlanTable` in `hma-template/emsv1/src/modules/pms/project-associate/MonthlyPlanPanel.jsx`) already persists every phase-amount edit immediately via `localProjects.updateMonthPlan` on each `onChange`. The user asked for a "Save" button. Confirmed via discussion: this should not change the existing live-save data flow — it's purely a visible confirmation that reassures the Project Officer their edits are saved, nothing more.

## Design

Add a **"💾 Save Monthly Plan"** `CButton` to `PlanTable`'s `CCardHeader`, alongside the existing balance badge (`Balanced — X` / `Off by X`). On click, it sets a local `saved` boolean state to `true` and shows a `CAlert` ("✓ Monthly plan saved") for ~3 seconds (via `setTimeout` clearing the state), then auto-hides. This mirrors the existing `error`/`CAlert` pattern already used in `BlockPlanner` in the same file — same component, same conventions, no new dependencies.

No new props, no new service functions, no change to `updateMonthPlan` or any other persistence logic. This is a pure UI addition confined to `PlanTable`.

## Out of scope

- Any change to when/how edits actually persist (explicitly rejected — live-save stays as-is).
- Any prop threading to `ProjectDetailPage.jsx` — the confirmation is self-contained within `PlanTable`.
