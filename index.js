const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const gmailRoutes = require('./routes/gmail');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/gmail', gmailRoutes);

// Health check
app.get('/', (req, res) => res.send('PocketBalance Backend is running'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));