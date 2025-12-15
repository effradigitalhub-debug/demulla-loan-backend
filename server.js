require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const AfricasTalking = require('africastalking');

const app = express();
app.use(express.json());

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Africa's Talking
const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME
});
const sms = at.SMS;

// Schema
const ProspectSchema = new mongoose.Schema({
  name: String,
  phone: String,
  amount: Number,
  staff: String,
  branch: String,
  createdAt: { type: Date, default: Date.now },
  smsSent: { type: Boolean, default: false }
});

const Prospect = mongoose.model('Prospect', ProspectSchema);

// Test route
app.get('/', (req, res) => {
  res.send('Demulla backend running');
});

// Add prospect
app.post('/prospects', async (req, res) => {
  try {
    await Prospect.create({
      ...req.body,
      createdAt: new Date()
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// CRON JOB – runs every hour
cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();
    const day = now.getDay(); // Sunday = 0

    const prospects = await Prospect.find({ smsSent: false });

    for (let p of prospects) {
      const hoursPassed = (now - p.createdAt) / (1000 * 60 * 60);

      // Pause Sundays
      if (day === 0) continue;

      // Monday 8 AM override
      if (day === 1 && now.getHours() === 8 && hoursPassed >= 24) {
        await sendSMS(p);
        continue;
      }

      // Normal window
      if (hoursPassed >= 24 && hoursPassed <= 26) {
        await sendSMS(p);
      }
    }
  } catch (err) {
    console.error('Cron job error:', err);
  }
});

async function sendSMS(p) {
  const message =
    `Hello ${p.name}, this is Demulla Credit. Based on your details, you qualify for a loan of KES ${p.amount}. Call 0755544444 or visit our Kapsowar branch for assistance.`;

  try {
    await sms.send({
      to: [p.phone],
      message,
      from: 'Demulla'
    });

    p.smsSent = true;
    await p.save();
  } catch (err) {
    console.error('SMS send error for', p._id, err);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
