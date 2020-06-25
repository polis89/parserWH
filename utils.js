const STATUS_CODES = {
  OPEN: 'OPEN',
  SOLD: 'SOLD',
  CLOSED: 'CLOSED',
  TIMEDOUT: 'TIMEDOUT'
}

const RESULT_CODES = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  UNMODIFIED: 'UNMODIFIED'
}

const dburl = 'mongodb://localhost:27017'
const dbName = 'whParser'

module.exports = {
  STATUS_CODES,
  RESULT_CODES,
  dburl,
  dbName
}
