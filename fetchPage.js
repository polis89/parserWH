const fetch = require('node-fetch')
const sleep = require('sleep')

const minWait = 500
const maxWait = 1000

const fetchPageSync = async url => {
  console.log(`GET: ${url}`)

  let result
  await fetch(url)
    .then(response => response.text())
    .then(html => (result = html))
    .catch(err => console.error(err))

  return result
}

const fetchPageSyncDelay = async (url, pageNum) => {
  sleep.msleep(Math.floor(Math.random() * maxWait + minWait))
  const res = await fetchPageSync(`${url}?page=${pageNum || 1}`)
  return res
}

const fetchImgSyncDelay = async url => {
  sleep.msleep(Math.floor(Math.random() * maxWait + minWait))
  let result
  await fetch(url)
    .then(response => response.blob())
    .then(response => response.arrayBuffer())
    .then(buffer => (result = buffer))
    .catch(err => console.error(err))
  return result
}

module.exports = { fetchPageSync, fetchPageSyncDelay, fetchImgSyncDelay }
