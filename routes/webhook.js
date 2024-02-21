const express = require('express');
const router = express.Router();
const Chat = require('../models/chat'); 
const User = require('../models/user');

    
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
        const { from, to, text, media } = req.body.data.payload;
        const chat = new Chat({
          senderPhoneNumber: from.phone_number,
          receivingPhoneNumber: to[0].phone_number,
          message: text
        });
        if (media.length > 0) {
          chat.imageUrls = [media[0].url];
          chat.cost = 0.04;
        }
        else chat.cost = 0.02;
        await chat.save();
        const phoneNumber = to[0].phone_number ;
        const numericPhoneNumber = phoneNumber.replace(/\D/g, '');
        const user = await User.findOne({ numbers: { $regex: numericPhoneNumber } }).exec();
        if (!user) {
            console.log('No user found with phone number:', phoneNumber);
            return;
          }
        
          // User found
          console.log('User found:', user);
          user.balance -= chat.cost;
          await user.save();

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
        const { from, to, start_time } = req.body.data.payload;
        const { occurred_at } = req.body.data;

        // Convert the timestamps to Date objects
        const startTime = new Date(start_time);
        const occurredAt = new Date(occurred_at);

        // Calculate the duration in milliseconds
        const durationInMilliseconds = occurredAt - startTime;

        // Convert milliseconds to seconds
        const durationInSeconds = durationInMilliseconds / 1000;
        const minutes = Math.ceil(durationInSeconds / 60);

        console.log("Duration of the call:", durationInSeconds, "seconds");

        const chat = new Chat({
          senderPhoneNumber: to,
          receivingPhoneNumber: from,
          message: "Call Ended",
          cost: minutes * 0.02
        });
        await chat.save();

        const phoneNumber1 = to.replace(/\D/g, '');
        const phoneNumber2 = from.replace(/\D/g, '');
        const user = await User.findOne({ $or: [ {numbers:{ $regex: phoneNumber1 } },{numbers:{ $regex: phoneNumber2 } } ]} ).exec();
        if (!user) {
            console.log('No user found with phone number:', phoneNumber);
            return;
          }
        
          // User found
          console.log('User found:', user);
          user.balance -= chat.cost;
          await user.save();

      }
      
  
      res.status(201).json({ message: 'Message saved successfully' });
    } catch (error) {
      console.error('Error processing incoming message:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  module.exports = router;
  