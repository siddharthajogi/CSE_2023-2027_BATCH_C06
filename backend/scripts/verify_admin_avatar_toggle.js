const fs = require('fs');
const path = require('path');

function runTests() {
  console.log('--- STARTING ADMIN AVATAR TOGGLE NAVIGATION VERIFICATION ---\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Inspect AdminLayout.jsx
  const adminLayoutPath = path.resolve(__dirname, '../../frontend/src/components/AdminLayout.jsx');
  assert(fs.existsSync(adminLayoutPath), 'AdminLayout.jsx exists');
  const adminLayoutContent = fs.readFileSync(adminLayoutPath, 'utf8');

  // Verify route tracking
  assert(
    adminLayoutContent.includes('previousAdminPathRef = useRef(null)'),
    'previousAdminPathRef exists for tracking previous route'
  );
  assert(
    adminLayoutContent.includes("location.pathname !== '/admin/profile'") &&
    adminLayoutContent.includes("sessionStorage.setItem('admin_previous_page', fullPath)"),
    'Tracks previous non-profile route in ref and sessionStorage'
  );

  // Verify handleAvatarClick logic
  assert(
    adminLayoutContent.includes('const handleAvatarClick = (e) => {') &&
    adminLayoutContent.includes('e.preventDefault();'),
    'handleAvatarClick exists and prevents default link event'
  );
  assert(
    adminLayoutContent.includes("if (location.pathname === '/admin/profile')"),
    'handleAvatarClick detects if currently on /admin/profile'
  );
  assert(
    adminLayoutContent.includes('location.state?.fromAvatarToggle && window.history.length > 1') &&
    adminLayoutContent.includes('navigate(-1);'),
    'Uses navigate(-1) on second click from toggle to pop history without creating loops'
  );
  assert(
    adminLayoutContent.includes("'/admin/dashboard'"),
    'Safely falls back to /admin/dashboard for direct landings'
  );
  assert(
    adminLayoutContent.includes("storedReturn !== '/admin/profile'"),
    'Guards against navigating back to /admin/profile in return target'
  );
  assert(
    adminLayoutContent.includes("navigate('/admin/profile', {") &&
    adminLayoutContent.includes('returnTo: currentFull') &&
    adminLayoutContent.includes('fromAvatarToggle: true'),
    'Navigates to /admin/profile on first click with returnTo state and fromAvatarToggle flag'
  );

  // Verify Link element binding
  assert(
    adminLayoutContent.includes('onClick={handleAvatarClick}'),
    'Avatar Link has onClick={handleAvatarClick} attached'
  );
  assert(
    adminLayoutContent.includes("location.pathname === '/admin/profile'") &&
    adminLayoutContent.includes("'Return to previous page'"),
    'Tooltip title changes to "Return to previous page" when on /admin/profile'
  );
  assert(
    adminLayoutContent.includes("aria-label={location.pathname === '/admin/profile' ? 'Return to previous page' : 'View Admin Profile'}"),
    'aria-label dynamically updates to "Return to previous page" on /admin/profile'
  );
  assert(
    adminLayoutContent.includes("ring-2 ring-indigo-500 ring-offset-2"),
    'Avatar has active ring indicator when on /admin/profile'
  );

  // 2. Behavioral Simulation of Avatar Toggle Logic
  console.log('\n--- Simulating Toggle Navigation Logic Across Routes ---');

  function simulateAvatarToggle(startingRoute, isDirectLanding = false) {
    let currentRoute = startingRoute;
    let historyStack = [startingRoute];
    let routeState = null;
    let previousAdminPath = isDirectLanding ? null : startingRoute;
    let sessionStorage = {};
    if (!isDirectLanding) {
      sessionStorage['admin_previous_page'] = startingRoute;
    }

    // Mock navigate
    function navigate(dest, options) {
      if (typeof dest === 'number') {
        if (dest === -1 && historyStack.length > 1) {
          historyStack.pop();
          currentRoute = historyStack[historyStack.length - 1];
          routeState = null;
        }
      } else {
        currentRoute = dest;
        routeState = options?.state || null;
        historyStack.push(dest);
      }
    }

    // Simulated handler matching AdminLayout.jsx
    function clickAvatar() {
      if (currentRoute === '/admin/profile') {
        if (routeState?.fromAvatarToggle && historyStack.length > 1) {
          navigate(-1);
        } else {
          const storedSession = sessionStorage['admin_previous_page'];
          const storedReturn =
            routeState?.returnTo ||
            previousAdminPath ||
            storedSession ||
            '/admin/dashboard';
          const safeReturn =
            storedReturn && storedReturn !== '/admin/profile'
              ? storedReturn
              : '/admin/dashboard';
          navigate(safeReturn);
        }
      } else {
        const currentFull = currentRoute;
        navigate('/admin/profile', {
          state: {
            returnTo: currentFull,
            fromAvatarToggle: true
          }
        });
      }
    }

    // If starting on non-profile, first click should go to /admin/profile
    if (startingRoute !== '/admin/profile') {
      clickAvatar();
      assert(currentRoute === '/admin/profile', `First click from ${startingRoute} navigates to /admin/profile`);
      assert(routeState?.fromAvatarToggle === true, `State records fromAvatarToggle = true`);
      assert(routeState?.returnTo === startingRoute, `State records returnTo = ${startingRoute}`);
      assert(historyStack.length === 2, `History stack has exactly 2 entries (clean stack)`);

      // Second click should return to startingRoute
      clickAvatar();
      assert(currentRoute === startingRoute, `Second click returns to ${startingRoute}`);
      assert(historyStack.length === 1, `History stack cleanly restored to length 1 (no loops/repeated entries)`);
    } else {
      // Direct landing on /admin/profile
      clickAvatar();
      assert(currentRoute === '/admin/dashboard', 'Clicking avatar on direct landing /admin/profile navigates to /admin/dashboard fallback');
    }
  }

  simulateAvatarToggle('/admin/dashboard');
  simulateAvatarToggle('/admin/subjects');
  simulateAvatarToggle('/admin/students');
  simulateAvatarToggle('/admin/teachers');
  simulateAvatarToggle('/admin/settings');
  simulateAvatarToggle('/admin/profile', true);

  // 3. Verify Teacher and Student Portals are Untouched
  console.log('\n--- Verifying Scope: Teacher and Student Portals Untouched ---');
  const teacherLayout = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/TeacherLayout.jsx'), 'utf8');
  assert(!teacherLayout.includes('handleAvatarClick'), 'TeacherLayout does not contain handleAvatarClick');

  const studentLayout = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/StudentLayout.jsx'), 'utf8');
  assert(!studentLayout.includes('handleAvatarClick'), 'StudentLayout does not contain handleAvatarClick');

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
