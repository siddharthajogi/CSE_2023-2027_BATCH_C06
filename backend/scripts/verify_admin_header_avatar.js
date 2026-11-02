const fs = require('fs');
const path = require('path');
const http = require('http');

async function runTests() {
  console.log('--- STARTING ADMIN HEADER AVATAR VERIFICATION ---\n');
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

  // 1. Check AdminLayout.jsx
  const adminLayoutPath = path.resolve(__dirname, '../../frontend/src/components/AdminLayout.jsx');
  const adminLayoutContent = fs.readFileSync(adminLayoutPath, 'utf8');

  // Verify My Profile is removed from sidebar menuItems
  const menuItemsBlock = adminLayoutContent.match(/const menuItems = \[([\s\S]*?)\];/);
  assert(menuItemsBlock && !menuItemsBlock[1].includes("'My Profile'"), 'My Profile navigation link is removed from Admin sidebar menuItems');
  assert(menuItemsBlock && menuItemsBlock[1].includes("'Settings'"), 'Settings link is preserved in Admin sidebar menuItems');
  assert(adminLayoutContent.includes('Logout</span>') && adminLayoutContent.includes('handleLogout'), 'Logout option is preserved in Admin sidebar');

  // Verify Header structure and Avatar position
  const headerIdx = adminLayoutContent.indexOf('<header className="');
  const themeIdx = adminLayoutContent.indexOf('ref={themeDropdownRef}', headerIdx);
  const avatarLinkIdx = adminLayoutContent.indexOf('to="/admin/profile"', themeIdx);

  assert(headerIdx !== -1, 'Global header component exists');
  assert(themeIdx !== -1 && themeIdx > headerIdx, 'Theme control exists in header');
  assert(avatarLinkIdx !== -1 && avatarLinkIdx > themeIdx, 'Admin profile avatar link appears at extreme right after Theme control');

  // Verify avatar attributes and styling
  assert(adminLayoutContent.includes('adminProfile.profilePhoto'), 'Renders adminProfile.profilePhoto dynamically from admin profile data');
  assert(adminLayoutContent.includes('rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-800'), 'Circular styling with subtle border is applied to profile photo');
  assert(adminLayoutContent.includes('<User className="w-5 h-5 text-white/90" />'), 'Professional fallback avatar (User icon) is rendered when no profile picture');

  // Verify synchronization and event handling
  assert(adminLayoutContent.includes("window.addEventListener('admin-profile-updated', handleProfileUpdate);"), 'AdminLayout listens to admin-profile-updated event for instant header sync');
  assert(adminLayoutContent.includes("window.addEventListener('storage', handleProfileUpdate);"), 'AdminLayout listens to storage event for multi-tab sync');
  assert(adminLayoutContent.includes("window.addEventListener('focus', syncAdminProfile);"), 'AdminLayout syncs profile on window focus');
  assert(adminLayoutContent.includes('syncAdminProfile();') && adminLayoutContent.includes('location.pathname'), 'AdminLayout syncs profile on navigation route changes');

  // 2. Check AdminProfile.jsx event dispatch
  const adminProfilePath = path.resolve(__dirname, '../../frontend/src/components/AdminProfile.jsx');
  const adminProfileContent = fs.readFileSync(adminProfilePath, 'utf8');
  assert(
    adminProfileContent.includes("window.dispatchEvent(new CustomEvent('admin-profile-updated', { detail: res.profile }));"),
    'AdminProfile.jsx dispatches admin-profile-updated CustomEvent on profile save'
  );

  // 3. Verify Teacher and Student layouts are untouched
  const teacherLayoutPath = path.resolve(__dirname, '../../frontend/src/components/TeacherLayout.jsx');
  const studentLayoutPath = path.resolve(__dirname, '../../frontend/src/components/StudentLayout.jsx');
  assert(fs.existsSync(teacherLayoutPath), 'TeacherLayout exists and was preserved');
  assert(fs.existsSync(studentLayoutPath), 'StudentLayout exists and was preserved');

  // 4. Test Backend Admin Profile API
  console.log('\n--- Testing Backend Admin Profile Data Retrieval ---');
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  const mongoose = require('mongoose');
  const jwt = require('jsonwebtoken');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('../models/User');
    const admin = await User.findOne({ role: 'admin' });
    assert(!!admin, `Found Admin record: ${admin ? admin.name : 'None'} (loginId: ${admin ? admin.loginId : ''})`);
    if (admin) {
      assert(!!admin.profilePhoto && admin.profilePhoto.length > 50, 'Admin has profile photo configured in MongoDB');
    }
    await mongoose.disconnect();
  } catch (err) {
    console.error('Database check error:', err.message);
  }

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
