import path from 'path';
import dotenv from 'dotenv';
import * as math from 'mathjs';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const geminiCompare = async (ai, qaObjects) => {
  const threshold = 0.85;
  console.log(qaObjects);

  if (!Array.isArray(qaObjects['results'])) {
    return [];
  }

  if (qaObjects['results'].length === 1) {
    return {
      status: qaObjects.status,
      results: qaObjects['results'],
    };
  }

  // Convert question-answer to a single string
  function formatQA(article) {
    return `Q: ${article.question}\nA: ${article.answer}`;
  }

  // Compute cosine similarity
  function cosineSimilarity(vec1, vec2) {
    if (math.norm(vec1) === 0 || math.norm(vec2) === 0) {
      return 0; // Handle zero vectors to prevent division by zero
    }
    const dot = math.dot(vec1, vec2);
    const normA = math.norm(vec1);
    const normB = math.norm(vec2);
    return dot / (normA * normB);
  }

  // Combine and format all QAs for embedding
  const qaStrings = qaObjects['results'].map((obj) => {
    // Access the article object directly, since it's no longer an array
    const articleContent = obj['Knowledge Base Article'];
    if (!articleContent) {
      console.warn(
        'Warning: Found an object with no Knowledge Base Article content.'
      );
      return '';
    }
    return formatQA(articleContent);
  });

  // Get embeddings using Gemini API with taskType
  let embeddingsData;
  try {
    const embeddingsResponse = await ai.models.embedContent({
      model: 'gemini-embedding-exp-03-07',
      contents: qaStrings,
      taskType: 'SEMANTIC_SIMILARITY',
    });

    embeddingsData = embeddingsResponse.embeddings.map((emb) => emb.values);

    if (
      !embeddingsData ||
      embeddingsData.length !== qaObjects['results'].length
    ) {
      throw new Error(
        'Mismatch between number of QAs and embeddings received.'
      );
    }
  } catch (error) {
    console.error('Error generating batch embeddings:', error);

    return [];
  }

  const uniqueIndices = [];
  const deletedItems = [];

  for (let i = 0; i < qaObjects['results'].length; i++) {
    let bestMatch = { isDuplicate: false, index: -1, score: 0 };

    for (let j of uniqueIndices) {
      const sim = cosineSimilarity(embeddingsData[i], embeddingsData[j]);
      if (sim >= threshold) {
        bestMatch = { isDuplicate: true, index: j, score: sim };
        break;
      }
    }

    if (!bestMatch.isDuplicate) {
      uniqueIndices.push(i);
    } else {
      deletedItems.push({
        qa: qaObjects[i],
        duplicateOf: qaObjects['results'][bestMatch.index],
        similarity: bestMatch.score,
      });
    }
  }

  const uniqueFullObjects = uniqueIndices.map(
    (index) => qaObjects['results'][index]
  );

  const timeStamp = new Date().toISOString();
  let reportContent = `--- Deduplication Report (${timeStamp}) ---\n\n`;
  reportContent += `Threshold for Similarity: ${threshold}\n\n`;

  reportContent += '--- Kept Articles ---\n';
  if (uniqueFullObjects.length > 0) {
    uniqueFullObjects.forEach((fullObject, index) => {
      // Access the nested article object directly
      const qa = fullObject['Knowledge Base Article'];
      reportContent += `\n[KEPT ${index + 1}]\n`;
      reportContent += `Ticket IDs: ${JSON.stringify(
        fullObject['Ticket IDs']
      )}\n`;
      if (qa) {
        reportContent += `Q: ${qa.question}\n A: ${qa.answer}\n`;
        reportContent += `---\n`;
      } else {
        reportContent += `No Knowledge Base Article present.\n`;
      }
    });
  } else {
    reportContent += 'No unique articles were kept.\n';
  }

  reportContent += '\n--- Deleted (Duplicate) Articles ---\n';
  if (deletedItems.length > 0) {
    deletedItems.forEach((item, index) => {
      // Access nested data directly for both objects
      const deletedQA = item.qa['Knowledge Base Article'];
      const duplicateOfQA = item.duplicateOf['Knowledge Base Article'];

      reportContent += `\n[DELETED ${
        index + 1
      }] (Duplicate of KEPT item with question: \n"${
        duplicateOfQA.question
      }")\n answer: "${duplicateOfQA.answer}"\n`;
      reportContent += `Similarity Score: ${item.similarity.toFixed(4)}\n`;
      reportContent += `Original Ticket IDs: ${JSON.stringify(
        item.qa['Ticket IDs']
      )}\n`;
      reportContent += `Q: ${deletedQA.question}\n A: ${deletedQA.answer} \n`;
      reportContent += `---\n`;
    });
  } else {
    reportContent += 'No articles were deleted.\n';
  }

  return {
    status: 'success',
    results: uniqueFullObjects,
    comparisonReport: reportContent,
  };
};

export default geminiCompare;
