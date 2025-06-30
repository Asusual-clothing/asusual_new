const express = require('express');
const router = express.Router();
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');

// Replace this with DB-based dynamic product list
const products = [
  { slug: 'zodiac-vibes-tshirt', updatedAt: new Date() },
  { slug: 'as-usual-classic-cap', updatedAt: new Date() },
];

router.get('/sitemap.xml', async (req, res) => {
  try {
    const links = products.map(product => ({
      url: `/product/${product.slug}`,
      changefreq: 'weekly',
      priority: 0.8,
      lastmod: product.updatedAt,
    }));

    const stream = new SitemapStream({ hostname: 'https://www.asusual.in' });
    res.setHeader('Content-Type', 'application/xml');

    const xml = await streamToPromise(Readable.from(links).pipe(stream));
    res.send(xml.toString());
  } catch (err) {
    console.error('Sitemap Error:', err);
    res.status(500).end();
  }
});

module.exports = router;
