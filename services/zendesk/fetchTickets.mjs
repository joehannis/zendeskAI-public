import zendeskApiPull from '../../utils/zendeskApiPull.mjs';
import ticketFilterLogic from '../../utils/ticketFilterLogic.mjs';

const fetchTickets = async (config) => {
  const startDateObj = new Date(config.startDate);
  const zendeskStartTimeSeconds = Math.floor(startDateObj.getTime() / 1000);

  const allRawTickets = [];

  let currentApiUrl = `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/incremental/tickets/cursor.json?start_time=${zendeskStartTimeSeconds}`;

  console.log('Pulling from Zendesk.....');

  while (currentApiUrl) {
    const response = await zendeskApiPull(currentApiUrl, 'GET');

    if (response && response.tickets) {
      allRawTickets.push(...response.tickets);
    } else {
      console.error(
        'Error: Unexpected response structure or no tickets found.',
        response
      );
      break; // Exit loop if response is malformed
    }

    // Use after_url for pagination
    currentApiUrl = response.after_url;
    if (response.end_of_stream) {
      currentApiUrl = null;
    }
  }

  console.log(
    `Finished pulling all raw tickets. Total: ${allRawTickets.length}`
  );

  const filteredTickets = ticketFilterLogic(config, allRawTickets);
  return filteredTickets;
};

export default fetchTickets;
