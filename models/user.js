const mongoose = require('mongoose');
const schema = mongoose.Schema;


const UserSchema = new schema({
    name: String,
    email: { type: String, required: true, unique: true },
    password: String,
    dateOfBirth: Date,
    verified: Boolean
});




module.exports = mongoose.model('user',UserSchema)


