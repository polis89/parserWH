const mongoose = require('mongoose')

const { Schema } = mongoose
mongoose.Promise = global.Promise
const adSchema = new Schema({
  title: { type: String, required: true },
  link: String,
  text: String,
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  _creator: { type: Schema.ObjectId, ref: 'User' },
  _comments: [{ type: Schema.ObjectId, ref: 'Comments' }]
})

const Ad = mongoose.model('Ad', adSchema)

module.exports = Ad
