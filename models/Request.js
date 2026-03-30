const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    enum: ['employee', 'manager', 'director', 'administrator'],
    required: true
  },
  type: {
    type: String,
    enum: [
      'vacation',
      'pto',
      'marriage',
      'maternity',
      'paternity',
      'birthday',
      'death-immediate',
      'death-family',
      'pet-death',
      'medical-leave',
      'special'
    ],
    required: true,
    index: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  days: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  approverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approverName: {
    type: String,
    default: null
  },
  comments: {
    type: String,
    default: ''
  },
  backfill: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Virtual field para compatibilidad con frontend
requestSchema.virtual('id').get(function() {
  return this._id.toString();
});

requestSchema.set('toJSON', { virtuals: true });
requestSchema.set('toObject', { virtuals: true });

// Índice compuesto para queries frecuentes
requestSchema.index({ userId: 1, status: 1 });
requestSchema.index({ status: 1, startDate: -1 });

module.exports = mongoose.model('Request', requestSchema);