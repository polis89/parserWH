const fs = require('fs')
const _ = require('lodash')
const MongoClient = require('mongodb').MongoClient
const cheerio = require('cheerio')
const moment = require('moment')

const STATUS_CODES = require('./utils').STATUS_CODES
const RESULT_CODES = require('./utils').RESULT_CODES
const dburl = require('./utils').dburl
const dbName = require('./utils').dbName

const { fetchPageSyncDelay } = require('./fetchPage')
const { processParsedItems } = require('./processParsedItem')
const { parse } = require('path')

const whURL = 'https://www.willhaben.at/'
const resultListId = 'resultlist'

const updateGapMin = 600
let singleUpdateCutoff = 200

const processCategory = async category => {
  console.log(`=== Start processing category: ${category.id}`)

  const url = new URL(category.url, whURL)
  // const latestDate = await getLatestCategoryDate(category)
  // console.log(`Latest category ${category.id} entry: ${latestDate}`)
  const stats = {
    [RESULT_CODES.CREATED]: 0,
    [RESULT_CODES.UPDATED]: 0,
    [RESULT_CODES.SOLD]: 0
  }

  // Update existing ads
  const updateStats = await updateCategory(category)
  stats[RESULT_CODES.UPDATED] += updateStats[RESULT_CODES.UPDATED]
  stats[RESULT_CODES.SOLD] += updateStats[RESULT_CODES.SOLD]

  // Add new ads
  let currentPage = 1

  while (true) {
    const page = await fetchPageSyncDelay(url, currentPage++)
    const { needNextPage, created } = await processPage(
      page,
      currentPage,
      category
    )
    stats[RESULT_CODES.CREATED] += created
    if (!needNextPage) break
  }
  console.log(`Category ${category.id} parsed`, stats)

  // fs.writeFile('testPage2.html', page, function (err) {
  //   if (err) return console.log(err)
  // })
  // const page = fs.readFile('testPage2.html', 'utf8', function (err, html) {
  //   if (err) return console.log(err)
  //   processPage(html)
  // })
}

const processPage = async (page, currentPage, category) => {
  const resultsContainer = cheerio(`#${resultListId}`, page)
  const resultsList = cheerio('.search-result-entry', resultsContainer)
  const parsedItems = []
  resultsList.each((i, el) => {
    parsedItems.push(processResult(cheerio(el)))
  })
  const stats = await processParsedItems(
    parsedItems
      .filter(el => el && el.price > 100)
      .map(el => ({ ...el, catId: category.id }))
  )
  console.log(`Category ${category.id} page ${currentPage - 1} parsed:`)
  console.log('stats', stats)

  if (resultsList.length <= 25 || stats[RESULT_CODES.CREATED] === 0) {
    return { needNextPage: false, created: stats[RESULT_CODES.CREATED] }
  }
  return { needNextPage: true, created: stats[RESULT_CODES.CREATED] }
}

// Process ads list
const processResult = resultElement => {
  const contentElement = cheerio('.content-section', resultElement)
  const imageElement = cheerio('.image-section', resultElement)
  if (contentElement.length === 0) {
    return
  }
  const item = {}
  // console.log(contentElement.html().trim())

  item.name = cheerio('.header span', contentElement)
    .text()
    .trim()
  item.createdDate = moment(
    cheerio('.bottom.noAddress .bottom-content', contentElement)
      .text()
      .trim(),
    'DD.MM.YYYY hh:mm'
  )
  item.thumbnailLink = cheerio('img', imageElement).attr('src')
  item.address = cheerio('.addressLine div', contentElement)
    .text()
    .trim()
    .replace(/\r?\n|\r/g, ' ')
    .replace(/ +(?= )/g, '')
  item.desc = cheerio('.description', contentElement)
    .text()
    .trim()
  item.id = cheerio('.header a', contentElement).attr('href')
  item.link = new URL(item.id, whURL).href

  const priceScript = cheerio('.info script', contentElement).html()
  const base64str = /replaceWith\(.+\,.+\(\'(.+)\'\)\)/.exec(priceScript)
  if (!base64str[1]) {
    console.error('Cannot parse the price: ', contentElement.html().trim())
    return
  }
  const buff = Buffer.from(base64str[1], 'base64')
  const priceArr = cheerio('.info-2-price', buff.toString())
    .html()
    .split(',')

  if (priceArr[0] && ['verkauft', 'zu verschenken'].includes(priceArr[0])) {
    return
  }

  if (priceArr.length !== 2) {
    console.log('priceArr', priceArr)
    console.error('Cannot parse the price: ', contentElement.html().trim())
    return
  }
  item.price = parseInt(priceArr[0].replace(/\./, ''), 10)

  return item
}

const processSingleResult = page => {
  const item = {}
  const statusMsgBox = cheerio('#statusMessageBox .text', page)
    .text()
    .trim()
  if (statusMsgBox.includes('Diese Anzeige ist nicht mehr')) {
    item.price = STATUS_CODES.SOLD
    return item
  }

  item.fullDesc = cheerio('.inner-content .description', page)
    .text()
    .trim()

  const priceScript = cheerio(
    '.container.right script:nth-of-type(2)',
    page
  ).html()

  const base64str = /replaceWith\(.+\,.+\(\'(.+)\'\)\)/.exec(priceScript)
  if (!base64str || !base64str[1]) {
    console.error('Cannot parse the price: ', priceScript.trim())
    console.log('statusMsgBox', statusMsgBox)
    return
  }
  const buff = Buffer.from(base64str[1], 'base64')

  const priceArr = cheerio('.price', buff.toString())
    .html()
    .split(',')

  if (
    priceArr[0] &&
    ['reserviert', 'verkauft'].includes(
      priceArr[0]
        .replace(/\./, '')
        .trim()
        .toLowerCase()
    )
  ) {
    item.price = STATUS_CODES.SOLD
    return item
  }

  if (priceArr.length !== 2) {
    console.error('Cannot parse the price: ', priceArr[0].replace(/\./, ''))
    return
  }
  item.price = parseInt(
    priceArr[0].replace(/\./, '').replace(/&#([0-9A-Za-z]{1,});/gi, ''),
    10
  )
  if (isNaN(item.price)) {
    throw new Error('cannot parse price', priceArr)
  }

  return item
}

const updateCategory = async category => {
  const client = new MongoClient(dburl, {
    useUnifiedTopology: true
  })
  const stats = {
    [RESULT_CODES.UNMODIFIED]: 0,
    [RESULT_CODES.UPDATED]: 0,
    [RESULT_CODES.SOLD]: 0
  }
  try {
    await client.connect()

    const db = client.db(dbName)
    const col = db.collection('ads')

    const cursor = col.find({
      catId: category.id,
      status: STATUS_CODES.OPEN
    })

    const cutoffDate = moment().add(-updateGapMin, 'minutes')
    console.log('cutoffDate', cutoffDate)

    let ad
    while ((ad = await cursor.next())) {
      if (!singleUpdateCutoff) break

      if (ad.lastUpdate && cutoffDate.isBefore(moment(ad.lastUpdate))) {
        continue
      }
      const resCode = await updateAd(ad, db)
      stats[resCode] += 1
      singleUpdateCutoff--
    }
  } catch (err) {
    console.log(err.stack)
  }
  console.log('updateCategory', stats)

  client.close()
  return stats
}

const updateAd = async (ad, db) => {
  const url = new URL(ad.id, whURL)
  const page = await fetchPageSyncDelay(url)
  const parsedAd = processSingleResult(page)
  let status = RESULT_CODES.UNMODIFIED
  const col = db.collection('ads')
  if (parsedAd.fullDesc && !ad.fullDesc) {
    await col.updateOne(
      { id: ad.id },
      {
        $set: {
          fullDesc: parsedAd.fullDesc,
          lastUpdate: moment().toDate()
        }
      }
    )
    console.log(`Set new desc. Ad: ${ad.id}`)
  }
  if (parsedAd.price === STATUS_CODES.SOLD) {
    await col.updateOne(
      { id: ad.id },
      {
        $set: {
          status: STATUS_CODES.SOLD,
          lastUpdate: moment().toDate()
        }
      }
    )
    console.log(`---> Sold. Ad: ${ad.id}, price: ${ad.price}`)
    return RESULT_CODES.SOLD
  }
  if (parsedAd.price !== ad.price) {
    const priceHistory = ad.priceHistory
    priceHistory.push({
      price: parsedAd.price,
      date: moment().toDate()
    })
    await col.updateOne(
      { id: ad.id },
      {
        $set: {
          price: parsedAd.price,
          priceHistory,
          lastUpdate: moment().toDate()
        }
      }
    )
    console.log(
      `--> Updating price. Ad: ${ad.id}, old Price: ${ad.price} new Price: ${parsedAd.price}`
    )
    return RESULT_CODES.UPDATED
  }
  await col.updateOne(
    { id: ad.id },
    {
      $set: {
        lastUpdate: moment().toDate()
      }
    }
  )
  console.log(`Set update date: ${ad.id}`)

  return status
}

module.exports = processCategory
