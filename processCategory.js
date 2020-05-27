const fs = require('fs')
const cheerio = require('cheerio')
const moment = require('moment')

const { fetchPageSyncDelay } = require('./fetchPage')
const { processParsedItem } = require('./processParsedItem')

const whURL = ''
const resultListId = 'resultlist'

const processCategory = async categoryUrl => {
  const url = new URL(categoryUrl, whURL)

  //   const page = await fetchPageSyncDelay(url)
  //   fs.writeFile('testPage2.html', page, function (err) {
  //     if (err) return console.log(err)
  //   })
  const page = fs.readFile('testPage.html', 'utf8', function (err, html) {
    if (err) return console.log(err)
    processPage(html)
  })
}

const processPage = page => {
  const resultsContainer = cheerio(`#${resultListId}`, page)
  const resultsList = cheerio('.search-result-entry', resultsContainer)
  console.log('length:', resultsList.length)
  resultsList.each((i, el) => {
    const parsedItem = processResult(cheerio(el))
    processParsedItem(parsedItem)
  })
}

const processResult = resultElement => {
  const contentElement = cheerio('.content-section', resultElement)
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
  // item.createdDate = cheerio(
  //   '.bottom.noAddress .bottom-content',
  //   contentElement
  // )
  //   .text()
  //   .trim()
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

  if (priceArr.length !== 2) {
    console.error('Cannot parse the price: ', contentElement.html().trim())
    return
  }
  item.price = parseInt(priceArr[0].replace(/\./, ''), 10)

  return item
}

module.exports = processCategory
