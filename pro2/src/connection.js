const mongoose = require("mongoose");
mongoose
  .connect(
    "mongodb+srv://danielamponsah:Da041201@cluster0.3tlzd5f.mongodb.net/?retryWrites=true&w=majority"
  )
  .then(() => {
    console.log("Mongoose connection succesful");
  })
  .catch((e) => {
    console.log(e);
  });

const LoginSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    required: true,
  },
  securityQuestion: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  groups: {
    type: Object,
    required: false
  },
});

const collection = new mongoose.model("Collection1", LoginSchema);

module.exports = collection;
