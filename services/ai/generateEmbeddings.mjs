import path from 'path';
import dotenv from 'dotenv';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function l2Normalize(vector) {
  if (!vector || vector.length === 0) {
    return [];
  }

  // Calculate the sum of squares
  let sumOfSquares = 0;
  for (let i = 0; i < vector.length; i++) {
    sumOfSquares += vector[i] * vector[i];
  }

  // Calculate the magnitude (Euclidean norm)
  const magnitude = Math.sqrt(sumOfSquares);

  // If magnitude is zero, return the original vector to avoid division by zero
  // (or a zero vector of the same dimension, depending on desired behavior for zero vectors)
  if (magnitude === 0) {
    return vector;
  }

  // Normalize each component
  const normalizedVector = vector.map((component) => component / magnitude);
  return normalizedVector.slice(0, 1536);
}

const generateEmbeddings = async (ai, content) => {
  let embeddingsData;
  try {
    const embeddingsResponse = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: content,
      taskType: 'SEMANTIC_SIMILARITY',
    });

    embeddingsData = embeddingsResponse.embeddings.map((emb) =>
      l2Normalize(emb.values)
    );
    return embeddingsData.flat();
  } catch (error) {
    console.error('Error generating batch embeddings:', error);
    return;
  }
};

export default generateEmbeddings;
