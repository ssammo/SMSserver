require('dotenv').config();

const express = require('express');
const router = express.Router();
const Chat = require('../models/chat'); // Import the Chat model
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const imagePath = path.join(__dirname, '..', 'public', 'images');
const LocalImgUrl = process.env.IMAGE_URL;
var telnyx = require('telnyx')(process.env.TELNYX_KEY);

const storage = multer.diskStorage({

  destination: imagePath, // Specify the directory to save the files
  filename: function (req, file, cb) {
    // Generate a unique filename (you can use a package like `uuid`)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = uniqueSuffix + '-' + file.originalname;
    cb(null, filename);
  },
});

const upload = multer({ storage: storage });
// Create a new chat message
router.post('/', async (req, res) => {
  try {
    const { senderPhoneNumber, receivingPhoneNumber, message, imageUrls } = req.body;
    console.log(req.body);

    // Create a new chat document
    const newChat = new Chat({
      senderPhoneNumber,
      receivingPhoneNumber,
      message,
      imageUrls,
    });

    // Save the chat message to the database
    await newChat.save();

    res.status(201).json(newChat); // Respond with the created chat message
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Define a route for receiving incoming messages from Telnyx

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


router.post('/webhook', async (req, res) => {
  try {
    console.log(req.body);
    //console.log(JSON.stringify(req.body));
    if(req.body.data.event_type=='message.received'){
      const { from, to, text, media } = req.body.data.payload;
      const chat = new Chat({
        senderPhoneNumber: from.phone_number,
        receivingPhoneNumber: to[0].phone_number,
        message: text,
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

router.post('/call/webhook', async (req, res) => {
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

router.post('/send/:receivingPhoneNumber', upload.single('image'), async (req, res) => {
  try {

    const receivingPhoneNumber = req.params.receivingPhoneNumber;
    const { data } = req.body;
    dataObj = JSON.parse(data);

    const newMessageData = {
      senderId: receivingPhoneNumber,
      time: new Date(),
      message: dataObj.message,
      feedback: {
        isSent: true,
        isSeen: false,
        isDelivered: false
      }
    }

    const chat = new Chat({
      senderPhoneNumber: receivingPhoneNumber,
      receivingPhoneNumber: dataObj.contact.fullName,
      message: dataObj.message,
    });
    let imageUrl = null;

    // Check if an image was uploaded and set imageUrl accordingly
    if (req.file) {
      imageUrl = `${req.file.filename}`;
      chat.imageUrls[0] = LocalImgUrl + imageUrl;
      newMessageData.img = chat.imageUrls[0];

      telnyx.messages.create(
        {
           'from': receivingPhoneNumber, // Your Telnyx number
           'to': dataObj.contact.fullName,
           'media_urls': chat.imageUrls
         },
         async function(err, response) {
          if(response){
            console.log(response);
            chat.tId=response.data.id;
            chat.feedback.isSent=true;
            await chat.save();
            const responsex = { newMessageData, id: dataObj.contact.id }
            res.status(201).json(responsex);
          }
          if(err){
            console.log(err);
            res.status(500).json({ error: 'Internal Server Error' });
          }
         }
       );
    }
    else{
      telnyx.messages.create(
        {
          'from': receivingPhoneNumber, // Your Telnyx number
          'to': dataObj.contact.fullName,
          'text': dataObj.message
        },
        async function(err, response) {
          // asynchronously called
          // WTF I will do here!!??
          console.log(response);
          if(response){
            chat.tId=response.data.id;
            chat.feedback.isSent=true;
            await chat.save();
            const responsex = { newMessageData, id: dataObj.contact.id }
            res.status(201).json(responsex);
          }
          if(err){
            console.log(err);
            res.status(500).json({ error: 'Internal Server Error' });
          }
        }
      );
    }
    
  } catch (error) {
    console.error('Error processing incoming message:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/:receivingPhoneNumber', async (req, res) => {
  try {
    const receivingPhoneNumber = req.params.receivingPhoneNumber;
    const data = {
      profileUser: {
        id: 11,
        avatar: '/images/avatars/1.png',
        fullName: 'John Doe',
        role: 'admin',
        about:
          'Dessert chocolate cake lemon drops jujubes. Biscuit cupcake ice cream bear claw brownie brownie marshmallow.',
        status: 'online',
        settings: {
          isTwoStepAuthVerificationEnabled: true,
          isNotificationsOn: false
        }
      },
      contacts: [],
      chats: []
    }

    const resChat = await Chat.find({
      $or: [{ senderPhoneNumber: receivingPhoneNumber }, { receivingPhoneNumber: receivingPhoneNumber }]
    }).sort({ timestamp: -1 });
    var contactCounter = 0;
    resChat.forEach(result => {
      var contactNumber = result.senderPhoneNumber == receivingPhoneNumber ? result.receivingPhoneNumber : result.senderPhoneNumber;
      var contactx = data.contacts.find(c => c.fullName == contactNumber);
      if (contactx == undefined) {
        contactCounter++;
        var contact = {
          id: contactNumber,
          fullName: contactNumber,
          role: 'None',
          about: 'Hola',
          status: 'offline'
        }
        data.contacts.push(contact);
        //chatx==conversation
        var chatx = {
          id: contactNumber,
          userId: contactNumber,
          unseenMsgs: 0,
          chat: []
        }
        var chati = {
          message: result.message,
          img: result.imageUrls[0], //Need to update
          time: result.timestamp,
          senderId: result.senderPhoneNumber,
          feedback: {
            isSent: result.feedback.isSent,
            isDelivered: result.feedback.isDelivered,
            isSeen: result.feedback.isSeen
          }
        }
        if(contactNumber==result.senderPhoneNumber && !result.feedback.isSeen) chatx.unseenMsgs++;
        chatx.chat.push(chati);
        data.chats.push(chatx);
      }
      else {
        var chatx = data.chats.find(c => c.userId == contactNumber);
        if(contactNumber==result.senderPhoneNumber && !result.feedback.isSeen) chatx.unseenMsgs++;
        var chati = {
          message: result.message,
          img: result.imageUrls[0], //Need to update
          time: result.timestamp,
          senderId: result.senderPhoneNumber,
          feedback: {
            isSent: result.feedback.isSent,
            isDelivered: result.feedback.isDelivered,
            isSeen: result.feedback.isSeen
          }
        }
        chatx.chat.push(chati);
      }

    });


    const chatsContacts = data.chats.map(chat => {
      const contact = data.contacts.find(c => c.id === chat.id)

      // @ts-ignore
      contact.chat = { id: chat.id, unseenMsgs: chat.unseenMsgs, lastMessage: chat.chat[0] }

      return contact
    })

    const contactsToShow = data.contacts.filter(co => {
      return !data.chats.some(ch => {
        return co.id === ch.id
      })
    })

    const profileUserData = {
      id: data.profileUser.id,
      avatar: data.profileUser.avatar,
      fullName: data.profileUser.fullName,
      status: data.profileUser.status
    }

    var returnValue = {
      chatsContacts,
      contacts: contactsToShow,
      profileUser: profileUserData
    }
    res.json(returnValue); // Respond with the list of chats
  } catch (error) {
    console.error('Error retrieving chats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/get-chat/:receivingPhoneNumber/:id', async (req, res) => {
  try {
    const receivingPhoneNumber = req.params.receivingPhoneNumber;
    const userId = req.params.id;

    // Query the database to find all chats with the specified sender phone number
    //const chats = await Chat.find({ receivingPhoneNumber });
    //const senders = await Chat.distinct('senderPhoneNumber', { receivingPhoneNumber });

    const data = {
      profileUser: {
        id: 11,
        avatar: '/images/avatars/1.png',
        fullName: 'John Doe',
        role: 'admin',
        about:
          'Dessert chocolate cake lemon drops jujubes. Biscuit cupcake ice cream bear claw brownie brownie marshmallow.',
        status: 'online',
        settings: {
          isTwoStepAuthVerificationEnabled: true,
          isNotificationsOn: false
        }
      },
      contacts: [],
      chats: []
    }

    const resChat = await Chat.find({
      $or: [
        { $and: [{ senderPhoneNumber: receivingPhoneNumber }, { receivingPhoneNumber: userId }] },
        { $and: [{ senderPhoneNumber: userId }, { receivingPhoneNumber: receivingPhoneNumber }] }
      ]
    });



    var contactCounter = 0;
    resChat.forEach(async result => {
      var contactNumber = result.senderPhoneNumber == receivingPhoneNumber ? result.receivingPhoneNumber : result.senderPhoneNumber;
      
      //Need to change on focus
      // if(contactNumber==result.senderPhoneNumber && !result.feedback.isSeen) {
      //   result = await Chat.findOneAndUpdate(
      //     { _id: result._id, 'feedback.isSeen': false }, // find the specific document
      //     { $set: { 'feedback.isSeen': true } }, // update the isSeen property to true
      //      { new: true } // return the updated document
      //   );
      // }

      var contactx = data.contacts.find(c => c.fullName == contactNumber);
      if (contactx == undefined) {
        contactCounter++;
        var contact = {
          id: contactNumber,
          fullName: contactNumber,
          role: 'None',
          about: 'Hola',
          status: 'offline'
        }
        data.contacts.push(contact);
        var chatx = {
          id: contactNumber,
          userId: contactNumber,
          unseenMsgs: 0,
          chat: []
        }
        var chati = {
          message: result.message,
          img: result.imageUrls[0], //Need to update
          time: result.timestamp,
          senderId: result.senderPhoneNumber,
          feedback: {
            isSent: result.feedback.isSent,
            isDelivered: result.feedback.isDelivered,
            isSeen: result.feedback.isSeen
          }
        }
        chatx.chat.push(chati);
        data.chats.push(chatx);
      }
      else {
        var chatx = data.chats.find(c => c.userId == contactNumber);
        var chati = {
          message: result.message,
          img: result.imageUrls[0], //Need to update
          time: result.timestamp,
          senderId: result.senderPhoneNumber,
          feedback: {
            isSent: result.feedback.isSent,
            isDelivered: result.feedback.isDelivered,
            isSeen: result.feedback.isSeen
          }
        }
        chatx.chat.push(chati);
      }

    });

    const chat = data.chats.find(c => c.id == userId)
    if (chat) chat.unseenMsgs = 0
    const contact = data.contacts.find(c => c.id == userId)
    // @ts-ignore
    //if (contact.chat) contact.chat.unseenMsgs = 0

    var returnValue = {
      chat,
      contact
    }

    res.json(returnValue); // Respond with the list of chats
  } catch (error) {
    console.error('Error retrieving chats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/add/:receivingPhoneNumber/:contactNumber', async (req, res) => {
  try {
    const receivingPhoneNumber = req.params.receivingPhoneNumber;
    const contactNumber = req.params.contactNumber;

    try {
      const chat = new Chat({
        senderPhoneNumber: contactNumber,
        receivingPhoneNumber: receivingPhoneNumber,
        message: "New Contact Added",
      });
      await chat.save();
      res.status(201).json({ message: 'Message saved successfully' });

    } catch (error) {
      console.error('Error processing incoming message:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }

  } catch (error) {
    console.error('Error retrieving chats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/focus/:receivingPhoneNumber/:contactNumber', async (req, res) => {
  try {
    const receivingPhoneNumber = req.params.receivingPhoneNumber;
    const contactNumber = req.params.contactNumber;

    // Filtering the documents where feedback.isSeen is false
    const filter = { $and:  [{ senderPhoneNumber: contactNumber }, { receivingPhoneNumber: receivingPhoneNumber }, { 'feedback.isSeen': false }] };

    // Update operation
    const update = { $set: { 'feedback.isSeen': true } };

    // Update multiple documents at once
    await Chat.updateMany(filter, update);
    res.status(200).send("Update success");


  } catch (error) {
    console.error('Error retrieving chats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
module.exports = router;
