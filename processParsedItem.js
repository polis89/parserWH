const MongoClient = require('mongodb').MongoClient
const Binary = require('mongodb').Binary
const moment = require('moment')
const STATUS_CODES = require('./utils').STATUS_CODES
const RESULT_CODES = require('./utils').RESULT_CODES
const url = require('./utils').dburl
const dbName = require('./utils').dbName

const { fetchImgSyncDelay } = require('./fetchPage')

const processParsedItems = async parsedItems => {
  const client = new MongoClient(url, {
    useUnifiedTopology: true
  })
  const stats = {
    [RESULT_CODES.CREATED]: 0,
    [RESULT_CODES.UPDATED]: 0,
    [RESULT_CODES.UNMODIFIED]: 0
  }
  try {
    await client.connect()

    const db = client.db(dbName)

    for (let i = 0; i < parsedItems.length; i++) {
      const resCode = await processParsedItem(parsedItems[i], db)
      stats[resCode] += 1
    }
  } catch (err) {
    console.log(err.stack)
  }
  client.close()
  return stats
}

const processParsedItem = async (parsedItem, db) => {
  const col = db.collection('ads')

  const existingAd = await col.findOne({
    id: parsedItem.id
  })
  if (!existingAd) {
    let img

    img = await fetchImgSyncDelay(parsedItem.thumbnailLink)
    await col.insertOne({
      ...parsedItem,
      thumbnail: Binary(String.fromCharCode.apply(null, new Uint8Array(img))),
      priceHistory: [
        {
          price: parsedItem.price,
          date: moment().toDate()
        }
      ],
      createdDate: parsedItem.createdDate.toDate(),
      status: STATUS_CODES.OPEN
    })
    console.log(`Added new ad: ${parsedItem.id}`)
    return RESULT_CODES.CREATED
  }
  return RESULT_CODES.UNMODIFIED
}

module.exports = {
  processParsedItems
}
