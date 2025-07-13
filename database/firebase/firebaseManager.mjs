import { initializeApp, getApps } from 'firebase-admin/app';
import { Datastore } from '@google-cloud/datastore';
import { Storage } from '@google-cloud/storage';

let firebaseAdminApp;
let datastoreInstance;
let storageInstance;

const articlesBucketName = 'knowledgebase-ai-articles';
const reportsBucketName = 'knowledgebase-ai-reports';

const initializeClients = () => {
  if (!firebaseAdminApp) {
    if (getApps().length === 0) {
      firebaseAdminApp = initializeApp();
    } else {
      firebaseAdminApp = getApps()[0];
    }
  }

  if (!datastoreInstance) {
    datastoreInstance = new Datastore();
  }

  if (!storageInstance) {
    storageInstance = new Storage();
  }
};

export const addArticleToDatastore = async (
  articleMetadata,
  tpa,
  tpsa,
  zendeskArticleResponse,
  timestamp
) => {
  try {
    initializeClients();
  } catch (initError) {
    console.error(
      'Initialization failed for addArticleToDatastore:',
      initError
    );
    return {
      success: false,
      message: `Initialization failed: ${initError.message}`,
    };
  }

  if (
    !zendeskArticleResponse ||
    !zendeskArticleResponse.article ||
    !zendeskArticleResponse.article.id ||
    !zendeskArticleResponse.article.body ||
    !zendeskArticleResponse.article.title
  ) {
    console.error(
      'Validation Error: Missing required fields in zendeskArticleResponse. Expected: { article: { id, title, body } }'
    );
    return {
      success: false,
      message: 'Missing required Zendesk article fields (id, title, or body).',
    };
  }

  const now = timestamp;

  console.log(
    'Attempting to add article for TPA:',
    tpa,
    'TPSA:',
    tpsa,
    'Zendesk Article ID:',
    zendeskArticleResponse.article.id
  );

  try {
    const articleKind = 'articles';

    const keyPath = [
      'tpas',
      tpa, // Parent Kind 'tpas', ID 'tpa'
      'tpsas',
      tpsa, // Child Kind 'tpsas', ID 'tpsa'
      articleKind, // The Kind of the entity being saved ('articles')
    ];

    const articleKey = datastoreInstance.key(keyPath);

    const fullArticleBody = zendeskArticleResponse.article.body;
    let storedAnswerContentRef = '';

    const encoder = new TextEncoder();
    const bodyByteLength = encoder.encode(fullArticleBody).length;
    const MAX_INLINE_BYTES = 1500;

    if (bodyByteLength > MAX_INLINE_BYTES) {
      // Use .html extension if content is HTML
      const fileName = `article-bodies/${zendeskArticleResponse.article.id}.html`;
      const file = storageInstance.bucket(articlesBucketName).file(fileName);

      await file.save(fullArticleBody, {
        contentType: 'text/html',
      });
      storedAnswerContentRef = `gs://${articlesBucketName}/${fileName}`;
    } else {
      storedAnswerContentRef = fullArticleBody;
    }

    const entityData = {
      timestamp: now,
      zendeskId: zendeskArticleResponse.article.id,
      ticketIds: articleMetadata['Ticket IDs'] || [],
      article: {
        question: zendeskArticleResponse.article.title,
        answer: storedAnswerContentRef,
      },
    };

    const entity = {
      key: articleKey,
      data: entityData,
    };

    await datastoreInstance.save(entity);

    const newArticleId = articleKey.id;

    console.log(
      `Successfully added article with Datastore ID: ${newArticleId} for Zendesk Article ID: ${zendeskArticleResponse.article.id} under TPA: ${tpa}, TPSA: ${tpsa}.`
    );
    return {
      success: true,
      articleId: newArticleId,
      message: `Article added successfully.`,
    };
  } catch (error) {
    console.error('Error adding article to Datastore:', error);
    const errorMessage =
      error.details || error.message || 'An unknown error occurred.';
    return {
      success: false,
      message: `Failed to add article: ${errorMessage}`,
      error: error,
    };
  }
};

export const addReportToDatastore = async (report, timestamp) => {
  try {
    initializeClients(); // Initialize all clients
  } catch (initError) {
    console.error('Initialization Error for addReportToDatastore:', initError);
    return {
      success: false,
      message: `Initialization failed: ${initError.message}`,
    };
  }

  // Validate inputs
  if (typeof report !== 'string' || report.trim().length === 0) {
    console.error(
      'Validation Error: Comparison report is missing or not a valid string.'
    );
    return {
      success: false,
      message: 'Comparison report is missing or not a valid string.',
    };
  }

  // 'timestamp' is guaranteed to be a Date object now
  const now = timestamp;

  console.log(
    'Attempting to add comparison report at timestamp:',
    now.toISOString()
  );

  try {
    const reportKind = 'comparison-reports';
    const keyPath = [reportKind];
    const comparisonKey = datastoreInstance.key(keyPath);

    let storedReportContentRef = '';

    const encoder = new TextEncoder();
    const reportByteLength = encoder.encode(report).length;
    const MAX_INLINE_BYTES = 1500;

    if (reportByteLength > MAX_INLINE_BYTES) {
      const fileName = `comparison-reports/${now.toISOString()}.txt`;
      const file = storageInstance.bucket(reportsBucketName).file(fileName);

      await file.save(report, {
        contentType: 'text/plain',
      });
      storedReportContentRef = `gs://${reportsBucketName}/${fileName}`;
    } else {
      storedReportContentRef = report;
    }

    const entityData = {
      timestamp: now,
      comparisonReport: storedReportContentRef,
    };

    const entity = {
      key: comparisonKey,
      data: entityData,
    };

    await datastoreInstance.save(entity);
    const newReportId = comparisonKey.id;

    console.log(
      `Successfully added comparison report to Datastore with ID: ${newReportId}`
    );
    return {
      success: true,
      reportId: newReportId,
      message: `Comparison report added successfully.`,
    };
  } catch (error) {
    console.error('Error adding comparison report to Datastore:', error);
    const errorMessage =
      error.details || error.message || 'An unknown error occurred.';
    return {
      success: false,
      message: `Failed to add report: ${errorMessage}`,
      error: error,
    };
  }
};
