import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Filter } from 'firebase-admin/firestore';

let firebaseAdminApp;
let firestoreInstance;

if (!firebaseAdminApp) {
  firebaseAdminApp = getApps().length === 0 ? initializeApp() : getApps()[0];
}

if (!firestoreInstance) {
  firestoreInstance = getFirestore();
}

export const addArticleToFirestore = async (
  article,
  zendeskId,
  articleMetadata
) => {
  const batch = firestoreInstance.batch();

  // --- UNIFIED COLLECTION REFERENCE FOR ALL LEVELS ---
  const unifiedCollectionRef = firestoreInstance
    .collection('articles')
    .doc(articleMetadata.tpa)
    .collection('content');

  const fullArticleRef = unifiedCollectionRef.doc(zendeskId);
  batch.set(fullArticleRef, {
    zendeskId: zendeskId,
    fullArticleText: article.fullArticleText,
    embedding: FieldValue.vector(article.fullArticleEmbedding),
    originalArticleTitle: article.title,
    tpa: articleMetadata.tpa,
    tpsa: articleMetadata.tpsa,
    ticketIds: articleMetadata['Ticket IDs'],
    type: 'full_article',
    timestamp: FieldValue.serverTimestamp(),
  });
  console.log(
    `Added full article (type: full_article) to batch: ${fullArticleRef.path}`
  );

  // --- 2. Add Sections (Level 1) ---
  for (const section of article.sections) {
    const sectionId = `${zendeskId}_section_${section.sectionIndex}`;
    const sectionRef = unifiedCollectionRef.doc(sectionId);
    batch.set(sectionRef, {
      zendeskId: zendeskId,
      sectionText: section.sectionText,
      sectionIndex: section.sectionIndex,
      embedding: FieldValue.vector(section.sectionEmbedding),
      originalArticleTitle: article.title,
      tpa: articleMetadata.tpa,
      tpsa: articleMetadata.tpsa,
      ticketIds: articleMetadata['Ticket IDs'],
      type: 'article_section',
      timestamp: FieldValue.serverTimestamp(),
    });
    console.log(
      `Added section (type: article_section) to batch: ${sectionRef.path}`
    );

    // --- 3. Add Chunks (Level 2) ---
    for (const chunk of section.chunks) {
      // Generate a unique ID for each chunk document within the 'content' collection
      const chunkId = `${zendeskId}_section_${section.sectionIndex}_chunk_${chunk.chunkIndex}`; // Example unique ID
      const chunkRef = unifiedCollectionRef.doc(chunkId); // All docs go into unified collection
      batch.set(chunkRef, {
        zendeskId: zendeskId,
        chunkText: chunk.chunkText,
        chunkIndex: chunk.chunkIndex,
        embedding: FieldValue.vector(chunk.chunkEmbedding), // Common embedding field
        originalArticleTitle: article.title,
        tpa: articleMetadata.tpa,
        tpsa: articleMetadata.tpsa,
        ticketIds: articleMetadata['Ticket IDs'],
        parent_section_id: sectionId,
        type: 'article_chunk',
        timestamp: FieldValue.serverTimestamp(),
      });
      console.log(
        `Added chunk (type: article_chunk) to batch: ${chunkRef.path}`
      );
    }
  }

  // --- Commit the entire batch ---
  try {
    await batch.commit();
    console.log(
      `All hierarchical data for article "${article.title}" (${zendeskId}) committed to 'content' collection successfully!`
    );
    return {
      success: true,
      message: `Article ${zendeskId} and its hierarchy added to 'content'.`,
    };
  } catch (e) {
    console.error('Firestore batch write error:', e);
    return {
      success: false,
      message: `Firestore batch write failed: ${e.message}`,
    };
  }
};

export const fetchArticlesFromFirestore = async (tpa) => {
  const articlesRef = await firestoreInstance
    .collectionGroup('content')
    .where('tpa', '==', tpa)
    .where('type', '==', 'full_article')
    .get();

  const results = articlesRef.docs.map((doc) => ({
    ...doc.data(),
  }));

  return results;
};

export const addDocToFirestore = async (doc, tpa, zendeskId) => {
  const batch = firestoreInstance.batch();

  // --- UNIFIED COLLECTION REFERENCE FOR ALL LEVELS ---
  const unifiedCollectionRef = firestoreInstance
    .collection('articles')
    .doc(tpa)
    .collection('content');

  // Generate a unique ID for the original article. This ID will also be used
  // as the 'parent_doc_id' for all sections and chunks derived from this article.

  // --- 1. Add the Full Document (Level 0) ---
  // The document ID for the full article will be its originalArticleId
  const fullDocRef = unifiedCollectionRef.doc(zendeskId);
  batch.set(fullDocRef, {
    zendeskId: zendeskId,
    fullDocText: doc.fullDocText,
    embedding: FieldValue.vector(doc.fullDocEmbedding), // Common embedding field
    originalDocTitle: doc.title, // Main title of the article
    tpa: tpa,
    type: 'full_doc',
    timestamp: FieldValue.serverTimestamp(),
  });
  console.log(`Added full doc (type: full_doc) to batch: ${fullDocRef.path}`);

  // --- 2. Add Sections (Level 1) ---
  for (const section of doc.sections) {
    // Generate a unique ID for each section document within the 'content' collection
    const sectionId = `${zendeskId}_section_${section.sectionIndex}`; // Example unique ID
    const sectionRef = unifiedCollectionRef.doc(sectionId); // All docs go into unified collection
    batch.set(sectionRef, {
      zendeskId: zendeskId,
      sectionText: section.sectionText,
      sectionIndex: section.sectionIndex,
      embedding: FieldValue.vector(section.sectionEmbedding), // Common embedding field
      originalDocTitle: doc.title, // Link back to original article title
      tpa: tpa,
      type: 'doc_section', // <-- Differentiator for this document
      timestamp: FieldValue.serverTimestamp(),
    });
    console.log(
      `Added section (type: doc_section) to batch: ${sectionRef.path}`
    );

    // --- 3. Add Chunks (Level 2) ---
    for (const chunk of section.chunks) {
      // Generate a unique ID for each chunk document within the 'content' collection
      const chunkId = `${zendeskId}_section_${section.sectionIndex}_chunk_${chunk.chunkIndex}`; // Example unique ID
      const chunkRef = unifiedCollectionRef.doc(chunkId); // All docs go into unified collection
      batch.set(chunkRef, {
        chunkText: chunk.chunkText,
        chunkIndex: chunk.chunkIndex,
        embedding: FieldValue.vector(chunk.chunkEmbedding), // Common embedding field
        originalDocTitle: doc.title,
        zendeskId: zendeskId, // Link to its parent full document
        parent_section_id: sectionId, // Link to its parent section
        tpa: tpa,
        type: 'doc_chunk', // <-- Differentiator for this document
        timestamp: FieldValue.serverTimestamp(),
      });
      console.log(`Added chunk (type: doc_chunk) to batch: ${chunkRef.path}`);
    }
  }

  // --- Commit the entire batch ---
  try {
    await batch.commit();
    console.log(
      `All hierarchical data for doc "${doc.title}" (${zendeskId}) committed to 'content' collection successfully!`
    );
    return {
      success: true,
      message: `Doc ${zendeskId} and its hierarchy added to 'content'.`,
    };
  } catch (e) {
    console.error('Firestore batch write error:', e);
    return {
      success: false,
      message: `Firestore batch write failed: ${e.message}`,
    };
  }
};

export const docsSearch = async (title) => {
  const query = firestoreInstance
    .collectionGroup('content')
    .where('original_doc_title', '==', title);

  const snapshot = await query.get();

  const results = [];
  snapshot.forEach((chunk) => {
    results.push(chunk.data());
  });

  return { success: true, data: results };
};

export const docsDelete = async (title) => {
  const query = firestoreInstance
    .collectionGroup('content')
    .where('originalDocTitle', '==', title);

  try {
    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`No documents found with title "${title}" to delete.`);
      return {
        success: true,
        message: `No documents found with title "${title}" to delete.`,
      };
    }

    const batch = firestoreInstance.batch();

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(
      `Successfully deleted ${snapshot.size} documents with title "${title}".`
    );
    return {
      success: true,
      message: `Successfully deleted ${snapshot.size} documents.`,
    };
  } catch (error) {
    console.error(`Error deleting documents with title "${title}":`, error);
    return {
      success: false,
      message: `Error deleting documents: ${error.message}`,
    };
  }
};

export const hierarchicalVectorSearch = async (queryEmbedding) => {
  const baseLevel1Query = firestoreInstance
    .collectionGroup(`content`)
    .where(
      Filter.or(
        Filter.where('type', '==', 'doc_section'),
        Filter.where('type', '==', 'article_section')
      )
    );

  const sectionLevelResults = await baseLevel1Query
    .findNearest({
      vectorField: 'embedding', // The field in your documents containing the vector
      queryVector: queryEmbedding, // The embedding of the user's query/ticket summary
      limit: 10,
      distanceMeasure: 'DOT_PRODUCT',
      distanceThreshold: 0.5,
    })
    .get();

  const relevantSectionIds = [];
  const retrievedSectionInfo = {};

  sectionLevelResults.forEach((doc) => {
    console.log(doc.data);
    const data = doc.data();
    // Although we filtered by type in the query, a final check here is good practice if using collectionGroup.
    if (data.type === 'doc_section') {
      relevantSectionIds.push(doc.id); // This is the section document's unique ID
      retrievedSectionInfo[doc.id] = data; // Store full section data for context lookup (e.g., its title)
    }
  });

  if (relevantSectionIds.length === 0) {
    console.log('Stage 1: No relevant sections found.');
    return { success: true, data: [], message: 'No relevant sections found.' };
  }
  console.log(`Stage 1: Found ${relevantSectionIds.length} relevant sections.`);

  // --- Stage 2: Fine-Grained Search (Drill Down for Precise Chunks) ---
  // Goal: Retrieve the most relevant *chunks* from *within* the identified sections.
  // We query the same 'content' collection for documents of type 'doc_chunk'.

  const baseLevel2Query = firestoreInstance
    .collectionGroup(`content`)
    .where(
      Filter.or(
        Filter.where('type', '==', 'doc_chunk'),
        Filter.where('type', '==', 'article_chunk')
      )
    );

  const sectionsToQueryIn = relevantSectionIds.slice(0, 10); // Limit to 10 for the 'in' clause

  console.log('sectionsToQueryIn', sectionsToQueryIn);

  let chunkResults;
  if (sectionsToQueryIn.length > 0) {
    chunkResults = await baseLevel2Query
      .where('parent_section_id', 'in', sectionsToQueryIn) // Crucial: Filter chunks by their parent sections
      .findNearest({
        vectorField: 'embedding',
        queryVector: queryEmbedding,
        limit: 10, // Retrieve top N chunks from WITHIN these relevant sections
        distanceMeasure: 'DOT_PRODUCT',
        distanceThreshold: 0.85, // A higher threshold for fine-grained, precise details
      })
      .get();
  } else {
    chunkResults = { size: 0, forEach: () => {} };
  }

  const topRelevantChunks = [];
  chunkResults.forEach((doc) => {
    const data = doc.data();
    if (data.type === 'doc_chunk' || data.type === 'article_chunk') {
      topRelevantChunks.push({
        id: doc.id,
        distance: doc.distance, // The similarity score
        chunk_text: data.chunkText,
        parent_doc_id: data.parent_doc_id,
        parent_section_id: data.parent_section_id,
        original_doc_title: data.originalDocTitle,

        tpa: data.tpa, // Also pass the tpa of the retrieved chunk
      });
    }
  });
  console.log(
    `Stage 2: Found ${topRelevantChunks.length} top relevant chunks.`
  );

  return {
    success: true,
    data: topRelevantChunks,
    message: 'Hierarchical search completed.',
  };
};
