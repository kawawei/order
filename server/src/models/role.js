const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true
  },
  name: {
    type: String,
    required: [true, '請提供角色名稱'],
    trim: true
  },
  permissions: {
    type: [String],
    default: []
  },
  isSystem: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

roleSchema.index({ merchant: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);


