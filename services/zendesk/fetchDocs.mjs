import zendeskApiPull from '../../utils/zendeskApiPull.mjs';

const fetchDocs = async (subArea) => {
  const completeObjArr = [];
  await Promise.all(
    subArea.map(async (area) => {
      if (area['sections']) {
        const sectionDocsPromises = area['sections'].map(async (section) => {
          const docs = await zendeskApiPull(
            `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/help_center/articles/search.json?section=${section['id']}`,
            'GET'
          );
          return (
            docs?.results?.map((doc) => ({
              title: doc.title,
              body: doc.body,
              url: doc.url,
            })) || []
          ); // Return an empty array if no results
        });

        const arrayOfDocArrays = await Promise.all(sectionDocsPromises);

        // Flatten the array of arrays into a single newDocsArray
        const newDocsArray = arrayOfDocArrays.flat();

        const completeObj = {
          ...area,
          docs: newDocsArray,
        };

        completeObjArr.push(completeObj);
      }
    })
  );
  return completeObjArr;
};

export default fetchDocs;
