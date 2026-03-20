const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  accessToken: { type: String },
  refreshToken: { type: String, required: true },
  tokenExpiry: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Token', tokenSchema);