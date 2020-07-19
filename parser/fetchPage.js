const fetch = require('node-fetch')
const sleep = require('sleep')
const HttpsProxyAgent = require('https-proxy-agent')

const getchTimeout = 30000
const minWait = 1000
const maxWait = 2000
const proxy = `http://${process.env.http_proxy}`

const fetchWithTimeout = (url, options, timeout = 30000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Fetch timeout')), timeout)
    )
  ])
}

const fetchPageSync = async url => {
  console.log(`GET: ${url}`)

  let result
  await fetchWithTimeout(url, { agent: new HttpsProxyAgent(proxy) })
    .then(response => response.text())
    .then(html => (result = html))
    .catch(err => console.error(err))

  return result
}

const fetchPageSyncDelay = async (url, pageNum) => {
  sleep.msleep(Math.floor(Math.random() * maxWait + minWait))
  const res = await fetchPageSync(pageNum ? `${url}?page=${pageNum}` : url)
  return res
}

const fetchImgSyncDelay = async url => {
  sleep.msleep(Math.floor(Math.random() * maxWait + minWait))
  let result
  await fetch(url, { agent: new HttpsProxyAgent(proxy) })
    .then(response => response.blob())
    .then(response => response.arrayBuffer())
    .then(buffer => (result = buffer))
    .catch(err => console.error(err))
  return result
}

module.exports = { fetchPageSync, fetchPageSyncDelay, fetchImgSyncDelay }
