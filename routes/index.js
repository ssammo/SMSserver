var express = require('express');
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
  console.log(JSON.stringify(req.body));

  const { email, password } = req.body;

  let error = {
    email: ['Something went wrong']
  }
  console.log(email+" ||"+password);
  const user = await User.findOne({email: email , password: password});
  console.log(user);
  if (user) {
    const accessToken = jwt.sign({ id: user.id }, jwtConfig.secret, { expiresIn: jwtConfig.expirationTime })

    const response = {
      accessToken,
      userData: { ...user, password: undefined }
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
  
  const token = req.headers.Authorization
  console.log("Token: "+token);
  // ** Checks if the token is valid or expired
  jwt.verify(token, jwtConfig.secret, (err, decoded) => {
    // ** If token is expired
    if (err) {
      if(err.name=='TokenExpiredError'){
        const oldTokenDecoded = jwt.decode(token, { complete: true })
        const { id: userId } = oldTokenDecoded.payload
        const user = User.findOne({ id: userId }, user => {
          // ** Sign a new token
          const accessToken = jwt.sign({ id: userId }, jwtConfig.secret, {
            expiresIn: jwtConfig.expirationTime
          })
          const obj = { accessToken, userData: { ...user, password: undefined } }
          res.status(200).send(obj);
        })
          
      }
      else{
        //Send Auth Error
        res.status(401).send();
      }
    } else {
      // ** If token is valid do nothing
      // @ts-ignore
      const userId = decoded.id
      const user = User.findOne({ id: userId }, user => {
        const obj = { accessToken: token, userData: { ...user, password: undefined } }
        res.status(200).send(obj);
      })
    }
  })
});

module.exports = router;
