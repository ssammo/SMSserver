var express = require('express');
var axios = require('axios');
var router = express.Router();

require('dotenv').config();

// ** JWT import
var jwt = require('jsonwebtoken');

// ** Import Models
const User = require('../models/user');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.send('Hey man!');
});

/* JWT config */
const jwtConfig = {
  secret: process.env.NEXT_PUBLIC_JWT_SECRET,
  expirationTime: process.env.NEXT_PUBLIC_JWT_EXPIRATION,
  refreshTokenSecret: process.env.NEXT_PUBLIC_JWT_REFRESH_TOKEN_SECRET
}

/* Post Login Cardinalities */
router.post('/jwt/login', async function(req, res, next) {

  const { email, password } = req.body;
  let error = {
    email: ['Something went wrong']
  }
  console.log(email+" ||"+password);
  const user = await User.findOne({email , password});
  console.log(user);
  if (user) {
    const accessToken = jwt.sign({ id: user.id }, jwtConfig.secret, { expiresIn: jwtConfig.expirationTime })
    const response = {
      accessToken,
      userData: { ...user._doc , password: undefined }
    }
    res.status(200).send(response);
  } else {
    error = {
      email: ['email or Password is Invalid']
    }
    res.status(400).send(error);
  }
});

router.get('/auth/me', async function(req, res, next) {
  const token = req.headers.authorization
  jwt.verify(token, jwtConfig.secret, async (err, decoded) => {
    // ** If token is expired
    if (err) {
      if(err.name=='TokenExpiredError'){
        const oldTokenDecoded = jwt.decode(token, { complete: true })
        const { id: userId } = oldTokenDecoded.payload
        const user = await User.findOne({ id: userId })
          const accessToken = jwt.sign({ id: userId }, jwtConfig.secret, {
            expiresIn: jwtConfig.expirationTime
          })
          //Need to add TToken Here too
          const obj = { accessToken, userData: { ...user._doc, password: undefined } }
          res.status(200).send(obj);
      }
      else{
        //Send Auth Error
        res.status(401).send();
      }
    } else {
      // ** If token is valid do nothing
      // @ts-ignore
      const userId = decoded.id
      const user = await User.findOne({ id: userId })
      const obj = { accessToken: token, userData: { ...user._doc , password: undefined } }
      res.status(200).send(obj);
    }
  })
});

// router.get('/newCount', async function(req,res){
//   const receivingPhoneNumber="14143107099,16122941086,18162084008,19209667174,12097142411,13139153090,19252768578,19177750921,19177750904,19203758585,18039878979";
//   const receivingPhoneNumbers = receivingPhoneNumber.split(',').map((item) => item.trim());

// const result = await Chat.aggregate([
//   {
//     $match: {
//       $and: [
//         { receivingPhoneNumber: { $in: receivingPhoneNumbers } },
//         { 'feedback.isSeen': false },
//       ],
//     },
//   },
//   {
//     $group: {
//       _id: '$receivingPhoneNumber',
//       count: { $sum: 1 },
//     },
//   },
// ]);

// console.log(result);

// });

module.exports = router;
