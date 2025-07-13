import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const fetchJira = async (ticketId) => {
  const jiraAuthHeader = `Basic ${Buffer.from(
    `${process.env.ZENDESK_EMAIL}:${process.env.JIRA_API_KEY}`
  ).toString('base64')}`;

  const zendeskAuthHeader = `Basic ${Buffer.from(
    `${process.env.ZENDESK_EMAIL}:${process.env.ZENDESK_API_KEY}`
  ).toString('base64')}`;

  const zendeskInitialResponse = await fetch(
    `https://pendo.zendesk.com/api/v2/tickets/${ticketId}.json`,
    {
      method: `GET`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: zendeskAuthHeader,
      },
    }
  );

  const zendeskInitialData = await zendeskInitialResponse.json();

  if (
    zendeskInitialData.ticket.tags.includes(`jira_escalated`) &&
    zendeskInitialData.ticket.tags.includes(`jira_update`)
  ) {
    const linksResponse = await fetch(
      `https://pendo.zendesk.com/api/v2/jira/links?filter[ticket_id]=${zendeskInitialData?.ticket?.id}`,
      {
        method: `GET`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: zendeskAuthHeader,
        },
      }
    );

    const linksData = await linksResponse.json();

    const ticketData = await Promise.all(
      linksData.links.map(async (link) => {
        const jiraResponse = await fetch(
          `https://pendo-io.atlassian.net/rest/api/3/issue/${link.issue_key}`,
          {
            method: `GET`,
            headers: {
              'Content-Type': 'application/json',
              Authorization: jiraAuthHeader,
            },
          }
        );
        const jiraData = await jiraResponse.json();

        const body = jiraData.fields.description.content
          .flatMap(
            (splitBody) =>
              splitBody.content
                ?.filter((text) => text.type === 'text')
                .map((text) => text.text) || []
          )
          .join(' ');

        const comments = jiraData.fields.comment.comments
          .flatMap(
            (comment) =>
              comment.body.content
                .flatMap((paragraph) => {
                  return (
                    paragraph.content
                      ?.filter((text) => text.type === 'text')
                      .map((text) => text.text) || []
                  );
                })
                .join('') + '\n \n' // Add newline after each comment's body
          )
          .join('');

        return { body: body, comments: comments };
      })
    );
    console.log(ticketData);
  }
};

fetchJira('209541');
export default fetchJira;
