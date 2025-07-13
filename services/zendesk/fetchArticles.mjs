import dotenv from 'dotenv';
import path from 'path';
import generatePromptContent from '../../utils/generatePromptContent.mjs';
import {
  canMakeRequest,
  getTotalTokensUsedInMinute,
  getRequestsThisMinute,
  getRequestsToday,
} from '../../utils/rateLimiter.mjs';
import splitTickets from '../../utils/splitTickets.mjs';
import { jsonrepair } from 'jsonrepair';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const fetchArticles = async (obj, ai, selectedAI) => {
  const apiLimit = 1048576;
  const rpmLimit = 150;

  let chunksArray = []; // This will hold the successfully validated chunks for API calls

  const originalTicketCount = obj['tickets'].length;
  if (originalTicketCount === 0) {
    throw new Error('No tickets on object');
  }

  const initialPrompt = generatePromptContent(obj.docs, obj.tickets, 'gemini');
  const initialTokenEstimateResponse = await ai.models.countTokens({
    model: 'gemini-2.5-pro',
    contents: initialPrompt.prompt,
    generationConfig: { responseSchema: initialPrompt.jsonSchema },
  });

  if (initialTokenEstimateResponse.totalTokens < apiLimit) {
    chunksArray.push(obj);
  } else {
    const initialSplit = canMakeRequest(
      initialTokenEstimateResponse.totalTokens,
      apiLimit,
      rpmLimit
    );

    chunksArray = await splitTickets(ai, obj, initialSplit.acceptableChunkSize);
  }

  const chunkResults = [];

  for (const [index, chunk] of chunksArray.entries()) {
    const chunkContent = generatePromptContent(
      chunk.docs,
      chunk.tickets,
      selectedAI
    );
    let attempt = 0;
    const maxAttempts = 5;
    const initialDelay = 1000;

    while (attempt < maxAttempts) {
      attempt++;
      console.log(
        `Making API call for chunk ${index + 1} (attempt ${attempt})...`
      );

      try {
        if (selectedAI === 'gemini') {
          const result = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: chunkContent.prompt,
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: chunkContent.jsonSchema,
            },
          });
          chunkResults.push(result);
        }
        if (selectedAI === 'openai') {
          const result = await openai.responses.create({
            model: 'gpt-4o',
            input: chunkContent.prompt,
            text: {
              format: {
                type: 'json_schema',
                name: 'article_response',
                schema: chunkContent.jsonSchema,
              },
            },
          });

          chunkResults.push(result);
        }
        break;
      } catch (error) {
        let retryDelayFromApi = 0;
        try {
          const errorDetails = error.response?.data?.error?.details;
          if (errorDetails) {
            const retryInfo = errorDetails.find(
              (detail) =>
                detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
            );
            if (retryInfo && retryInfo.retryDelay) {
              retryDelayFromApi = parseInt(retryInfo.retryDelay) * 1000;
            }
          }
        } catch (parseError) {
          console.error(
            'Failed to parse error details for retryDelay:',
            parseError
          );
        }

        if (error.response && error.response.status === 429) {
          const delay =
            retryDelayFromApi > 0
              ? retryDelayFromApi
              : initialDelay * Math.pow(2, attempt - 1);

          console.warn(
            `Rate limit hit for chunk ${
              index + 1
            }. Retrying in ${delay}ms (from API: ${
              retryDelayFromApi > 0 ? 'yes' : 'no'
            })...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error(`Error for chunk ${index + 1}:`, error);
          throw error;
        }
      }
    }

    if (attempt >= maxAttempts && chunkResults.length <= index) {
      throw new Error(
        `Failed to generate content for chunk ${
          index + 1
        } after ${maxAttempts} attempts.`
      );
    }
  }

  let parsedResults = '';

  for (const result of chunkResults) {
    if (!result || !result.candidates || result.candidates.length === 0) {
      console.error(
        'Skipping a chunk that failed during the API call or had no candidates.'
      );
      continue;
    }
    const candidate = result.candidates[0];
    let currentPart = '';
    try {
      candidate.content.parts.forEach((part) => {
        currentPart = part.text;
        parsedResults += currentPart;
      });
    } catch (jsonParseError) {
      console.error(
        `Failed to parse JSON from chunk: ${jsonParseError.message}`,
        currentPart
      );
      return {
        status: 'error',
        error: `Failed to parse JSON for one or more chunks.`,
      };
    }
  }

  parsedResults = jsonrepair(parsedResults);
  parsedResults = JSON.parse(parsedResults);

  if (parsedResults.length > 0) {
    return {
      status: 'success',
      results: parsedResults,
      chunked: parsedResults.length === 1 ? false : true,
    };
  } else {
    return {
      status: 'error',
      error: 'No valid results after processing chunks.',
    };
  }
};

export default fetchArticles;
