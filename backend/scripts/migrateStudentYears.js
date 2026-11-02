const mongoose = require('../node_modules/mongoose');
require('../node_modules/dotenv').config({ path: './backend/.env' });
const StudentProfile = require('../models/StudentProfile');

const semesterToYear = (semester) => {
  if (!semester) return null;
  const match = String(semester).match(/\d+/);
  if (!match) return null;
  const num = parseInt(match[0], 10);
  if (num === 1 || num === 2) return 'First Year';
  if (num === 3 || num === 4) return 'Second Year';
  if (num === 5 || num === 6) return 'Third Year';
  if (num === 7 || num === 8) return 'Fourth Year';
  return null;
};

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const students = await StudentProfile.find({});
  let updatedCount = 0;

  for (const s of students) {
    if (!s.yearOfStudy && s.semester) {
      const derived = semesterToYear(s.semester);
      if (derived) {
        s.yearOfStudy = derived;
        await s.save();
        console.log(`Updated student ${s.studentId} (semester: ${s.semester}) -> yearOfStudy: ${derived}`);
        updatedCount++;
      }
    }
  }

  console.log(`Migration finished. Updated ${updatedCount} students.`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

