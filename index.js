const express = require('express');
var path = require('path');
var bodyParser = require('body-parser')
const fs = require ('fs');
const app = express();
const port = 3000

var MongoClient = require('mongodb').MongoClient;
const config = require(path.join(__dirname + '/config.json'));
var url = config.mongo_url;
var servers;

var countyList = JSON.parse(fs.readFileSync(path.join(__dirname + '/gz_2010_us_050_00_20m.json'))).features;

app.use(bodyParser.urlencoded());
app.use(express.static(__dirname + '/public'));

// Connects to the Mongo Database
MongoClient.connect(url, { useUnifiedTopology: true }, function(err, db) {
  if (err) throw err;
  var dbo = db.db("DiscByLocation");
  servers = dbo.collection("Servers");

  console.log (servers);

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