const express = require("express");
const router = express.Router();



const user = require("./../models/user");

const userVerification = require("./../models/userVerification");

const bcrypt = require("bcrypt");

const nodemailer = require("nodemailer");

const { v4: uuidv4 } = require("uuid");

const mongoose = require("mongoose");

require("dotenv").config();

const app = express();


app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true }));


app.use(express.static('cardrop'));

//path for static verified page
const path = require("path");
const { error } = require("console");

//nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 465,
  logger: true,
  debug: true,
  secure: true,
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  },
});

// testing success
transporter.verify((error, success) => {
  if (error) {
    console.log(error);
  } else {
    console.log("Ready for the game baby");
    console.log(success);
  }
});




router.post("/signup", (req, res) => {
  let { name, email, password, dateOfBirth } = req.body;
  if(name){name= name.trim();}
  email = email.trim();
  password = password.trim();
  if(dateOfBirth){ dateOfBirth= dateOfBirth.trim();}

  if (name == "" || email == "" || password == "" || dateOfBirth == "") {
    res.json({
      status: "Failed",
      message: "empty input!",
    });
  } else if (!/^[a-zA-Z ]*$/.test(name)) {
    res.json({
      status: "Failed",
      message: "Invalid Input (name)",
    });
  } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    res.json({
      status: "Failed",
      message: "Invalid Input (email)",
    });
  } else if (!new Date(dateOfBirth).getTime()) {
    res.json({
      status: "Failed",
      message: "Invalid Input (dob) ",
    });
  } else if (password.length < 8) {
    res.json({
      status: "Failed",
      message: "Password is too short",
    });
  } else {
    //chech if the user already exist
    user
      .find({ email })
      .then((result) => {
        if (result.length) {
          //user already exists
          res.json({
            status: "Failed",
            message: "User already exists",
          });
        } else {
          //try to create new user
          const saltRounds = 10;
          bcrypt
            .hash(password, saltRounds)
            .then((hashedPassword) => {
              const newUser = new user({
                name,
                email,
                password: hashedPassword,
                dateOfBirth,
                verified: false,
              });

              newUser
                .save()
                .then((result) => {
                  //handle account verification
                  sendVerificationEmail(result, res);
                })
                .catch((err) => {
                  res.json({
                    status: "Failed",
                    message: "An error occurd while saving user account",
                  });
                });
            })
            .catch((err) => {
              res.json({
                status: "Failed",
                message: "Error occured while hashing",
              });
            });
        }
      })
      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "An error Occured" + err,
        });
      });
  }
});

const sendVerificationEmail = ({ _id, email }, res) => {
  const currentUrl = "http://localhost:5000/";

  const uniqueString = uuidv4() + _id;

  const userId = new mongoose.Types.ObjectId(_id);

  const mailOption = {
    from: process.env.AUTH_EMAIL,
    to: email,
    subject: "Verify Your Email",
    html: `<p>Verify your email to complete the process</p>
           <p>This link <b>expires in 10 min</b>.</p>
           <p>Press <a href=${currentUrl + "user/verify/" + userId + "/" + uniqueString}> here </a>to proceed.</p>`,
  };

  
  //hash the uniqueString
  const saltRounds = 10;
  bcrypt
    .hash(uniqueString, saltRounds)
    .then((hashedUniqueString) => {
      //set value in uservarification collection
      const newVerification = new userVerification({
        userId: _id,
        uniqueString: hashedUniqueString,
        createdAt: Date.now(),
        expireAt: Date.now() + 600000,
      });
      newVerification
        .save()
        .then(() => {
          transporter
            .sendMail(mailOption)
            .then(() => {
              //email sent and verification record saved
              res.json({
                status: "Pending",
                message: "verification email sent",
              });
            })
            .catch((error) => {
              res.json({
                status: "Failed",
                message: "verification email failed ",
              });
            });
        })
        .catch((error) => {
          console.log(error);
          res.json({
            status: "Failed",
            message: "could't save verification email data",
          });
        });
    })
    .catch(() => {
      res.json({
        status: "Failed",
        message: "An error occured hashing email data",
      });
    });
};

// verify email
router.get("/verify/:userId/:uniqueString", (req, res) => {
  let { userId, uniqueString } = req.params;
  userId = new mongoose.Types.ObjectId(userId);

  userVerification
    .find({userId })
    .then((result) => {
      if (result.length > 0) {
        //record exists
        const { expireAt } = result[0];
        const hashedUniqueStrign = result[0].uniqueString;

        // checkig for expired link
        if (expireAt < Date.now()) {
          //record expires so we delete it
          userVerification
            .deleteOne({ userId })
            .then((result) => {
              user
                .deleteOne({ _id: userId })
                .then(() => {
                  let message = "link has expired please sign up again";
                  res.redirect(`/user/verified?error=true&message=${message}`);
                })
                .catch((error) => {
                  let message =
                    "clearing user with expired unique string failed";
                  res.redirect(`/user/verified?error=true&message=${message}`);
                });
            })
            .catch((error) => {
              console.log(error);
              let message =
                "an error occured while clearing expired user verification record";
              res.redirect(`/user/verified?error=true&message=${message}`);
            });
        } else {
          //valid record exists so we validate the user string
          //first compair the hashed unique string
          bcrypt
            .compare(uniqueString, hashedUniqueStrign)
            .then((result) => {
              if (result) {
                //string matches
                user
                  .updateOne({ _id: userId }, { verified: true })
                  .then(() => {
                    userVerification
                      .deleteOne({ userId })
                      .then(() => {
                        res.sendFile(
                          path.join(__dirname, "./../viwes/verified.html")
                        );
                      })
                      .catch((error) => {
                        let message =
                          "error occurred while finalizing successful verification";
                        res.redirect(
                          `/user/verified?error=true&message=${message}`
                        );
                      });
                  })
                  .catch((error) => {
                    console.log(error);
                    let message =
                      "an error occurred while updating user record";
                    res.redirect(
                      `/user/verified?error=true&message=${message}`
                    );
                  });
              } else {
                //incorrect varification passed
                let message =
                  "invalid varification details passed. check your inbox";
                res.redirect(`/user/verified?error=true&message=${message}`);
              }
            })
            .catch((error) => {
              let message = "error occurred while comparing unique string";
              res.redirect(`/user/verified?error=true&message=${message}`);
            });
        }
      } else {
        console.log(error)
        //verificatio record does not exists
       
        let message =error;
        res.redirect(`/user/verified?error=true&message=${message}`);
      }
    })
    .catch((error) => {
      console.log(error);
      let message =
        "an error occured while checking for user verification record";
      res.redirect(`/user/verified?error=true&message=${message}`);
    });
});







// verified page route
router.get("/verified", (req, res) => {
  res.sendFile(path.join(__dirname, "./../viwes/verified.html"));
});

router.post("/signin", (req, res) => {
  let { email, password } = req.body;

  email = email.trim();
  password = password.trim();

  if (email == "" || password == "") {
    res.json({
      status: "Failed",
      message: "empty input",
    });
  } else {
    //check if user exists

    user
      .find({ email })
      .then((data) => {
        if (data.length) {
          //check if user is verified
          if (!data[0].verified) {
            res.json({
              status: "Failed",
              message: "email hasn't been verified",
            });
          } else {
            //if user exixts we take the password and compair it with the hashed password in the database
            const hashedPassword = data[0].password;
            bcrypt
              .compare(password, hashedPassword)
              .then((result) => {
                if (result) {
                  res.json({
                    status: "Sussess",
                    message: "Signinup Sussessful",
                    data: data,
                  });
                } else {
                  res.json({
                    status: "FAILED",
                    message: "Incorrect Password!",
                  });
                }
              })
              .catch((err) => {
                res.json({
                  status: "Failed",
                  message: "error while comparing",
                });
              });
          }
        } else {
          res.json({
            status: "Failed",
            message: "Invalid Credentials",
          });
        }
      })
      .catch((err) => {
        res.json({
          status: "Failed",
          message: "User Does Not Exists",
        });
      });
  }
});

module.exports = router;
