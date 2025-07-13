const postTicketTag = async (resultArray) => {
  const ticketTag = 'AI_summary';
  let idsString = '';

  const idsArray = resultArray.map((obj) => obj.id);
  idsString = idsArray.join(',');

  // const authHeader = `Basic ${Buffer.from(
  //   `${process.env.ZENDESK_EMAIL}/token:${process.env.ZENDESK_API_KEY}`
  // ).toString('base64')}`;

  if (idsString !== '') {
    // const response = await fetch(
    //   `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/update_many.json?ids=${idsString}`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       Authorization: authHeader,
    //     },
    //     body: JSON.stringify({
    //       ticket: {
    //         additional_tags: [`${ticketTag}`],
    //       },
    //     }),
    //   }
    // );
    // if (!response.ok) {
    //   const errorBody = await response.json();
    //   console.error(
    //     `Error fetching Zendesk data from ${url}:`,
    //     response.status,
    //     errorBody
    //   );
    //   // Throw an error to be caught by the calling function (fetchZendesk)
    //   const error = new Error(
    //     `Zendesk API request failed with status ${response.status}`
    //   );
    //   error.statusCode = response.status;
    //   error.details = errorBody;
    //   throw error;
    // }
  }
};
export default postTicketTag;
