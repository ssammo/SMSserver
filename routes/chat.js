const express = require('express');
const router = express.Router();
const Chat = require('../models/chat'); // Import the Chat model
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const imagePath = path.join(__dirname, '..', 'public', 'images');
const LocalImgUrl = "http://localhost:5000/images/"
var telnyx = require('telnyx')('YOUR_API_KEY');

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
router.post('/webhook', async (req, res) => {
  try {
    console.log(req.body);
    console.log(JSON.stringify(req.body));
    const { from, to, text, media } = req.body.data.payload;

    // Create a new Chat document and save it to MongoDB
    const chat = new Chat({
      senderPhoneNumber: from.phone_number,
      receivingPhoneNumber: to[0].phone_number,
      message: text,
    });
    if (media.length > 0) chat.imageUrls = [media[0].url];

    await chat.save();

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
         function(err, response) {
           // asynchronously called
           console.log(response)
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
        function(err, response) {
          // asynchronously called
          console.log(response);
        }
      );
    }
    await chat.save();
    //Here I am going to send sms
    telnyx.messages.create(
      {
        'from': receivingPhoneNumber, // Your Telnyx number
        'to': dataObj.contact.fullName,
        'text': dataObj.message
      },
      function(err, response) {
        // asynchronously called
        console.log(response);
      }
    );

    const response = { newMessageData, id: dataObj.contact.id }
    res.status(201).json(response);
  } catch (error) {
    console.error('Error processing incoming message:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// Retrieve all chat messages
// Define a route to get all chats of a specific sender phone number
router.get('/:receivingPhoneNumber', async (req, res) => {
  try {
    const receivingPhoneNumber = req.params.receivingPhoneNumber;

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

    // const results = await Chat.aggregate([
    //   {
    //     $match: { receivingPhoneNumber },
    //   },
    //   {
    //     $sort: { timestamp: -1 }, // Sort chats by timestamp in descending order (newest first)
    //   },
    //   {
    //     $group: {
    //       _id: '$senderPhoneNumber',
    //       lastChat: { $first: '$$ROOT' }, // Get the first (latest) chat message for each sender
    //     },
    //   },
    //   {
    //     $replaceRoot: { newRoot: '$lastChat' }, // Replace the root document with the last chat message
    //   },
    // ]);
    const resChat = await Chat.find({
      $or: [{ senderPhoneNumber: receivingPhoneNumber }, { receivingPhoneNumber: receivingPhoneNumber }]
    })
    var contactCounter = 0;
    resChat.forEach(result => {
      var contactNumber = result.senderPhoneNumber == receivingPhoneNumber ? result.receivingPhoneNumber : result.senderPhoneNumber;
      var contactx = data.contacts.find(c => c.fullName == contactNumber);
      if (contactx == undefined) {
        contactCounter++;
        var contact = {
          id: contactCounter,
          fullName: result.senderPhoneNumber,
          role: 'None',
          about: 'Hola',
          status: 'offline'
        }
        data.contacts.push(contact);
        var chatx = {
          id: contactCounter,
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
            isSeen: false
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
            isSeen: false
          }
        }
        chatx.chat.push(chati);
      }

    });


    const chatsContacts = data.chats.map(chat => {
      const contact = data.contacts.find(c => c.id === chat.id)

      // @ts-ignore
      contact.chat = { id: chat.id, unseenMsgs: chat.unseenMsgs, lastMessage: chat.chat[chat.chat.length - 1] }

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
      $or: [{ senderPhoneNumber: receivingPhoneNumber }, { receivingPhoneNumber: receivingPhoneNumber }]
    })
    var contactCounter = 0;
    resChat.forEach(result => {
      var contactNumber = result.senderPhoneNumber == receivingPhoneNumber ? result.receivingPhoneNumber : result.senderPhoneNumber;
      var contactx = data.contacts.find(c => c.fullName == contactNumber);
      if (contactx == undefined) {
        contactCounter++;
        var contact = {
          id: contactCounter,
          fullName: result.senderPhoneNumber,
          role: 'None',
          about: 'Hola',
          status: 'offline'
        }
        data.contacts.push(contact);
        var chatx = {
          id: contactCounter,
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
            isSeen: false
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
            isSeen: false
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
module.exports = router;
