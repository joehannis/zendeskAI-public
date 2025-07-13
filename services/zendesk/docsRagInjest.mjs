import zendeskApiPull from '../../utils/zendeskApiPull.mjs';
import puppateer from 'puppeteer'
import TPA_TPSA_OPTIONS from '../../constants/zendesk-technical-product-areas.json' with { type: 'json' };
import fs from 'fs'
import path from 'path'


const docsRagInjest = async (config) => {
  
  const searchAreaTPA = config.tpa
  const reprocess = config.reprocess
  const __filename = process.argv[1]; 
  const __dirname = path.dirname(__filename);
  const projectRoot = path.join(__dirname, '../../..');

  const outputPath = path.join(projectRoot, 'zendeskAI', `database`, 'zendeskDocs')
  console.log('Project Root (deduced):', projectRoot);
  console.log('Calculated Base Output Path (absolute):', outputPath);

  function createPdf(doc) {
    return (async () => {
      const browser = await puppateer.launch();
      const page = await browser.newPage();
      const htmlString = `<h1>${doc?.title}</h1> \n \n ${doc?.body}` || '<html><body>No content</body></html>';
    
      await page.setContent(htmlString, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: `${outputPath}/${searchAreaTPA}/${doc.title}.pdf`,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });
      console.log(`PDF ${doc.title} successfully created at: ${outputPath}`);
      await browser.close();
      return
    })();
  }


  await Promise.all(
    TPA_TPSA_OPTIONS.map(async (area) => {
      if (area.tpa === searchAreaTPA && area['sections']) {
        area['sections'].map(async (section) => {
          const docs = await zendeskApiPull(
            `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/help_center/articles/search.json?section=${section['id']}`,
            'GET'
          );
          return (
          docs?.results?.map(async (doc) => {
             const directoryPath = `${outputPath}/${searchAreaTPA}`;
             if (fs.existsSync(directoryPath) && reprocess){
                console.log(`Deleting ${searchAreaTPA} folder and the PDFs within`)
                fs.rmSync(directoryPath, { recursive: true, force: true })
              }
            try {
              if (!fs.existsSync(directoryPath)) {
                fs.mkdirSync(directoryPath);
              }
              if (!fs.existsSync(`${directoryPath}/${doc.title}.pdf`)) {
                createPdf(doc)
              } else {
                console.log(`PDF of ${doc.title} already exists`)
              }

  
            } catch (error) {
              console.error(`An error occurred: ${error}`);
            } 
          }))
        })
      }
    })
  )
}
    
export default docsRagInjest;
