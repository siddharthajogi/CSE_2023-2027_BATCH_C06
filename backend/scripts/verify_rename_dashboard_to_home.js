const fs = require('fs');
const path = require('path');

function runTests() {
  console.log('--- STARTING RENAME DASHBOARD TO HOME VERIFICATION ---\n');
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

  // 1. Verify AdminLayout.jsx
  const adminLayoutPath = path.resolve(__dirname, '../../frontend/src/components/AdminLayout.jsx');
  const adminContent = fs.readFileSync(adminLayoutPath, 'utf8');

  assert(
    adminContent.includes("{ name: 'Home', icon: LayoutDashboard, path: '/admin/dashboard' }"),
    'Admin Portal: sidebar navigation has Home with LayoutDashboard icon and path /admin/dashboard'
  );
  assert(
    !adminContent.match(/menuItems\s*=\s*\[[\s\S]*?name:\s*'Dashboard'/),
    'Admin Portal: Dashboard is no longer in menuItems'
  );
  assert(
    adminContent.includes('{renderNavLinks(false)}') && adminContent.includes('{renderNavLinks(true)}'),
    'Admin Portal: Both desktop and mobile sidebars use menuItems (consistent desktop & mobile)'
  );

  // 2. Verify TeacherLayout.jsx
  const teacherLayoutPath = path.resolve(__dirname, '../../frontend/src/components/TeacherLayout.jsx');
  const teacherContent = fs.readFileSync(teacherLayoutPath, 'utf8');

  assert(
    teacherContent.includes("{ name: 'Home', icon: LayoutDashboard, path: '/teacher/dashboard' }"),
    'Teacher Portal: sidebar navigation has Home with LayoutDashboard icon and path /teacher/dashboard'
  );
  assert(
    !teacherContent.match(/menuItems\s*=\s*\[[\s\S]*?name:\s*'Dashboard'/),
    'Teacher Portal: Dashboard is no longer in menuItems'
  );
  assert(
    teacherContent.includes('{renderNavLinks(false)}') && teacherContent.includes('{renderNavLinks(true)}'),
    'Teacher Portal: Both desktop and mobile sidebars use menuItems (consistent desktop & mobile)'
  );

  // 3. Verify StudentLayout.jsx
  const studentLayoutPath = path.resolve(__dirname, '../../frontend/src/components/StudentLayout.jsx');
  const studentContent = fs.readFileSync(studentLayoutPath, 'utf8');

  assert(
    studentContent.includes("{ name: 'Home', icon: LayoutDashboard, path: '/student/dashboard' }"),
    'Student Portal: sidebar navigation has Home with LayoutDashboard icon and path /student/dashboard'
  );
  assert(
    !studentContent.match(/menuItems\s*=\s*\[[\s\S]*?name:\s*'Dashboard'/),
    'Student Portal: Dashboard is no longer in menuItems'
  );
  assert(
    studentContent.includes('{renderNavLinks(false)}') && studentContent.includes('{renderNavLinks(true)}'),
    'Student Portal: Both desktop and mobile sidebars use menuItems (consistent desktop & mobile)'
  );

  // 4. Verify Route definitions in App.jsx are intact
  const appPath = path.resolve(__dirname, '../../frontend/src/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  assert(appContent.includes('path="/admin"'), 'App.jsx: /admin root route is preserved');
  assert(appContent.includes('path="dashboard"'), 'App.jsx: dashboard child routes are preserved');
  assert(appContent.includes('path="/teacher"'), 'App.jsx: /teacher root route is preserved');
  assert(appContent.includes('path="/student"'), 'App.jsx: /student root route is preserved');

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

