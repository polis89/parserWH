const processCategory = require('./processCategory')

const eGuitarCat = {
  id: 'e-guitars',
  url:
    'iad/kaufen-und-verkaufen/marktplatz/e-gitarren-verstaerker/e-gitarren-7209'
}

processCategory(eGuitarCat)
  .then(() => console.log('Category GUITARS proceed successfully'))
  .catch(err => console.error(err))
