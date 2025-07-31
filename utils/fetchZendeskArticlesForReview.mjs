import { fetchArticlesFromFirestore } from '../database/firestore/firestoreManager.mjs';
import zendeskApiPull from './zendeskApiPull.mjs';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);
async function convertHtmlToPdf(htmlString, outputPath) {
  let browser;
  try {
    browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set the HTML content
    await page.setContent(htmlString, { waitUntil: 'networkidle0' });

    // Generate PDF
    await page.pdf({
      path: outputPath,
      format: 'A4', // Or 'Letter', 'Legal', 'Tabloid', 'A0'-'A6'
      printBackground: true, // Renders background colors and images
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in',
      },
      // You can add more options like headerTemplate, footerTemplate, etc.
    });

    console.log(`PDF created successfully at ${outputPath}`);
  } catch (error) {
    console.error('Error converting HTML to PDF:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

const fetchZendeskArticlesForReview = async (tpa) => {
  const results = [];
  const articles = await fetchArticlesFromFirestore(tpa);

  const batchPromises = articles.map(
    async (article) =>
      await zendeskApiPull(
        `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/help_center/articles/${article.zendeskId}`,
        'GET'
      )
  );

  // Await all promises in the current batch concurrently
  const batchResults = await Promise.all(batchPromises);

  console.log(batchResults.length);

  results.push(...batchResults.filter((article) => article !== null));

  results.map((article) => {
    if (!fs.existsSync(`../exportedArticles/${tpa}`)) {
      fs.mkdirSync(`../exportedArticles/${tpa}`);
    }
    convertHtmlToPdf(
      `<h1>${article.article.title}</h1> \n\n ${article.article.body}`,
      path.resolve(
        __dirname,
        `../exportedArticles/${tpa}/${article.article.title}.pdf`
      )
    );
  });
};

fetchZendeskArticlesForReview('tpa_feedback');
