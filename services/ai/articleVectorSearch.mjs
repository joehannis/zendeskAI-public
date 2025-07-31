import { convertHtmlToText } from '../../utils/ragProcessing.mjs';
import { hierarchicalVectorSearch } from '../../database/firestore/firestoreManager.mjs';
import generateEmbeddings from './generateEmbeddings.mjs';
import articleCompare from './articleCompare.mjs';

const articleVectorSearch = async (ai, allArticles) => {
  await Promise.all(
    allArticles.map(async (article) => {
      const articleString = `${article['Knowledge Base Article']?.question}\n\n ${article['Knowledge Base Article']?.answer}`;
      const convertedArticle = convertHtmlToText(articleString);

      console.log(
        `Generating embedding for article: "${article['Knowledge Base Article']?.question}"`
      );
      const articleEmbedding = await generateEmbeddings(ai, convertedArticle);
      article.embedding = articleEmbedding;

      return article;
    })
  );

  const comparedArticles = await articleCompare(allArticles);
  console.log(...comparedArticles);

  const finalArticlesPromises = comparedArticles.map(async (article) => {
    console.log('Searching for similar content in vector store...');

    const searchResultForPrecheck = await hierarchicalVectorSearch(
      article.embedding
    );

    if (
      searchResultForPrecheck.success &&
      searchResultForPrecheck.data.length > 0
    ) {
      // If results exist above the threshold, then a similar article (chunk) already exists.
      const matchedChunk = searchResultForPrecheck.data[0];
      console.log(
        `  --> Skipping article: "${article['Knowledge Base Article'].question}"`
      );
      console.log(
        `      Reason: Found highly similar content, Distance: ${matchedChunk.distance})`
      );
      return;
    } else {
      // No sufficiently similar content found, proceed with full processing and storing
      console.log(
        `  --> No highly similar content found. Proceeding with full processing for "${article['Knowledge Base Article'].question}"`
      );
      return article;
    }
  });

  const finalArticles = await Promise.all(finalArticlesPromises);
  return finalArticles;
};

export default articleVectorSearch;
