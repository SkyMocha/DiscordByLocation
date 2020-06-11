const express = require('express');
var path = require('path');
var bodyParser = require('body-parser')
const fs = require ('fs');
const app = express();
const port = 3000

var MongoClient = require('mongodb').MongoClient;
const config = require(path.join(__dirname + '/config.json'));
var url = config.mongo_url;
var servers, users;

var DiscordStrategy = require('passport-discord').Strategy;
var passport = require('passport');
app.use(passport.initialize());

const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();

var countyList = JSON.parse(fs.readFileSync(path.join(__dirname + '/gz_2010_us_050_00_20m.json'))).features;

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

// Connects to the Mongo Database
MongoClient.connect(url, { useUnifiedTopology: true }, function(err, db) {
  if (err) throw err;
  var dbo = db.db("DiscByLocation");
  servers = dbo.collection("Servers");
  users = dbo.collection("Users");

  // Listens on port 3000
  app.listen(port, () => console.log(`Discord By Location running at http://localhost:${port}`))

});

// Main page
app.get('/',function(req,res) {
  res.sendFile(path.join(__dirname + '/templates/index.html'));
});

// Register page
app.get('/register',function(req,res) {
  res.sendFile(path.join(__dirname + '/templates/register.html'));
});

// Login page
app.get('/login',function(req,res) {
  res.sendFile(path.join(__dirname + '/templates/login.html'));
});


// Passport Config
// require('./config/passport')(passport);
// // Passport Middleware
// app.use(passport.initialize());
// app.use(passport.session());

// app.get('*', function(req, res, next){
//   res.locals.user = req.user || null;
//   next();
// });

// Get all servers
app.get ('/api/servers', function (req, res) {

  servers.find({}).toArray(function(err, result) {
    if (err) throw err;
    console.log ("FETCHING RESULT");
    // console.log (result);
    res.json ({ result });
  });

})

// Adds a server to the Mongo database
app.post ('/api/add', function (req, res) {

  console.log (req.body);

  let newServ = {
    id: req.body.id,
    disc_server: req.body.disc_url,
    name: req.body.name,
    state: req.body.state,
    county: req.body.county,
    desc: req.body.desc,
  };

  servers.insertOne(newServ, function(err, result) {
    if (err) throw err;
    console.log("Inserted " + newServ);
    res.end();
  });

}); 

// Returns a list of servers depending on if it is given a state CODE and/or a county name
app.post ('/api/sort', function (req, res) {

  let fState = req.body.state;
  let fCounty = req.body.county;
  let final = [];

  console.log (`ATTEMPTING TO SORT BY: ${fState} | ${fCounty}`);

  // Sorts by state
  servers.find({ state: fState }).toArray(function(err, result) {
    if (err) throw err;

    // Sorts by county
    if (fCounty != undefined) {
      result.forEach (match => {
        if (match.county == fCounty)
          final.push (match);
      })
      res.json ( { final } )
    }
    // Returns state results if not searching by county AND state
    else
      res.json ({ result })
  });

});

// Gets all the counties for a specific state CODE
app.post ('/api/counties', function (req, res) {

  console.log ("LOADING COUNTIES");

  var counties = [];

  countyList.forEach (county => {
    // console.log (`${county.properties.STATE} | ${req.body.state}`);
    if (county.properties.STATE == req.body.state)
      counties.push (county.properties.NAME);
  }) 

  console.log (`${counties.length} COUNTIES LOADED`);

  res.json (counties);

}); 


// DISCORD AUTHENTICATION

var DiscordStrategy = require('passport-discord').Strategy;

var rand = function() { return Math.random().toString(36).substr(2); };

passport.use(new DiscordStrategy(
  {
    clientID: '705101854371217418',
    clientSecret: config.o2auth_secret,
    callbackURL: `/auth/callback`,
    scope: ['identify', 'email', 'guilds'],
  },
  function(accessToken, refreshToken, profile, cb) {
  
    return cb( false, { token: accessToken } );

  })
);

passport.serializeUser(function(user, done) {
  // console.log (user);
  done(null, user);
});
passport.deserializeUser(function(user, done) {
  // console.log (user);
  done(null, user);
});

// Authenticates them
app.get('/auth', passport.authenticate('discord'));

app.get(`/auth/callback`, passport.authenticate('discord', {
  failureRedirect: `https://www.skymocha.net`
}), function(req, res) {

  let random_token = rand() + rand(); // Creates a user-specific random token

  let user = req.user; // The user with the data for the user as well as the user ID

  console.log (req.user);

  let mongo_user = {
    accessToken: user.token,
    random_token: [random_token]
  }

  addOrUpdateUser(mongo_user)

  res.redirect(`/?token=${random_token}`) // Successful auth with the random_token
  res.end();
});

// Looks to see if there is a user, if there is it updates it, if not it adds the new random_token
function addOrUpdateUser (mongo_user) {
  users.find({ accessToken: mongo_user.accessToken }).toArray(function(err, result) {
    if (err) throw err;

    // NOTHING FOUND; INSERT NEW USER
    if (result.length == 0) {

      users.insertOne(mongo_user, function(err, result) {
        if (err) throw err;
      });

    }

    // HAS ALREADY LOGGED IN BEFORE (CLEARED CACHE)
    else {

      result[0].random_token.push(mongo_user.random_token[0]);

      let updatedUser = {
        accessToken: mongo_user.accessToken,
        random_token: result[0].random_token
      }
      users.replaceOne ({accessToken: updatedUser.accessToken}, updatedUser, function(err) {
        if (err) throw err;
      });

    }
    
  });
}

// Gets the user based on the random token
app.post ('/api/user', function (req, res) {

  console.log (req.body);
  let random_token = req.body.random_token;
  console.log (random_token);

  // Finds the mongoDB access token for Discord and returns the Discord User
  users.find ( { $random_token: random_token } ).toArray(function(err, result) { 
    console.log (result);
    oauth.getUser(result[0].accessToken).then( token => res.json(token) );
  });

}); 
