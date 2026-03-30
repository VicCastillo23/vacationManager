const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['employee', 'manager', 'director', 'administrator'],
    default: 'employee'
  },
  team: {
    type: String,
    default: 'Sin asignar'
  },
  managerId: {
    type: String,
    default: null
  },
  hireDate: {
    type: Date,
    required: true
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Excluir password al serializar a JSON
      if (ret.password) delete ret.password;
      return ret;
    }
  }
});

// Virtual field para compatibilidad con frontend
userSchema.virtual('id').get(function() {
  return this._id.toString();
});

userSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    if (ret.password) delete ret.password;
    return ret;
  }
});
userSchema.set('toObject', { virtuals: true });

// Índices para mejorar rendimiento
userSchema.index({ team: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);