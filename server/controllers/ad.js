const MongoClient = require('mongodb').MongoClient
const adController = {}

const dburl = require('../utils').dburl
const dbName = require('../utils').dbName

adController.search = async (req, res) => {
  const client = new MongoClient(dburl, {
    useUnifiedTopology: true
  })
  try {
    await client.connect()
    const db = client.db(dbName)
    const col = db.collection('ads')

    let result = await col.find(req.body).toArray()
    result = result.map(r => {
      const { thumbnail, ...rest } = r
      return rest
    })
    res.status(200).json({
      result
    })
  } catch (err) {
    console.log(err.stack)
    res.status(500).json({
      error: err
    })
  }
}

module.exports = adController
