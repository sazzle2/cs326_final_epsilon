'use strict';

// For loading environment variables.
require('dotenv').config();

const expressSession = require('express-session');  // for managing session state

const express = require('express');
const passport = require('passport');               // handles authentication
const LocalStrategy = require('passport-local').Strategy; // username/password strategy
const { MongoClient, ProfilingLevel } = require('mongodb');
const app = express();
app.use(require('body-parser').urlencoded());
const minicrypt = require('./miniCrypt');

const mc = new minicrypt();


const port = process.env.PORT || 8080;

let secrets;
let url;
if (!process.env.URL) {
  secrets = require('./secrets.json');
  url = secrets.url;
} else {
	url = process.env.URL;
}

const client = new MongoClient(url);

app.use(express.static('public'));

const session = {
  secret : process.env.SECRET || 'SECRET', // set this encryption key in Heroku config (never in GitHub)!
  resave : false,
  saveUninitialized: false
};

// Passport configuration

const strategy = new LocalStrategy(
  async (username, password, done) => {
    console.log('start strategy')
    await client.connect();
    const uDine = client.db('UDine'); // if this creates delete
    const logins = uDine.collection('logins');
    const arr = await logins.find().toArray();
  

  if (!findUser(arr, username)) {
      // no such user
      console.log("strategy did not find user");
      return done(null, false, { 'message' : 'Wrong username' });
  }
  if (!(await validatePassword(username, password))) {
      // invalid password
      // should disable logins after N messages
      // delay return to rate-limit brute-force attacks
      await new Promise((r) => setTimeout(r, 2000)); // two second delay
      return done(null, false, { 'message' : 'Wrong password' });
  }
  // success!
  // should create a user object here, associated with a unique identifier
  console.log('success');
  return done(null, username);
});


// App configuration

app.use(expressSession(session));
passport.use(strategy);
app.use(passport.initialize());
app.use(passport.session());

// Convert user object to a unique identifier.
passport.serializeUser((user, done) => {
  done(null, user);
});

// Convert a unique identifier to a user object.
passport.deserializeUser((uid, done) => {
  done(null, uid);
});

app.use(express.static('public'));
app.use(express.json()); // lets you handle JSON input
app.use(express.urlencoded({'extended' : true})); // allow URLencoded data

async function getUsers(){
  await client.connect();
  const uDine = client.db('UDine'); // if this creates delete
  const logins = uDine.collection('logins');
  const arr = await logins.find().toArray();
  return arr;
}

// Returns true iff the user exists.
function findUser(arr, name) {
  console.log("starting find user")

  let b = false;
  arr.forEach((e) => {
    if (e.username === name) {
      console.log("found user " + e.username)
      b = true;
    }
  });
  console.log(b);
  return b;
}

// Returns true iff the password is the one we have stored hashed
async function validatePassword(name, pwd) {
  await client.connect();
  const uDine = client.db('UDine');
  const logins = uDine.collection('logins');
  const arr = await logins.find().toArray();
//   const obj = await logins.find();
//  console.log(obj);
  console.log(arr);
  if (!findUser(arr, name)) {
    console.log('did not find user');
    return false;
  }
  console.log('found user ' + name);
  for(let i = 0; i < arr.length; ++i){
    if(arr[i]['username'] === name){
      if (!mc.check(pwd, arr[i]['password'][0], arr[i]['password'][1])) {
        console.log('password doesnt check');
        return false;
      }else{
        console.log('password correct');
      }
    
    }
  }
  return true;
}

// Add a user to the "database".
// Return true if added, false otherwise (because it was already there).
// TODO
async function addUser(name, pwd) {
    await client.connect();
    const uDine = client.db('UDine'); // if this creates delete
    const logins = uDine.collection('logins');
    const arr = await logins.find().toArray();
    // chceks if user is in 

    if(!findUser(arr, name)){
      const [salt, hash] = mc.hash(pwd);
      await logins.insertOne({
        username: name,
        password: [salt, hash],
        favorites: []
      }); return true;
    } else { 
      return false;
    }
}

app.post('/register',
   async (req, res) => {
    const {username, password, favorites} = req.body;
    if (await addUser(username, password)) {
      res.redirect('/login');
    }else{
      res.redirect('/register');
    }
});


function checkLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
  // If we are authenticated, run the next route.
    next();
  } else {
  // Otherwise, redirect to the login page.
    res.redirect('/login');
  }
}

// Handle post data from the login.html form.
app.post('/login',
 passport.authenticate('local' , {     // use username/password authentication
     'successRedirect' : '/profile',   // when we login, go to /private 
     'failureRedirect' : '/login'      // otherwise, back to login
 }));

// Handle the URL /login (just output the login.html file).
app.get('/login',
  (req, res) => res.sendFile('/public/login.html',
      { 'root' : __dirname }));

// Register URL
app.get('/register',
  (req, res) => res.sendFile('/public/register.html',
         { 'root' : __dirname }));

// Private data
app.get('/profile',
  (req, res) => {
    checkLoggedIn(req, res, () => res.redirect('/profile/' + req.user));
});

// A dummy page for the user.
app.get('/profile/:userID/',
  checkLoggedIn, // We also protect this route: authenticated...
  (req, res) => {
    // Verify this is the right user.
    if (req.params.userID === req.user) {
      res.writeHead(200, {"Content-Type" : "text/html"});

      res.write('<!doctype html><html lang="en"><head><!-- Required meta tags --><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UProfile</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-1BmE4kWBq78iYhFldvKuhfTAU6auU8tT94WrHftjDbrCEXSU1oBoqyl2QvZ6jIW3" crossorigin="anonymous"><link href="https://umassdining.herokuapp.com/profile.css" rel="stylesheet"><link rel="shortcut icon" href="https://umassdining.herokuapp.com/logo.png"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"><script src="https://umassdining.herokuapp.com/profile.js"></script></head><body id="page-top"><div class="navibar"><a class="navibar-center" href="#"><img src="logo.png" width="100" height="100"></a></div><button class="btn-xlarge-left" onclick="location.href="https://umassdining.herokuapp.com/index.html";"><i class="fa fa-search"></i></button><button class="btn-xlarge-right" onclick="location.href="https://umassdining.herokuapp.com/unique.html";"><i class="fas fa-bars"></i></button><br> <br> <br><h1> <u>PROFILE</u> </h1><br><br><div class="row"><div class="column"><h2>Favorites</h2><div class="card" id = "favorites"><h5 class="card-header" id = "favoriteName"></h5><ul class="list-group list-group-flush"><div id="favoriteList"></div></ul></div></div><div class="column"><h2>Add Your Personal Favorites!</h2><div class="input-group mb-3"><input type="text" class="form-control" placeholder="Add Favorite" aria-label="Add Favorite" aria-describedby="basic-addon1" id="adding"></div><br><button type="button" class="btn btn-dark" id = "search"><i>Add To Favorites</i></button><br><br><button type="button" class="btn btn-dark" id = "delete"><i>Delete Account</i></button></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-ka7Sk0Gln4gmtz2MlQnikT1wXgYsOg+OMhuP+IlRH9sENBO0LRn5q+8nbTov4+1p" crossorigin="anonymous"></script></body></html> ');
      // res.write('<H1>HELLO ' + req.params.userID + "</H1>");
      // res.write('<br/><a href="/index.html">click here to go back to the search page</a>');
      res.end();
    } else {
      res.redirect('/profile');
    }
});

async function searcher(str, halal, veg, wGrain) {
  await client.connect();
  const uDine = client.db('UDine');
  const foods = uDine.collection('food');
  const obj = await foods.find({
    'name': {$regex: str},
    "halal": {'$in': halal},
    "vegetarian": {'$in': veg},
    "whole-grain": {'$in': wGrain}
  }).toArray();
  return obj;
}

app.post('/search', async (req, res) => {
    let str = req.body.keyword;
    let halal = req.body.halal;
    let veg = req.body.vegetarian;
    let wGrain = req.body.wholeGrain;
    if(halal) {
      halal = ['Yes'];
    } else {
      halal = ['No', 'Yes'];
    }
    if (veg) {
      veg = ['Yes']; 
    } else {
      veg = ['No', 'Yes'];
    }
    if (wGrain) {
      wGrain = ['Yes'];
    } else {
      wGrain = ['No', 'Yes'];
    }
    res.end(JSON.stringify(await searcher(str, halal, veg, wGrain)));
});

app.get('/unique/view', async (req, res) => {
  // returns all food 
  await client.connect();
  const uDine = client.db('UDine');
  const foods = uDine.collection('food');
  res.end(JSON.stringify(await foods.find({
    date: '11/23/2021'
  }).toArray())); // if not .toArray()  
});

// profile js endpoints
app.get('/user/favorites/view',
  (req, res) => {
	console.log(`${req.user}: from the first endpoint`);
    checkLoggedIn(req, res, () => res.redirect('/user/favorites/view/' + req.user));
});

// req: {"username": "user1", "item": "chicken"}
app.post('/user/favorites/view/:key/', checkLoggedIn, async (req, res) => {
	await client.connect();
	const uDine = client.db('UDine'); // if this creates delete
	const logins = uDine.collection('logins');
	const user = req.params.key;
	console.log(`from post inside key method ${user}`);
	const fav = (await logins.findOne(
		{username: user}
	)).favorites;
	res.end(JSON.stringify(fav)); 
});

app.get('/user/favorites/add',
  (req, res) => {
	console.log(req);
	// const food = req.food;
    checkLoggedIn(req, res, () => res.redirect('/user/favorites/add/' + food + '/' + req.user));
});

app.get('/user/favorites/add/:food/:key/', checkLoggedIn, async (req, res) => {
	await client.connect();
  const uDine = client.db('UDine'); // if this creates delete
  const logins = uDine.collection('logins');
  const user = req.params.key; // how would i change this to express
  const food = req.params.food;
  const result = await logins.findOne(
    {username: user}
  ); const arr = result.favorites;
  const fav = document.getElementById('adding').value;
  res.end(JSON.stringify(await logins.updateOne(
    {username: user},
    {favorites: arr.push(food)}
  ))); // should be pushing it to this arrray
});

app.get('/user/delete',
  (req, res) => {
    checkLoggedIn(req, res, () => res.redirect('/user/delete/' + req.user));
});

app.delete('/user/delete/:key', checkLoggedIn, async (req, res) => {
	await client.connect();
	const uDine = client.db('UDine'); // if this creates delete
	const logins = uDine.collection('logins');
	const user = req.params.key;
	console.log(user);
	logins.removeOne(
	{username: req.params.key}
	);
	res.end();
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
