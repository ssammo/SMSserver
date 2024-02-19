const express = require('express');

const User = require('../models/user'); // Assuming you have a User model
var jwt = require('jsonwebtoken');

/* JWT config */
const jwtConfig = {
    secret: process.env.NEXT_PUBLIC_JWT_SECRET,
    expirationTime: process.env.NEXT_PUBLIC_JWT_EXPIRATION,
    refreshTokenSecret: process.env.NEXT_PUBLIC_JWT_REFRESH_TOKEN_SECRET
  }

const numberCheck = async (req, res, next) => {
    try {
        const token = req.headers.authorization
        let receivingPhoneNumber = req.params.receivingPhoneNumber;
        if (!receivingPhoneNumber) {
            return res.status(400).json({ error: 'Receiving phone number is missing' });
        }
        receivingPhoneNumber = receivingPhoneNumber.replace(/\s+/g, '').replace(/\+/g, '');
        jwt.verify(token, jwtConfig.secret, async (err, decoded) => {
            if (err) {
                return res.status(401).json({ error: 'Unauthorized login' });
            } else {
                const userId = decoded.id
                const user = await User.findOne({ id: userId })
                if (!user.numbers.includes(receivingPhoneNumber)) {
                    return res.status(403).json({ error: 'Unauthorized user for number' });
                }
                else{
                    req.user=user;
                    next();
                }
            }
        })
        
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = numberCheck;