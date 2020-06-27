const express = require('express')
const adController = require('./controllers/ad')
const app = express()
const port = 3000

app.use(express.json())

app.get('/', (req, res) => res.send('Hello World!'))

app.post('/ad/search', adController.search)

app.listen(port, () =>
  console.log(`Example app listening at http://localhost:${port}`)
)
