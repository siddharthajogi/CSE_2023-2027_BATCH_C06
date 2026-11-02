const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });
const Subject = require('../models/Subject');
const TeachingAssignment = require('../models/TeachingAssignment');

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  const testSubs = await Subject.find({ code: { $regex: /^(UNASSIGNED_|ASSIGN_)/ } });
  for (const s of testSubs) {
    await TeachingAssignment.deleteMany({ subject: s._id });
    await Subject.findByIdAndDelete(s._id);
    console.log('Cleaned up test subject:', s.code);
  }
  const remaining = await Subject.find({});
  console.log('Remaining authentic subjects:', remaining.length);
  await mongoose.disconnect();
}
clean();

