const processCategory = require('./processCategory')

const eGuitarCatUrl =
  'iad/kaufen-und-verkaufen/marktplatz/e-gitarren-verstaerker/e-gitarren-7209'

processCategory(eGuitarCatUrl)
  .then(() => console.log('Category GUITARS proceed successfully'))
  .catch(err => console.error(err))
