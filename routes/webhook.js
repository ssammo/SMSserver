const express = require('express');
const router = express.Router();
const Chat = require('../models/chat'); 

    
const updateChatFeedback = async (id) => {
    try {
      const updatedChat = await Chat.findOneAndUpdate(
        { tId: id },
        { $set: { 'feedback.isDelivered': true } },
        { new: true }
      );
  
      if (updatedChat) {
        console.log('Chat feedback updated successfully:', updatedChat);
      } else {
        console.log('No chat found with the provided id.');
      }
    } catch (error) {
      console.error('Error updating chat feedback:', error);
    }
};
  
  const updateFinalChatFeedback = async (id) => {
    try {
      const updatedChat = await Chat.findOneAndUpdate(
        { tId: id },
        { $set: { 'feedback.isSeen': true } },
        { new: true }
      );
  
      if (updatedChat) {
        console.log('Chat feedback updated successfully:', updatedChat);
      } else {
        console.log('No chat found with the provided id.');
      }
    } catch (error) {
      console.error('Error updating chat feedback:', error);
    }
  };
  
  router.post('/sms', async (req, res) => {
    try {
      //console.log(req.body);
      console.log(JSON.stringify(req.body));
      if(req.body.data.event_type=='message.received'){
        const { from, to, text, media, cost } = req.body.data.payload;
        let costx = 0;
        if(cost != null) costx = cost.amount;
        const chat = new Chat({
          senderPhoneNumber: from.phone_number,
          receivingPhoneNumber: to[0].phone_number,
          message: text,
          costx: cost
        });
        if (media.length > 0) chat.imageUrls = [media[0].url];
  
        await chat.save();
      }
  
      if(req.body.data.event_type=='message.sent'){
        const { id } = req.body.data.payload;
        updateChatFeedback(id);
        
      }
  
      if(req.body.data.event_type=='message.finalized'){
        const { id } = req.body.data.payload;
        updateFinalChatFeedback(id);
        
      }
      
  
      res.status(201).json({ message: 'Message saved successfully' });
    } catch (error) {
      console.error('Error processing incoming message:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  router.post('/call', async (req, res) => {
    try {
      console.log(req.body);
      //console.log(JSON.stringify(req.body));
      if(req.body.data.event_type=='call.initiated'){
        const { from, to } = req.body.data.payload;
        const chat = new Chat({
          senderPhoneNumber: from,
          receivingPhoneNumber: to,
          message: "Started Phone Call",
        });
        await chat.save();
      }
      else if(req.body.data.event_type=='call.answered'){
        const { from, to } = req.body.data.payload;
        const chat = new Chat({
          senderPhoneNumber: to,
          receivingPhoneNumber: from,
          message: "Answered Phone Call",
        });
        await chat.save();
      }
      else if(req.body.data.event_type=='call.hangup'){
        const { from, to } = req.body.data.payload;
        const chat = new Chat({
          senderPhoneNumber: to,
          receivingPhoneNumber: from,
          message: "Call Ended",
        });
        await chat.save();
      }
      
  
      res.status(201).json({ message: 'Message saved successfully' });
    } catch (error) {
      console.error('Error processing incoming message:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  module.exports = router;
  