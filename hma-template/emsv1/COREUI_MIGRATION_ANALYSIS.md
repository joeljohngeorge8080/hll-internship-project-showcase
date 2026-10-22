np# HMA EMS - CoreUI Migration Analysis & Action Plan

**Date:** June 11, 2026  
**Status:** Final Analysis for Implementation  
**Scope:** CoreUI React Admin Template → HMA EMS Production Architecture

---

## Executive Summary

The CoreUI template contains **40-50% reusable code** and **50-60% demo/showcase content** that must be removed.

- **Deletable:** All component showcase pages, demo routes, and example-only views
- **Reusable:** Layout shell, sidebar, header, footer, breadcrumb, form controls, table primitives, chart wrappers, notification components
- **Replaceable:** Authentication, routing, state management, main dashboard
- **Expandable:** Each reusable component upgraded with EMS business logic

---

## Directory Structure Analysis

### src/ Root Level

```
src/
├── index.jsx                    ✅ KEEP (entry point)
├── App.jsx                      🔄 REFACTOR (remove HashRouter, add OAuth logic)
├── routes.js                    ❌ DELETE ENTIRELY (rebuild for EMS routes)
├── _nav.jsx                     ❌ DELETE ENTIRELY (rebuild for EMS navigation)
├── store.js                     🔄 REFACTOR (upgrade Redux, add RTK Query)
├── assets/                      ✅ KEEP (update logos/branding)
├── components/                  🔄 KEEP & REFACTOR (see detailed breakdown)
├── layout/                      🔄 REFACTOR (single layout → multiple layouts)
└── scss/                        🔄 KEEP & SIMPLIFY (move to Tailwind)
```

---

## Detailed Component Analysis

### src/components/

#### Status: KEEP (60%), REFACTOR (30%), DELETE (10%)

| File | Status | Action | Reason |
|------|--------|--------|--------|
| `AppBreadcrumb.jsx` | ✅ KEEP | Keep & enhance | Breadcrumb navigation reusable |
| `AppContent.jsx` | 🔄 REFACTOR | Simplify route rendering | Current implementation acceptable, will integrate new routes |
| `AppFooter.jsx` | ✅ KEEP | Keep as-is | Footer structure simple, reusable |
| `AppHeader.jsx` | 🔄 REFACTOR | Add auth context, notifications | Remove hardcoded nav links, add real user menu |
| `AppSidebar.jsx` | 🔄 REFACTOR | Connect to auth, RBAC | Remove Redux dependency, use auth context |
| `AppSidebarNav.jsx` | ✅ KEEP | Keep as-is | Navigation rendering logic solid |
| `DocsComponents.jsx` | ❌ DELETE | Docs helper for demos | Demo-only, not needed in production |
| `DocsExample.jsx` | ❌ DELETE | Docs helper for demos | Demo-only, not needed in production |
| `DocsIcons.jsx` | ❌ DELETE | Docs helper for demos | Demo-only, not needed in production |
| `DocsLink.jsx` | ❌ DELETE | Docs helper for demos | Demo-only, not needed in production |
| `header/AppHeaderDropdown.jsx` | 🔄 REFACTOR | Keep structure, replace content | Update user dropdown with real user data |
| `index.js` | ✅ KEEP | Barrel export | Reusable pattern |

**Components to DELETE:** DocsComponents, DocsExample, DocsIcons, DocsLink (directories: `components/`)

**Components to REFACTOR:**
- `AppHeader.jsx` → Remove hardcoded nav links, add real notification/user menu
- `AppSidebar.jsx` → Connect to RBAC, dynamic menu based on permissions
- `AppHeaderDropdown.jsx` → Replace static profile menu with real user data

---

### src/views/ - COMPLETE BREAKDOWN

#### Deletable View Directories (Demo Content Only)

| Directory | Files | Reason | Action |
|-----------|-------|--------|--------|
| `views/base/` | 17 files | Component showcase pages | ❌ **DELETE ENTIRE DIRECTORY** |
| `views/buttons/` | 4 files | Button showcase pages | ❌ **DELETE ENTIRE DIRECTORY** |
| `views/icons/` | 4 files | Icon showcase pages | ❌ **DELETE ENTIRE DIRECTORY** |
| `views/notifications/` | 5 files | Notification showcase pages | ❌ **DELETE ENTIRE DIRECTORY** |
| `views/theme/` | 2 files | Theme showcase pages | ❌ **DELETE ENTIRE DIRECTORY** |
| `views/charts/` | 1 file | Chart showcase | ❌ **DELETE ENTIRE** |
| `views/forms/` | 9 files | Form showcase pages | ❌ **DELETE ENTIRE DIRECTORY** |
| `views/widgets/` | 3 files | Widget showcase pages | ❌ **DELETE ENTIRE DIRECTORY** |

**Total Deletable View Files:** ~50+ demonstration pages

#### Keepable View Directories (Production Use)

| Directory | Files | Reason | Action |
|-----------|-------|--------|--------|
| `views/pages/` | 4 files | Auth pages (Login, Register, 404, 500) | 🔄 **KEEP & REFACTOR** |

**Details on `views/pages/`:**

```
views/pages/
├── login/
│   └── Login.jsx              🔄 REFACTOR (add Google OAuth flow)
├── register/
│   └── Register.jsx           ❌ DELETE (no self-registration, OAuth only)
├── page404/
│   └── Page404.jsx            ✅ KEEP (update styling)
└── page500/
    └── Page500.jsx            ✅ KEEP (update styling)
```

**Page-by-Page Analysis:**

```
LOGIN PAGE (views/pages/login/Login.jsx)
Status: 🔄 REFACTOR
Current: Static form with hardcoded inputs
Target: 
  - Remove username/password form
  - Add "Sign in with Google" button
  - Redirect to OAuth callback
  - Show loading state during auth
  - Handle OAuth errors

REGISTER PAGE (views/pages/register/Register.jsx)
Status: ❌ DELETE
Reason: HMA uses passwordless OAuth only
New Flow: No registration page; existing users auto-created on first login

404 PAGE (views/pages/page404/Page404.jsx)
Status: ✅ KEEP
Action: Update styling to match EMS theme, adjust message

500 PAGE (views/pages/page500/Page500.jsx)
Status: ✅ KEEP
Action: Update styling to match EMS theme, add error details display
```

---

### src/layout/

| File | Status | Action | Reason |
|------|--------|--------|--------|
| `DefaultLayout.jsx` | ✅ KEEP | Keep structure | Sidebar + Header + Content + Footer pattern reusable |

**Refactor Plan for Layouts:**
```
Current: 1 layout (DefaultLayout)

Target: 3 layouts
├── AuthLayout.jsx (for login/oauth callback)
├── MainLayout.jsx (for authenticated app with sidebar)
└── PublicLayout.jsx (for 404/500 errors)

Note: DefaultLayout.jsx can be renamed to MainLayout.jsx
```

---

### src/scss/

| File | Status | Action | Reason |
|------|--------|--------|--------|
| `style.scss` | 🔄 REFACTOR | Keep, simplify, migrate to Tailwind | Core styling patterns |
| `examples.scss` | ❌ DELETE | Demo styling | Not needed in production |
| `vendors/simplebar.scss` | ✅ KEEP | Scrollbar styling | Reused in sidebar |

**SCSS Migration Strategy:**
- Keep core variables and utilities
- Delete all demo/example styles
- Gradually migrate to Tailwind utility classes
- Phase 1: Keep SCSS for compatibility
- Phase 2: Migrate to Tailwind (within 2-3 sprints)

---

### src/assets/

| Directory | Status | Action | Reason |
|-----------|--------|--------|--------|
| `assets/brand/` | ✅ KEEP | Update logos | Replace with HMA branding |
| `assets/images/avatars/` | 🔄 PARTIAL KEEP | Keep structure | Demo images can be removed, real user avatars later |

**Action:**
- Replace CoreUI logo with HMA logo
- Replace CoreUI sygnet with HMA sygnet
- Remove all demo avatar images (generated on demand for users)

---

## Routes Analysis

### Current Routes (src/routes.js)

**Total Routes:** ~50 demo showcase routes

```javascript
// Current structure:
Dashboard, Theme/Colors, Theme/Typography,
Base/* (17 showcase pages),
Buttons/* (3 showcase pages),
Forms/* (9 showcase pages),
Icons/* (3 showcase pages),
Notifications/* (4 showcase pages),
Charts, Widgets
```

**Action: DELETE ENTIRE FILE**

New routes will be built in `src/routing/` folder:

```
src/routing/
├── routes.ts              # Route configuration
├── usePrivateRoute.ts     # Protected route logic
├── usePublicRoute.ts      # Public route logic
├── types.ts               # Route types
└── permissions.ts         # Permission-based route mapping
```

---

## Navigation (_nav.jsx) Analysis

### Current Navigation

**Status:** ❌ **DELETE ENTIRE FILE**

The current `_nav.jsx` contains:
- Dashboard link
- Theme section (Colors, Typography)
- Components section (Base, Buttons, Forms, Icons, Notifications, etc.)
- External links to CoreUI Pro

**All are demo content.**

### New Navigation Structure

**Location:** `src/common/config/_nav.ts` (not JSX, config-driven)

```typescript
// New navigation driven by user roles/permissions
// Will be dynamically generated based on RBAC
// Admin sees all modules; Employee sees limited modules

Navigation Items:
- Dashboard
- Projects
- Staff & Payroll
- Attendance
- Expenses
- Announcements
- Reports
- Profile
- Admin Panel (if admin)
- Audit Logs (if HR)
```

---

## Application Entry Point (App.jsx)

### Current Implementation

```jsx
// HashRouter + simple theme logic
// No OAuth, no auth context, no RBAC
// Routes rendered as catch-all
```

### Target Implementation

```jsx
// BrowserRouter (cleaner URLs)
// OAuth context provider
// RBAC provider
// Theme provider
// Notification provider
// Separate public/authenticated routes
// Protected route guards
```

---

## Store.js Analysis

### Current Redux Setup

**Status:** 🔄 **REFACTOR**

```javascript
// Minimal Redux store with 2 state slices:
// - sidebarShow (boolean)
// - theme (string)
// - changeState reducer (generic)
```

### Target Redux Setup

```typescript
// Redux Toolkit with typed slices:
// - authSlice (user, roles, permissions, tokens)
// - uiSlice (sidebarShow, theme, language)
// - notificationSlice (toast queue)
// - RTK Query for server state (no manual Redux for data)

// Structure:
src/store/
├── index.ts                    # Store configuration
├── slices/
│   ├── authSlice.ts           # Authentication state
│   ├── uiSlice.ts             # UI state
│   └── notificationSlice.ts    # Notifications
├── api/
│   ├── index.ts               # RTK Query setup
│   ├── dashboardApi.ts
│   ├── projectsApi.ts
│   ├── staffApi.ts
│   ├── attendanceApi.ts
│   ├── expensesApi.ts
│   ├── announcementsApi.ts
│   ├── reportsApi.ts
│   ├── payrollApi.ts
│   ├── profileApi.ts
│   └── auditApi.ts
└── types/
    └── index.ts               # Redux state types
```

---

## File-by-File Deletion List

### SAFE TO DELETE IMMEDIATELY

**Directory Deletions (~50 files):**

```
✅ DELETE: src/views/base/                 # 17 showcase pages
✅ DELETE: src/views/buttons/              # 4 showcase pages
✅ DELETE: src/views/forms/                # 9 showcase pages (form examples)
✅ DELETE: src/views/icons/                # 4 showcase pages
✅ DELETE: src/views/notifications/        # 5 showcase pages
✅ DELETE: src/views/theme/                # 2 showcase pages
✅ DELETE: src/views/widgets/              # 3 showcase pages
✅ DELETE: src/views/charts/Charts.jsx     # 1 showcase page
✅ DELETE: src/views/pages/register/       # 1 register page
```

**File Deletions:**

```
✅ DELETE: src/routes.js                   # Rebuild for EMS
✅ DELETE: src/_nav.jsx                    # Rebuild for EMS
✅ DELETE: src/components/DocsComponents.jsx
✅ DELETE: src/components/DocsExample.jsx
✅ DELETE: src/components/DocsIcons.jsx
✅ DELETE: src/components/DocsLink.jsx
✅ DELETE: src/scss/examples.scss          # Demo styles
✅ DELETE: src/assets/images/avatars/      # Demo images
```

**Total Files to Delete:** ~60+ files

---

## Files to Keep

### Core Infrastructure

```
✅ KEEP: src/index.jsx
✅ KEEP: src/store.js                      # Will be refactored
✅ KEEP: src/components/AppBreadcrumb.jsx
✅ KEEP: src/components/AppContent.jsx     # Will be refactored
✅ KEEP: src/components/AppFooter.jsx
✅ KEEP: src/components/AppHeader.jsx      # Will be refactored
✅ KEEP: src/components/AppSidebar.jsx     # Will be refactored
✅ KEEP: src/components/AppSidebarNav.jsx
✅ KEEP: src/components/header/AppHeaderDropdown.jsx  # Will be refactored
✅ KEEP: src/components/index.js
✅ KEEP: src/layout/DefaultLayout.jsx      # Rename to MainLayout
✅ KEEP: src/scss/style.scss
✅ KEEP: src/scss/vendors/simplebar.scss
```

### Error Pages

```
✅ KEEP: src/views/pages/page404/Page404.jsx   # Update styling
✅ KEEP: src/views/pages/page500/Page500.jsx   # Update styling
```

### Assets

```
✅ KEEP: src/assets/brand/logo.jsx         # Replace with HMA logo
✅ KEEP: src/assets/brand/sygnet.jsx       # Replace with HMA sygnet
```

**Total Files to Keep:** ~20 files

---

## Files to Rename

### Layout Reorganization

| Current Path | New Path | Reason |
|--------------|----------|--------|
| `src/layout/DefaultLayout.jsx` | `src/common/layout/MainLayout.jsx` | Reorganize into common module |
| `src/components/AppBreadcrumb.jsx` | `src/common/components/Breadcrumb.jsx` | Move to common |
| `src/components/AppFooter.jsx` | `src/common/components/Footer.jsx` | Move to common |
| `src/components/AppHeader.jsx` | `src/common/components/Header.jsx` | Move to common |
| `src/components/AppSidebar.jsx` | `src/common/components/Sidebar.jsx` | Move to common |
| `src/components/AppSidebarNav.jsx` | `src/common/components/SidebarNav.jsx` | Move to common |
| `src/components/AppContent.jsx` | `src/common/components/Content.jsx` | Move to common |
| `src/components/header/AppHeaderDropdown.jsx` | `src/common/components/UserMenu.jsx` | Clarify purpose |

### Simplification

| Current | New | Reason |
|---------|-----|--------|
| `views/pages/page404/` | `views/ErrorPages/NotFound.jsx` | Flatten structure |
| `views/pages/page500/` | `views/ErrorPages/ServerError.jsx` | Flatten structure |
| `views/pages/login/` | `views/Auth/LoginPage.jsx` | Clarify module |

---

## Files to Move

### Major Reorganization

#### Move Layout Components to Common

```
MOVE: src/components/App*.jsx → src/common/components/
├── AppBreadcrumb.jsx → Breadcrumb.jsx
├── AppContent.jsx → Content.jsx
├── AppFooter.jsx → Footer.jsx
├── AppHeader.jsx → Header.jsx
├── AppSidebar.jsx → Sidebar.jsx
├── AppSidebarNav.jsx → SidebarNav.jsx
└── header/AppHeaderDropdown.jsx → UserMenu.jsx

MOVE: src/layout/DefaultLayout.jsx → src/common/layout/MainLayout.jsx

DELETE: src/components/DocsComponents.jsx (& related docs files)
```

#### Create Feature Module Structure

```
CREATE: src/features/
├── dashboard/
│   ├── pages/Dashboard.jsx (from views/dashboard/Dashboard.jsx)
│   ├── components/
│   │   ├── MetricsGrid.jsx
│   │   ├── TaskQueue.jsx
│   │   └── ...
│   └── hooks/
├── projects/
│   ├── pages/ProjectsList.jsx, ProjectDetail.jsx, etc.
│   ├── components/
│   └── hooks/
├── staff/
│   ├── pages/
│   ├── components/
│   └── hooks/
├── attendance/
│   ├── pages/
│   ├── components/
│   └── hooks/
├── expenses/
│   ├── pages/
│   ├── components/
│   └── hooks/
├── announcements/
│   ├── pages/
│   ├── components/
│   └── hooks/
├── reports/
│   ├── pages/
│   ├── components/
│   └── hooks/
├── payroll/
│   ├── pages/
│   ├── components/
│   └── hooks/
├── profile/
│   ├── pages/
│   ├── components/
│   └── hooks/
├── audit/
│   ├── pages/
│   ├── components/
│   └── hooks/
└── admin/
    ├── pages/
    ├── components/
    └── hooks/
```

#### Move Dashboard to Features

```
MOVE: src/views/dashboard/Dashboard.jsx → src/features/dashboard/pages/Dashboard.jsx
MOVE: src/views/dashboard/MainChart.jsx → src/features/dashboard/components/MainChart.jsx
MOVE: src/views/widgets/WidgetsBrand.jsx → src/features/dashboard/components/WidgetsBrand.jsx
MOVE: src/views/widgets/WidgetsDropdown.jsx → src/features/dashboard/components/WidgetsDropdown.jsx
DELETE: src/views/widgets/Widgets.jsx (showcase page)
```

#### Move Auth Pages

```
MOVE: src/views/pages/login/Login.jsx → src/features/auth/pages/LoginPage.jsx
CREATE: src/features/auth/pages/OAuthCallback.jsx (NEW)
DELETE: src/views/pages/register/Register.jsx
```

#### Flatten Error Pages

```
MOVE: src/views/pages/page404/Page404.jsx → src/views/ErrorPages/NotFound.jsx
MOVE: src/views/pages/page500/Page500.jsx → src/views/ErrorPages/ServerError.jsx
DELETE: src/views/pages/ (directory)
```

---

## Migration Phases

### Phase 0: Cleanup (Day 1-2)

**Objective:** Remove all demo content and unstable routes.

**Tasks:**

1. **Delete Demo View Directories**
   ```bash
   rm -rf src/views/base/
   rm -rf src/views/buttons/
   rm -rf src/views/forms/
   rm -rf src/views/icons/
   rm -rf src/views/notifications/
   rm -rf src/views/theme/
   rm -rf src/views/widgets/
   rm -rf src/views/charts/
   ```

2. **Delete Demo Files**
   ```bash
   rm src/routes.js
   rm src/_nav.jsx
   rm src/scss/examples.scss
   rm src/components/DocsComponents.jsx
   rm src/components/DocsExample.jsx
   rm src/components/DocsIcons.jsx
   rm src/components/DocsLink.jsx
   rm -rf src/views/pages/register/
   rm -rf src/assets/images/avatars/
   ```

3. **Delete Demo Component Files in Header**
   ```bash
   rm -f src/components/header/*.jsx (keep only AppHeaderDropdown)
   ```

4. **Verify App Still Runs**
   - App should show 404 (no routes defined yet)
   - No console errors
   - No broken imports

**Deliverable:** Clean, demo-free codebase ready for restructuring

---

### Phase 1: Reorganization (Day 3-5)

**Objective:** Restructure directories and move production code to proper locations.

**Tasks:**

1. **Create New Directory Structure**
   ```bash
   mkdir -p src/common/components/
   mkdir -p src/common/layout/
   mkdir -p src/common/hooks/
   mkdir -p src/common/utils/
   mkdir -p src/common/types/
   mkdir -p src/features/
   mkdir -p src/store/slices/
   mkdir -p src/store/api/
   mkdir -p src/routing/
   mkdir -p src/views/ErrorPages/
   ```

2. **Move Layout Components to Common**
   ```bash
   mv src/components/AppBreadcrumb.jsx src/common/components/Breadcrumb.jsx
   mv src/components/AppContent.jsx src/common/components/Content.jsx
   mv src/components/AppFooter.jsx src/common/components/Footer.jsx
   mv src/components/AppHeader.jsx src/common/components/Header.jsx
   mv src/components/AppSidebar.jsx src/common/components/Sidebar.jsx
   mv src/components/AppSidebarNav.jsx src/common/components/SidebarNav.jsx
   mv src/components/header/AppHeaderDropdown.jsx src/common/components/UserMenu.jsx
   mv src/layout/DefaultLayout.jsx src/common/layout/MainLayout.jsx
   rmdir src/layout
   rmdir src/components/header
   ```

3. **Move Dashboard to Features**
   ```bash
   mkdir -p src/features/dashboard/pages
   mkdir -p src/features/dashboard/components
   mv src/views/dashboard/Dashboard.jsx src/features/dashboard/pages/
   mv src/views/dashboard/MainChart.jsx src/features/dashboard/components/
   rmdir src/views/dashboard
   ```

4. **Move Auth Pages to Features**
   ```bash
   mkdir -p src/features/auth/pages
   mv src/views/pages/login/Login.jsx src/features/auth/pages/LoginPage.jsx
   rmdir src/views/pages/login
   rmdir src/views/pages
   ```

5. **Flatten Error Pages**
   ```bash
   mv src/views/page404/Page404.jsx src/views/ErrorPages/NotFound.jsx
   mv src/views/page500/Page500.jsx src/views/ErrorPages/ServerError.jsx
   rmdir src/views/page404
   rmdir src/views/page500
   ```

6. **Update Imports Throughout**
   - Update index.jsx imports
   - Update App.jsx imports
   - Update component imports
   - Fix all broken import paths

**Deliverable:** Reorganized codebase with proper folder structure

---

### Phase 2: Refactor Core Files (Day 6-10)

**Objective:** Update core files to match EMS architecture.

**Tasks:**

1. **Refactor App.jsx**
   - Replace HashRouter with BrowserRouter
   - Add OAuth context provider
   - Add RBAC provider
   - Add theme provider
   - Add notification provider
   - Setup protected routes

2. **Refactor store.js → store/index.ts**
   - Migrate to Redux Toolkit
   - Create typed slices (auth, ui, notification)
   - Setup RTK Query
   - Move Redux setup to TypeScript

3. **Create New Routing System (src/routing/)**
   - `routes.ts` - Route configuration per feature
   - `usePrivateRoute.ts` - Protected route hook
   - Permission-based routing logic
   - Replace old route definition model

4. **Create OAuth Flow**
   - `src/features/auth/services/authService.ts` - Google OAuth logic
   - `src/features/auth/pages/OAuthCallback.jsx` - Callback handler
   - `src/features/auth/pages/LoginPage.jsx` - Login UI
   - JWT storage and refresh logic

5. **Update Common Components**
   - `src/common/components/Header.jsx` - Add real user menu, remove hardcoded links
   - `src/common/components/Sidebar.jsx` - Add RBAC, dynamic menu
   - `src/common/components/UserMenu.jsx` - Real user dropdown
   - All components use auth context, not Redux

6. **Create Types**
   - `src/common/types/index.ts` - Shared types
   - `src/store/types/index.ts` - Redux state types
   - User, Role, Permission types

**Deliverable:** Core infrastructure refactored and ready for features

---

### Phase 3: Add EMS Features (Day 11+)

**Objective:** Build feature modules following the EMS architecture.

**Tasks (per feature module):**

1. **For Each Module (Dashboard, Projects, Staff, Attendance, Expenses, etc.):**
   ```
   features/{module}/
   ├── pages/
   │   ├── List.jsx
   │   ├── Detail.jsx
   │   └── Form.jsx
   ├── components/
   │   ├── {Module}Card.jsx
   │   ├── {Module}Table.jsx
   │   └── ...
   ├── hooks/
   │   ├── use{Module}List.ts
   │   ├── use{Module}Detail.ts
   │   └── use{Module}Form.ts
   ├── services/
   │   └── {module}Api.ts (RTK Query)
   ├── types/
   │   └── index.ts
   └── {module}Slice.ts (if needed)
   ```

2. **Register Routes**
   - Add each feature's routes to routing system
   - Apply RBAC checks per route
   - Setup lazy loading per feature

3. **Implement API Integration**
   - RTK Query endpoints per module
   - Caching strategy per endpoint
   - Error handling
   - Pagination, filtering, sorting

4. **Build UI Components**
   - Module-specific forms
   - Tables with actions
   - Detail views
   - Approval workflows

5. **Add Audit Logging Hook**
   - Track mutations
   - Capture user, timestamp, action
   - Send to backend audit endpoint

**Timeline:** ~1 module per week (8-10 weeks total for all modules)

**Deliverable:** Complete EMS features

---

## Package.json Updates

### Dependencies to Keep

```json
{
  "@coreui/chartjs": "^4.2.0",           ✅ KEEP (charts)
  "@coreui/coreui": "^5.6.1",            ✅ KEEP (CSS framework)
  "@coreui/icons": "^3.0.1",             ✅ KEEP (icon set)
  "@coreui/icons-react": "^2.3.0",       ✅ KEEP (React icons)
  "@coreui/react": "^5.10.0",            ✅ KEEP (UI components)
  "@coreui/react-chartjs": "^3.0.0",     ✅ KEEP (React charts)
  "@coreui/utils": "^2.0.2",             ✅ KEEP (utilities)
  "@popperjs/core": "^2.11.8",           ✅ KEEP (popovers)
  "chart.js": "^4.5.1",                  ✅ KEEP (charting)
  "classnames": "^2.5.1",                ✅ KEEP (className utility)
  "core-js": "^3.49.0",                  ✅ KEEP (polyfills)
  "prop-types": "^15.8.1",               ⚠️ REMOVE (use TypeScript)
  "react": "^19.2.4",                    ✅ KEEP
  "react-dom": "^19.2.4",                ✅ KEEP
  "react-redux": "^9.2.0",               ✅ KEEP (Redux React bindings)
  "react-router-dom": "^7.13.2",         ✅ KEEP (routing)
  "redux": "5.0.1",                      🔄 REPLACE (use @reduxjs/toolkit)
  "simplebar-react": "^3.3.2"            ✅ KEEP (custom scrollbar)
}
```

### Dependencies to Add

```json
{
  "@reduxjs/toolkit": "^2.x",            ➕ ADD (Redux modern)
  "@hookform/resolvers": "^3.x",         ➕ ADD (form validation)
  "axios": "^1.x",                       ➕ ADD (HTTP client)
  "date-fns": "^2.x",                    ➕ ADD (date manipulation)
  "jwt-decode": "^4.x",                  ➕ ADD (JWT parsing)
  "react-hook-form": "^7.x",             ➕ ADD (form management)
  "zod": "^3.x",                         ➕ ADD (schema validation)
  "typescript": "^5.x"                   ➕ ADD (type safety)
}
```

### Dependencies to Remove

```json
{
  "prop-types": "❌ REMOVE (replaced by TypeScript)",
  "redux": "❌ REMOVE (replace with @reduxjs/toolkit)"
}
```

---

## Summary Table

### File Counts

| Category | Count | Status |
|----------|-------|--------|
| **Delete** | ~65 | Demo showcase pages & components |
| **Keep** | ~20 | Core layout & pages |
| **Rename** | ~10 | Moving to proper locations |
| **Create** | ~50+ | New feature modules, auth, routing |
| **Refactor** | ~15 | Core infrastructure (App, store, etc.) |

### Directory Changes

| From | To | Type | Reason |
|------|----|----|--------|
| `src/views/base/` | DELETE | Cleanup | Demo content |
| `src/views/buttons/` | DELETE | Cleanup | Demo content |
| `src/views/forms/` | DELETE | Cleanup | Demo content |
| `src/views/icons/` | DELETE | Cleanup | Demo content |
| `src/views/notifications/` | DELETE | Cleanup | Demo content |
| `src/views/theme/` | DELETE | Cleanup | Demo content |
| `src/views/widgets/` | DELETE | Cleanup | Demo content |
| `src/views/charts/` | DELETE | Cleanup | Demo content |
| `src/layout/` | Rename to `src/common/layout/` | Reorganize | Grouping related |
| `src/components/` (layout only) | `src/common/components/` | Move | Grouping related |
| `src/views/dashboard/` | `src/features/dashboard/` | Reorganize | Feature modules |
| `src/views/pages/login/` | `src/features/auth/` | Move | Feature modules |
| `src/views/pages/page404/` | `src/views/ErrorPages/` | Reorganize | Flatten structure |
| NEW: `src/features/` | CREATE | New | Domain-driven modules |
| NEW: `src/store/` | CREATE | New | Redux infrastructure |
| NEW: `src/routing/` | CREATE | New | Routing logic |
| NEW: `src/common/` | CREATE | New | Shared utilities |

---

## Risk Mitigation

### Risk 1: Breaking Imports After File Moves

**Mitigation:**
- Use IDE "Find & Replace" to update imports across entire codebase
- After each move, verify no broken imports (run linter)
- Test app loads without errors

### Risk 2: Losing Reusable UI Patterns

**Mitigation:**
- Before deleting any file, extract reusable patterns to `src/common/components/`
- Example: button styles from demo pages → reusable ButtonVariants component
- Example: form patterns from demo pages → reusable FormField component

### Risk 3: Incomplete Refactoring

**Mitigation:**
- Follow phases strictly; don't skip steps
- Test after each phase before moving to next
- Use Git commits for each logical step (easy rollback)

### Risk 4: Unused Dependencies

**Mitigation:**
- After cleanup, run `npm audit` and `npm ls --unused`
- Remove unused packages
- Keep only essential dependencies

---

## Implementation Checklist

### Phase 0: Cleanup ✅

- [ ] Delete all demo view directories (base, buttons, forms, icons, notifications, theme, widgets, charts)
- [ ] Delete routes.js
- [ ] Delete _nav.jsx
- [ ] Delete examples.scss
- [ ] Delete docs-related components
- [ ] Delete register page
- [ ] Delete demo avatar images
- [ ] Run `npm start` - should show 404
- [ ] Commit: "Cleanup: Remove all demo content"

### Phase 1: Reorganization ✅

- [ ] Create new directory structure
- [ ] Move layout components to common/
- [ ] Move error pages to ErrorPages/
- [ ] Move dashboard to features/
- [ ] Move login to features/auth/
- [ ] Update all imports (run linter)
- [ ] Run `npm start` - verify no errors
- [ ] Commit: "Refactor: Reorganize directory structure"

### Phase 2: Refactor Core ✅

- [ ] Refactor App.jsx (OAuth setup)
- [ ] Migrate store.js to Redux Toolkit
- [ ] Create routing system
- [ ] Create OAuth flow & LoginPage
- [ ] Update Header component (auth context)
- [ ] Update Sidebar component (RBAC)
- [ ] Create shared types
- [ ] Run `npm start` - full page loads
- [ ] Commit: "Refactor: Core infrastructure"

### Phase 3+: Features ✅

- [ ] Build Dashboard feature
- [ ] Build Projects feature
- [ ] Build Staff feature
- [ ] Build Attendance feature
- [ ] Build Expenses feature
- [ ] Build Announcements feature
- [ ] Build Reports feature
- [ ] Build Payroll feature
- [ ] Build Profile feature
- [ ] Build Audit feature
- [ ] Commit: "Feature: [Module Name]"

---

## File Movement Commands (Reference)

```bash
# Cleanup Phase
rm -rf src/views/base src/views/buttons src/views/forms src/views/icons src/views/notifications src/views/theme src/views/widgets src/views/charts
rm src/routes.js src/_nav.jsx src/scss/examples.scss
rm src/components/DocsComponents.jsx src/components/DocsExample.jsx src/components/DocsIcons.jsx src/components/DocsLink.jsx
rm -rf src/views/pages/register src/assets/images/avatars

# Create new structure
mkdir -p src/common/components src/common/layout src/common/hooks src/common/utils src/common/types
mkdir -p src/features src/store/slices src/store/api src/routing
mkdir -p src/views/ErrorPages

# Move layout to common
mv src/components/AppBreadcrumb.jsx src/common/components/Breadcrumb.jsx
mv src/components/AppContent.jsx src/common/components/Content.jsx
mv src/components/AppFooter.jsx src/common/components/Footer.jsx
mv src/components/AppHeader.jsx src/common/components/Header.jsx
mv src/components/AppSidebar.jsx src/common/components/Sidebar.jsx
mv src/components/AppSidebarNav.jsx src/common/components/SidebarNav.jsx
mv src/components/header/AppHeaderDropdown.jsx src/common/components/UserMenu.jsx
mv src/layout/DefaultLayout.jsx src/common/layout/MainLayout.jsx

# Move features
mkdir -p src/features/dashboard/pages src/features/dashboard/components
mv src/views/dashboard/Dashboard.jsx src/features/dashboard/pages/
mv src/views/dashboard/MainChart.jsx src/features/dashboard/components/

mkdir -p src/features/auth/pages
mv src/views/pages/login/Login.jsx src/features/auth/pages/LoginPage.jsx

# Flatten error pages
mv src/views/pages/page404/Page404.jsx src/views/ErrorPages/NotFound.jsx
mv src/views/pages/page500/Page500.jsx src/views/ErrorPages/ServerError.jsx

# Cleanup empty directories
rmdir src/layout src/components/header src/views/dashboard src/views/pages/login src/views/pages/page404 src/views/pages/page500 src/views/pages
```

---

## Success Criteria

✅ All demo content removed  
✅ Directory structure reorganized per EMS architecture  
✅ Core files refactored (App, store, auth)  
✅ No broken imports  
✅ App loads without errors  
✅ TypeScript strict mode passes  
✅ ESLint passes with no warnings  
✅ Git history clean with logical commits  
✅ Ready for feature module development  

---

**Document Status:** Ready for Implementation  
**Next Step:** Execute Phase 0 (Cleanup) immediately  
**Estimated Total Time:** 10-15 days (Phases 0-2) + ongoing feature development
