const express = require('express');
const router = express.Router();
const passport = require('passport');
const { User } = require('../models/user');
const async = require('async');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

//landing page
router.get('/', (req, res) => {
  res.render('landing', {title: 'Sartorius | Sign In', layout: 'no-header'});
});

//index route
router.get('/index', (req, res) => {
  res.render('index', {title: 'Sartorius | Home'});
});

//create new account - show
router.get('/register', (req, res) => {
  res.render('register', {title: 'Sartorius | Create Account'});
});

//create new account - post
router.post('/register', (req, res) => {
  const newUser = new User({
    username: req.body.username,
    email: req.body.email
  });
  User.register(newUser, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      return res.render('register', { error: err.message });
    }
    passport.authenticate('local')(req, res, function () {
      req.flash('success', `Welcome ${req.body.username}! You've successfully created an account.`)
      res.redirect('/index');
    });
  });
});

//Log in
router.post('/login', passport.authenticate('local', {
  successRedirect: '/index',
  failureRedirect: '/register'
}));
//log out
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

//User - show
router.get('/users/:id', (req, res) => {
  User.findById(req.params.id, (err, foundUser) => {
    if (err) {
      res.render('index', {error: 'Oops! Profile not found'});
    } else {
      res.render('userProfile', {user: foundUser, title: 'Sartorius | Profile'});
    };
  });
});

//password reset - show
router.get('/forgot', (req, res) => {
  res.render('forgot');
});
//password reset - POST
router.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'gmail', 
        auth: {
          user: 'ericpratt86@gmail.com',
          pass: process.env.GMAILPW
        },
        tls: {rejectUnauthorized: false}
      });
      var mailOptions = {
        to: user.email,
        from: 'ericpratt86@gmail.com',
        subject: 'Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

//once user clicks on email from above, send here
router.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('reset', {token: req.params.token});
  });
});

router.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if(req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, function(err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          })
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect('back');
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'ericpratt86@gmail.com',
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'ericpratt86@mail.com',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/index');
  });
});

module.exports = router;