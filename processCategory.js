const fs = require('fs')
const MongoClient = require('mongodb').MongoClient
const cheerio = require('cheerio')
const moment = require('moment')
const STATUS_CODES = require('./utils').STATUS_CODES
const RESULT_CODES = require('./utils').RESULT_CODES
const dburl = require('./utils').dburl
const dbName = require('./utils').dbName

const { fetchPageSyncDelay } = require('./fetchPage')
const { processParsedItems } = require('./processParsedItem')

const whURL = 'https://www.willhaben.at/'
const resultListId = 'resultlist'

const processCategory = async category => {
  const url = new URL(category.url, whURL)
  // const latestDate = await getLatestCategoryDate(category)
  // console.log(`Latest category ${category.id} entry: ${latestDate}`)

  let currentPage = 1

  while (true) {
    const page = await fetchPageSyncDelay(url, currentPage++)
    const needNextPage = await processPage(page, currentPage, category)
    if (!needNextPage) break
  }

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
  console.log(`Category ${category.id} page ${currentPage} parsed:`)
  console.log('stats', stats)

  if (resultsList.length <= 25 || stats[RESULT_CODES.CREATED] === 0) {
    return false
  }
  return true
}

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

module.exports = processCategory
