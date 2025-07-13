import path from 'path';
import dotenv from 'dotenv';
import docsRagInjest from '../../services/zendesk/docsRagInjest.mjs';
import fetchTickets from '../../services/zendesk/fetchTickets.mjs';
import exportTickets from '../../utils/exportTickets.mjs';
import fetchDocs from '../../services/zendesk/fetchDocs.mjs';
import fetchArticles from '../../services/zendesk/fetchArticles.mjs';
import postArticle from '../../services/zendesk/postArticle.mjs';
import geminiCompare from '../../services/ai/geminiCompare.mjs';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

const __filename = process.argv[1];

const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const zendeskAIController = async (req, res) => {
  try {
    const config = req.app.locals.config;
    const selectedAI = config.selectedAI;

    const ai =
      selectedAI === 'gemini'
        ? new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })
        : selectedAI === 'openai'
        ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        : null;

    if (config.docProcess) {
      docsRagInjest(config);
      return;
    }

    console.log('processing');

    console.log(
      `Pulling Zendesk Tickets from ${new Date(config.startDate)} ${
        config.endDate ? `to ${new Date(config.endDate)}` : ''
      } and passing to ${
        selectedAI.charAt(0).toUpperCase() + selectedAI.slice(1)
      } ${config.tpsa ? `using filter ${config.tpsa}` : ''} ${
        config.tpa ? `using filter ${config.tpa}` : ''
      }`
    );

    const pulledTickets = await fetchTickets(config);

    if (config.exportTickets) {
      await exportTickets(pulledTickets);
      return;
    }

    const ticketsAndDocs = await fetchDocs(pulledTickets);

    if (!ticketsAndDocs.length) {
      return res
        .status(200)
        .send({ status: 'success', actualTokensUsed: 0, result: null });
    }

    let generatedArticles = await fetchArticles(
      ticketsAndDocs[0],
      ai,
      selectedAI
    );

    const finalArticles = await geminiCompare(ai, generatedArticles);

    await postArticle(
      finalArticles,
      pulledTickets[0].tpa,
      pulledTickets[0].tpsa
    );

    // // Send the results back to the client
    // console.log('sending');
    // res.status(200).send(results[0]);
  } catch (error) {
    console.error('Error in zendeskAIController:', error);

    res.status(500).send({
      message: 'An internal server error occurred',

      error: error.message,
    });
  }
};

export default zendeskAIController;
