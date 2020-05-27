const processParsedItem = parsedItem => {
  console.group('Process parsed item')
  console.log('Item', parsedItem)

  console.groupEnd()
}

module.exports = {
  processParsedItem
}
