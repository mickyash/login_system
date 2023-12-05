


const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserVerificationSchema = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user', 
        required: true,
    },
    uniqueString: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    expireAt: {
        type: Date,
        default: Date.now + 600000,
    },
});

module.exports = mongoose.model('UserVerification', UserVerificationSchema);
