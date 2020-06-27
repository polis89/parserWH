const MongoClient = require('mongodb').MongoClient

const STATUS_CODES = require('./utils').STATUS_CODES
const RESULT_CODES = require('./utils').RESULT_CODES
const dburl = require('./utils').dburl
const dbName = require('./utils').dbName

const whURL = 'https://www.willhaben.at/'
const resultListId = 'resultlist'

const processCategory = async () => {
  const client = new MongoClient(dburl, {
    useUnifiedTopology: true
  })

  try {
    await client.connect()

    const db = client.db(dbName)
    const col = db.collection('ads')

    const res = await col
      .aggregate(
        { $group: { _id: '$id', count: { $sum: 1 } } },
        { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
        { $project: { id: '$_id', _id: 0 } }
      )
      .toArray()

    console.log('cursor.toArray()', res)

    let deleted = 0

    for (let j = 0; j < res.length; j++) {
      const dupls = await col
        .find({
          id: res[j]._id
        })
        .toArray()
      console.log('dupls', dupls)
      for (let i = 1; i < dupls.length; i++) {
        await col.deleteOne({ _id: dupls[i]._id })
        deleted++
      }
    }
    console.log('deleted: ', deleted)

    //   const count = await cursor.count()

    //   console.log('resultSet size: ' + count)

    //   let ad
    //   while ((ad = await cursor.next())) {
    //     if (!singleUpdateCutoff) break

    //     if (ad.lastUpdate && cutoffDate.isBefore(moment(ad.lastUpdate))) {
    //       continue
    //     }
    //     const resCode = await updateAd(ad, db)
    //     stats[resCode] += 1
    //     singleUpdateCutoff--
    //   }
  } catch (err) {
    console.log(err.stack)
  }

  client.close()
}

processCategory()
  .then(() => console.log('Category GUITARS proceed successfully'))
  .catch(err => console.error(err))
