const express = require("express");
const app = express();
const path = require("path");
const collection = require("./connection");
const alert = require("alert");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const bodyParser = require('body-parser');
require("dotenv").config();

const templatePath = path.join(__dirname, "../templates");

app.use(express.json());
app.set("view engine", "hbs");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.set("views", templatePath);
app.use(express.urlencoded({ extended: false }));
app.use(express.static("templates"));

let tokens = "";
let accountDetails = "";
let email;
let userName;
let userColor;
const users = [];

app.get("/", authenticateToken, (req, res) => {
  res.render("homepage", {name: userName});

  console.log("Logged in successfully");
});

app.get("/home", (req, res) => {
  res.render("homepage", {name: userName});
})
app.get("/about", (req, res) => {
  res.render("about");
})
app.get("/help", (req, res) => {
  res.render("help");
})
app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/security-check", (req, res) => {
  res.render("security-check");
});

app.get("/find-account", (req, res) => {
  res.render("find-account");
});

app.get("/reset-password", (req, res) => {
  res.render("reset-password");
});

app.post("/signup", async (req, res) => {

  const check = await collection.findOne({ email: req.body.email });

  if (!check) {
    bcrypt
      .hash(req.body.password, Number(process.env.SALT_ROUNDS))
      .then((hash) => {
        const data = {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          gender: req.body.gender,
          securityQuestion: req.body.securityQuestion,
          answer: req.body.answer,
          email: req.body.email,
          password: hash,
        };
        collection.insertMany([data]);
        alert("user created");
        res.redirect("/login");
      })
      .catch((e) => {
        console.log(e);
      });
  } else {
    res.redirect("/login");
    alert("user already exists");
  }
});

app.post("/login", async (req, res) => {

  const check = await collection.findOne({ email: req.body.email });
  if (check) {
    email = req.body.email;
    userName = check.firstName;
    const colour = Math.floor(Math.random()*16777215).toString(16);
    userColor = "#" + colour;
    bcrypt
      .compare(req.body.password, check.password)
      .then((result) => {
        if (result) {
          const payload = {
            email: req.body.email,
          };
          const accessToken = jwt.sign(payload, process.env.JWT_KEY, {
            expiresIn: "1h",
          });
          tokens = accessToken;
          res.redirect("/");
        } else {
          res.redirect("/login");
          alert("Incorrect password");
        }
      })
      .catch((e) => {
        console.log(e);
        res.redirect("/login");
        alert("An error occured, Try again");
      });
  } else {
    res.redirect("/login");
    alert("Enter a valid email");
  }
});

app.get("/leaveRoom", (req, res) => {
  res.render("homepage", {name: userName});
})

app.post("/find-account", async (req, res) => {
  accountDetails = await collection.findOne({ email: req.body.email });
  if (!accountDetails) {
    res.redirect("/find-account");
    alert("Enter an existing email");
  } else {
    res.redirect("/security-check");
  }
});

app.post("/security-check", async (req, res) => {
  if (accountDetails.securityQuestion !== req.body.securityQuestion) {
    res.redirect("/security-check");
    alert("Please select the correct security question");
  } else if (accountDetails.answer !== req.body.answer) {
    res.redirect("/security-check");
    alert("Please enter the correct answer");
  } else if (
    accountDetails.answer === req.body.answer &&
    accountDetails.securityQuestion === req.body.securityQuestion
  ) {
    res.redirect("/reset-password");
  }
});

app.post("/reset-password", async (req, res) => {
  if (req.body.password !== req.body.confirmPassword) {
    res.redirect("/reset-password");
    alert("Password and Confirm Password should be same");
  } else {
    bcrypt
      .hash(req.body.password, Number(process.env.SALT_ROUNDS))
      .then(async (hash) => {
        await collection.findByIdAndUpdate(accountDetails.id, {
          $set: { password: hash },
        });
      });
  }

  res.redirect("/login");
  alert("Password changed successfully");
});

app.get("/logout", async (req, res) => {
  try {
    console.log("logout Successfully");
    tokens = "";
    res.redirect("/login");
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get("/joinRoom", async (req, res) => {
  res.render("chatpro", { name: userColor});
})

function authenticateToken(req, res, next) {
  // const authHeader = res.getHeader("authorization");
  const token = tokens;

  if (token === null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_KEY, (err, payload) => {
    if (err) {
      return res.redirect("/login");
    }
    req.email = payload.email;
    next();
  });
}

//Name for chat bot
const botName = 'Chat Bot';

//assign id, name, room, and color to user when they join a rooom
function userJoin(id, name, room, userColor){
  const user = { id, userName, room, userColor };
  users.push(user);

  return user;
}

//finds current user from arrays of all users
function currentUser(id){
  return users.find(user => user.id === id);
}

//remove user from array when they leave a room
function userLeave(id){
  const index = users.findIndex(user => user.id === id);

  if (index !== -1){
    return users.splice(index, 1)[0];
  }
}

//return a list of all users in a specific room
function getUsers(room){
  return users.filter(user => user.room === room);
}

//fromat message block to show username, message, and profile color for user
function messageFormat(userName, msg, color){
  return {
    userName,
    msg,
    color
  };
}

//connection for socket
io.on('connection', (socket) => {
  //when user joins room
  socket.on('joinRoom', ({ name, room }) => {
    const user = userJoin(socket.id, userName, room, userColor);

    //lets user join specific rooms
    socket.join(user.room);

    console.log('a user connected');
    
    //emit welcome message or informs current users of new user in chat to server
    socket.emit('chat message', messageFormat(botName, 'Welcome to the chat.', "#000000")) ;
    socket.broadcast.to(user.room).emit('chat message', messageFormat(botName, userName + ' has joined the chat', "#000000"));

    //emit a list of all active users in chat room to server
    io.to(user.room).emit('active users', {
      room: user.room,
      users: getUsers(user.room)
    });
  });

  //emit senders message to server
  socket.on('user message', msg => {
    const user = currentUser(socket.id);

    socket.emit('user message', messageFormat(user.userName, msg, userColor));
    });

  //emit senders message to other users in room to server
  socket.on('chat message', msg => {
    const user = currentUser(socket.id);

    socket.broadcast.to(user.room).emit('chat message', messageFormat(user.userName, msg, userColor));
  });

  //when user leaves room
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);

    //emit user has left the room and update list of active users to server
    if (user){
      io.to(user.room).emit('chat message', messageFormat(botName, `${user.userName} has left the room`, "#000000"));

      io.to(user.room).emit('active users', {
      room: user.room,
      users: getUsers(user.room)
    });
    }
    //log to console user disconnected
    console.log('a user disconnected');
  });
});

//server listen for connection
server.listen(3000, () => {
  console.log("Server connected listening to port 3000");
});
