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
    
    var data = JSON.stringify({});
    const YOUR_API_KEY = 'KEY0184ECC16BEF4283F3D9E3DAECF94E2A_meL4LKx2rdobYfB6I9FCuC';
    const credentialId = '1adfdb6e-5d76-4446-a673-e1c5a2a52af3'; 
    const TelnyxToken = await axios.post(
      `https://api.telnyx.com/v2/telephony_credentials/${credentialId}/token`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${YOUR_API_KEY}`,
        },
      }
    );

    const TToken = TelnyxToken.data; 
    console.log("Telnyx Token: "+ TToken);

    const response = {
      accessToken,
      TToken,
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
   // ** Get token from header
  // @ts-ignore
  
  const token = req.headers.authorization
  console.log("Token: "+token);
  // ** Checks if the token is valid or expired
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

module.exports = router;
