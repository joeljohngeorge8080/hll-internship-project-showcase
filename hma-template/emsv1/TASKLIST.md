# Deployment Tasklist — Production Ready

**Target**: Production deployment with Supabase migration and full system working  
**Stakeholders**: All users across all roles (HR/Admin, Finance/CFO, Project Managers)  
**Validation**: Manual browser testing + User acceptance testing (UAT)  
**Last Updated**: 2026-08-30

---

## Phase 1: Identify & Fix Blockers

### 1.1 Audit Current State
- [ ] **Review git status**: Identify all uncommitted changes and untracked files (pycache, docs, logs)
- [ ] **List known issues**: Run through GAPS.md and identify blockers specific to Supabase migration
- [ ] **Check backend database**: Verify Supabase connection, migrations, RLS policies active
- [ ] **Check frontend API**: Verify all backend endpoints responding correctly

### 1.2 Address Known Blockers
- [ ] **Supabase schema vs. localStorage**: Document what data currently lives in localStorage that needs migration
- [ ] **Missing audit log**: `localAudit.js` is 5 hardcoded rows—audit logging write path must be implemented
- [ ] **RLS policies**: Verify Supabase Row Level Security policies are correctly configured for all roles
- [ ] **Backend as source of truth**: Ensure all data reads/writes go through backend, not direct Supabase calls

### 1.3 Clean Working Directory
- [ ] **Commit or stash dirty files**: Decide on pycache, modified service files, etc.
- [ ] **Organize untracked files**: Decide what to add to git vs. .gitignore (docs, logs, migrations)

---

## Phase 2: Supabase Migration

### 2.1 Wire Frontend to Supabase
- [ ] **Identify all localStorage calls**: Grep for `localStorage.setItem`, `localStorage.getItem` across src/
- [ ] **Map services to Supabase tables**: Update service layer (e.g., `localOrgPool.js`, `localExpenses.js`) to call Supabase via backend endpoints instead
- [ ] **Implement missing backend endpoints**: Add REST endpoints for reads/writes that frontend currently does directly
- [ ] **Test data persistence**: Verify data survives page refreshes (not cached in localStorage)

### 2.2 Migrate Core Data
- [ ] **Expense Pools (HR/Admin/Core)**: Verify schema exists, migrate service layer to use Supabase
- [ ] **Project assignments**: Verify `project_assignments` table, update frontend service to call backend
- [ ] **Monthly apportionment**: Ensure `monthly_apportionment` data reads from Supabase, not localStorage
- [ ] **Payment credentials**: Verify `payment_credentials` table exists and is wired correctly
- [ ] **Audit logs**: Implement write path to `audit_logs` table (currently hardcoded mocks)

### 2.3 Verify Data Integrity
- [ ] **Run existing test data**: Import seed data into Supabase, verify calculations (HR health, budget math, forecasting)
- [ ] **Check RLS policies**: Ensure users can only see/edit their own org's data
- [ ] **Test concurrent writes**: Verify Supabase handles simultaneous updates correctly

---

## Phase 3: Feature Validation (Recent Work)

### 3.1 Payments + AWS Billing (codex/review branch)
- [ ] **Browser test sign-in flow**: Does AWS STS federation URL generate correctly? Does it open AWS console?
- [ ] **Test credential storage**: Can users store AWS credentials in Supabase?
- [ ] **Test role-based access**: HR/Admin only can see Payments tab (authorization working)?
- [ ] **Test on multiple roles**: HR user, Admin user, Finance user, CEO

### 3.2 PC/PA EMS + Officer Access (commit a2fe0e7)
- [ ] **Browser test end-to-end**: PO creates project → PA assigns → Core/HR see in EMS pools → monthly apportionment works
- [ ] **Test officer module**: Officers can view assigned projects, update status, etc.
- [ ] **Verify permission checks**: Users see only their assigned projects/pools

### 3.3 Core EMS Flows
- [ ] **Create/edit/delete expenses**: HR can add expense to HR pool, with correct revenue source (HR Revenue, Project Pool, LSGB Revenue, Admin Share)
- [ ] **Budget tracking**: Over-budget warnings appear correctly
- [ ] **Monthly summary**: Monthly apportionment math correct (revenue splits, pool balance)
- [ ] **CEO forecasting**: "Super Forecasting" dashboard shows correct LSGB need, reduction calculator works

---

## Phase 4: Audit & Compliance

### 4.1 Implement Audit Logging
- [ ] **Define audit events**: What actions trigger audit log entries? (expense create, approval, budget change, credential access, AWS signin)
- [ ] **Wire write path**: Every action writes to `audit_logs` table with timestamp, user_id, role, action, table_name, record_id, old_value, new_value
- [ ] **Test audit log**: Verify entries appear in Supabase after user actions

### 4.2 Verify RLS Policies
- [ ] **Test per-role access**: HR sees only HR pool, Admin sees only Admin pool, etc.
- [ ] **Test cross-org isolation**: User from Org A cannot see Org B's data
- [ ] **Test read-only views**: Finance role can read all but not edit (if applicable)
- [ ] **Test AWS credential access**: Only authorized users can see/use payment credentials

### 4.3 Test Authorization Logic
- [ ] **Role-based UI**: Buttons/forms hidden correctly for users without permission
- [ ] **API rejection**: Backend rejects unauthorized requests (even if frontend is bypassed)
- [ ] **Audit trail**: Audit log captures permission denials

---

## Phase 5: Manual Browser Testing

### 5.1 Test All Core Workflows
- [ ] **HR**: Login → Add expense to HR pool → See monthly summary → Verify budget math
- [ ] **Admin**: Login → Add expense to Admin/Core pool → Allocate across projects → Check Admin Share deduction
- [ ] **Finance/CFO**: Login → View CEO dashboard → Check forecasting/LSGB need → Use reverse calculator
- [ ] **Project Manager (Officer)**: Login → View assigned projects → Check budget remaining → See project spending
- [ ] **Payments**: Login (Finance/CFO) → Go to Payments tab → Click AWS Billing → Verify console access

### 5.2 Test Edge Cases
- [ ] **Empty pools**: System doesn't crash when pool has no expenses
- [ ] **Over-budget**: Warning appears, user can proceed or adjust
- [ ] **Month boundary**: Apportionment calculates correctly for first/last day of month
- [ ] **Multi-year data**: System handles data spanning multiple years
- [ ] **High permissions user**: CEO/Admin can see all orgs and all data

### 5.3 Test Backend Integration
- [ ] **Network requests**: All API calls succeed, no 404s or 500s
- [ ] **Data persistence**: Close browser, reopen, data still there (Supabase, not localStorage)
- [ ] **Concurrent requests**: Multiple tabs/users updating simultaneously work correctly
- [ ] **Error handling**: Network errors show user-friendly messages

---

## Phase 6: User Acceptance Testing (UAT)

### 6.1 Schedule UAT Sessions
- [ ] **HR team** (2-3 people, 1 hour): Walk through expense entry, budget alerts, monthly summary
- [ ] **Finance/Admin** (2-3 people, 1 hour): Check forecasting, LSGB calculations, payment credentials
- [ ] **Project Managers** (1-2 people, 1 hour): Verify project assignment, spending view, officer module
- [ ] **CEO/CFO** (1 person, 30 min): Super Forecasting dashboard, reverse calculator, one-click AWS access

### 6.2 UAT Checklist (Each Session)
- [ ] **Data accuracy**: Numbers match expected calculations
- [ ] **Permissions correct**: Users see only their data, no unauthorized access
- [ ] **UI clarity**: Labels/buttons clear, no confusion on what to do
- [ ] **Performance**: System responds quickly, no hangs
- [ ] **Error messages**: If something breaks, error message is helpful

### 6.3 Collect Feedback
- [ ] **Document issues**: Any UI confusion, data errors, missing features
- [ ] **Severity rating**: Critical (blocks use), High (limits functionality), Medium (inconvenient), Low (nice-to-have)
- [ ] **Get sign-off**: Each stakeholder group signs off or lists required fixes

---

## Phase 7: Deployment

### 7.1 Pre-Deployment Checklist
- [ ] **All tests passing**: Playwright/Jest suite (if exists) fully passing
- [ ] **No console errors**: Browser dev tools show no JS errors in UAT flows
- [ ] **Database backed up**: Supabase backup taken before deploy
- [ ] **Environment variables set**: `.env.production` has all AWS_BILLING_*, SUPABASE_* vars
- [ ] **Secrets secured**: No plaintext passwords in code, all in `.env`

### 7.2 Deploy to Staging First
- [ ] **Push branch to remote**: `git push origin codex/review`
- [ ] **Create/merge PR**: Merge all pending branches (Payments, PC/PA EMS, Supabase migration) to staging branch
- [ ] **Deploy staging**: Run staging deployment script (Docker, Vercel, or manual)
- [ ] **Smoke test staging**: Quick manual check that main flows work
- [ ] **Verify logs**: No errors in backend/frontend logs

### 7.3 Deploy to Production
- [ ] **Final stakeholder sign-off**: All UAT groups confirm go/no-go
- [ ] **Schedule maintenance window** (if needed): Notify users of downtime
- [ ] **Deploy production**: Run production deployment script
- [ ] **Monitor for 1 hour**: Watch logs for errors, user reports
- [ ] **Have rollback plan**: Know how to revert if critical issue found
- [ ] **Post-deploy verification**: Test key flows one more time in production

### 7.4 Post-Deployment
- [ ] **Update documentation**: README, handoff notes, deployment guide
- [ ] **Notify users**: Email/Slack announcement of new features (Payments, Supabase migration, etc.)
- [ ] **Monitor for issues**: Watch for bug reports in first 24-48 hours
- [ ] **Archive old code**: Decide what to do with deprecated localStorage services

---

## Blockers & Dependencies

### Critical Path (Must Complete Before Production)
1. **Supabase migration**: All data must live in Supabase, no localStorage
2. **Audit logging**: Write path must exist (currently just mock rows)
3. **RLS verification**: All policies tested and working
4. **Feature validation**: Recent features (Payments, PC/PA EMS) must be browser-tested
5. **UAT sign-off**: All stakeholders must approve

### Nice-to-Have (Can Deploy Without, But Should Track)
- Automated tests (Playwright/Jest)
- Performance optimization
- Enhanced error messages
- Mobile responsive design (if applicable)

---

## Known Issues to Track

From prior sessions:
- `localAudit.js` has only 5 hardcoded mock rows → audit logging write path needed
- All data in localStorage, not backend → Supabase migration needed
- No automated tests anywhere → consider adding for critical paths
- PC/PA EMS + Officer Access (commit a2fe0e7) not yet verified in browser
- Payments feature (codex/review) not yet verified in browser
- No frontend CI → consider adding GitHub Actions for test/build checks

---

## Success Criteria

✅ **Ready for Production When:**
- [ ] Supabase migration complete (all data in DB, no localStorage)
- [ ] All core workflows tested and working (Expense, Project, Payments, Forecasting)
- [ ] Audit logging functional and tested
- [ ] RLS policies verified for all roles
- [ ] All UAT stakeholders sign off
- [ ] No open blockers in issue tracker
- [ ] Logs clean (no critical errors in staging for 24+ hours)

---

## Timeline Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|-----------------|
| **1. Blockers** | Audit, fix, clean | 2-3 hours |
| **2. Supabase** | Wire services, migrate data, test | 4-6 hours |
| **3. Feature Validation** | Browser test Payments, PC/PA, EMS | 2-3 hours |
| **4. Audit & Compliance** | Implement logging, verify RLS | 2-3 hours |
| **5. Manual Testing** | All workflows + edge cases | 4-6 hours |
| **6. UAT** | 4 stakeholder sessions + feedback | 4-5 hours |
| **7. Deployment** | Staging, production, monitoring | 2-3 hours |
| **TOTAL** | | **20-29 hours** |

---

## Next Steps

1. **Confirm blockers**: Audit current state to identify actual blockers (Phase 1.1-1.2)
2. **Prioritize Supabase**: Start wiring frontend services to Supabase (Phase 2.1)
3. **Parallel testing**: While Supabase work happens, browser-test Payments & PC/PA features (Phase 3)
4. **Schedule UAT**: Book time with stakeholders early (Phase 6.1)
