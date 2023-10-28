const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  id: {
    type: Number,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
