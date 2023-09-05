const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  senderPhoneNumber: {
    type: String,
    required: true,
  },
  receivingPhoneNumber: {
    type: String,
    required: true,
  },
  message: {
    type: String,
  },
  imageUrls: [{
    type: String,
  }],
  timestamp: {
    type: Date,
    default: Date.now,
  },
  feedback: {
    isSent: {
      type: Boolean,
      default: false, // You can set a default value if needed
    },
    isDelivered: {
      type: Boolean,
      default: false, // You can set a default value if needed
    },
  },
});

module.exports = mongoose.model('Chat', chatSchema);
