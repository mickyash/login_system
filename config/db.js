require('dotenv').config();
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("DB Connected");
  }).catch((err)=>console.error("Error connecting to database",err));




