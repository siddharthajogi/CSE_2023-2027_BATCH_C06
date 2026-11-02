const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });
const Subject = require('../models/Subject');

const semesterToYear = (semester) => {
  if (!semester) return null;
  const match = String(semester).trim().toLowerCase().match(/\d+/);
  if (!match) return null;
  const num = parseInt(match[0], 10);
  if (num === 1 || num === 2) return 'First Year';
  if (num === 3 || num === 4) return 'Second Year';
  if (num === 5 || num === 6) return 'Third Year';
  if (num === 7 || num === 8) return 'Fourth Year';
  return null;
};

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const subjects = await Subject.find({});
    console.log(`Found ${subjects.length} subjects to inspect.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const sub of subjects) {
      const targetYear = semesterToYear(sub.semester);
      if (targetYear) {
        if (sub.academicYear !== targetYear) {
          sub.academicYear = targetYear;
          await sub.save();
          console.log(`Updated subject [${sub.code} - ${sub.name}]: semester "${sub.semester}" -> academicYear "${targetYear}"`);
          updatedCount++;
        } else {
          console.log(`Subject [${sub.code} - ${sub.name}] already has correct academicYear "${sub.academicYear}".`);
          skippedCount++;
        }
      } else {
        console.log(`Subject [${sub.code} - ${sub.name}] has no semester defined (academicYear: "${sub.academicYear || ''}"). Skipping arbitrary assignment.`);
        skippedCount++;
      }
    }

    console.log(`Migration complete: ${updatedCount} updated, ${skippedCount} untouched.`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

migrate();

