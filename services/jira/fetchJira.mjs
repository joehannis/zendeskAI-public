import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const jiraAuthHeader = `Basic ${Buffer.from(
  `${process.env.ZENDESK_EMAIL}:${process.env.JIRA_API_KEY}`
).toString('base64')}`;

const jqlQuery = 'project = "Pendo App" ORDER BY created DESC';

// Function to custom encode JQL
function encodeJQLForJira(jqlString) {
  // Use encodeURIComponent for everything, then un-encode the double quotes
  // This ensures spaces, special characters other than quotes are handled correctly
  let encoded = encodeURIComponent(jqlString);

  // Replace '%22' (encoded double quote) with a literal double quote '"'
  // Note: This needs to be done carefully to ensure other valid % encodings are not affected.
  // A safer approach might be to encode character by character.
  // Let's try a more targeted approach for common JQL components.

  // Simpler approach: encode spaces and a few other common JQL special characters,
  // but *not* the double quotes.
  // The goal is to make it look like the UI's URL.

  // 1. Replace spaces with %20
  // 2. The '=' sign is usually fine, but 'encodeURIComponent' would make it '%3D'.
  //    Since the UI shows '%3D', we'll keep that.
  // 3. Keep double quotes as '"'

  // A more robust way to emulate Jira's UI encoding for JQL:
  // Encode everything *except* the double quotes.
  // We can achieve this by splitting the string, encoding parts, and joining.
  // However, a simpler string replacement for common problematic characters often suffices.

  // Let's manually replace the problematic characters as per the UI example:
  // Space becomes %20
  // = becomes %3D (encodeURIComponent handles this)
  // Double quotes remain "
  // Other characters like ( ) etc, will also need proper encoding.

  // A common way to handle this when `encodeURIComponent` is too aggressive
  // is to use it, then manually replace the over-encoded characters back.

  let jqlStringEncodedForUrl = encodeURIComponent(encoded)
    // .replace(/%22/g, '"') // Replace %22 with "
    .replace(/%3D/g, '=') // Replace %3D with = if your JQL has unquoted equals that need to remain
    .replace(/%5B/g, '[') // For custom field like cf[123]
    .replace(/%5D/g, ']'); // For custom field like cf[123]

  // IMPORTANT: The UI URL you provided already has '=' as %3D.
  // So, we only need to target the double quotes and brackets if they are problematic.
  // Let's re-evaluate based on *your* UI example:
  // `project%20%3D%20"Pendo%20App"%20ORDER%20BY%20created%20DESC`

  // This means:
  // - Space is %20 (handled by encodeURIComponent)
  // - `=` is %3D (handled by encodeURIComponent)
  // - `"` is `"` (NOT handled by encodeURIComponent, needs manual undo)
  // - `[` and `]` for custom fields (e.g., cf[12694]) are often %5B and %5D in the URL if they are part of the *key*.
  //   However, for the UI example you just gave, there's no custom field, so focus on quotes.

  // So, the most direct solution for your current JQL:
  // Use encodeURIComponent, then replace the encoded double quotes back.
  let finalEncodedJql = encodeURIComponent(jqlQuery).replace(/%22/g, '"');

  // If you also need to support custom fields like cf[12694] without encoding brackets,
  // you might need to add:
  // .replace(/%5B/g, '[')
  // .replace(/%5D/g, ']');

  return jqlStringEncodedForUrl;
}

const encodedJql = encodeJQLForJira(jqlQuery);
console.log('Custom Encoded JQL:', encodedJql);

const fetchIssues = async () => {
  const response = await fetch(
    `https://pendo-io.atlassian.net/rest/api/3/search/jql?jql=${encodedJql}`,
    {
      method: 'GET',
      headers: {
        Authorization: jiraAuthHeader,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();
  console.log(data);
};

const fetchJira = async (ticketId) => {
  const zendeskAuthHeader = `Basic ${Buffer.from(
    `majd.kharman@pendo.io/token:omnN9FNo80Vpbe4HtRsqEDHTozQGzMVvIJxhYoDk`
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

fetchIssues();
export default fetchJira;
