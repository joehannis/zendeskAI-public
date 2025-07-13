import express from 'express';
import cors from 'cors';
import zendeskAIRoute from '../routes/zendeskAIRoute.mjs';
const args = process.argv.slice(2);
let selectedAI = 'gemini';
const currentDate = new Date();
let startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
let endDate = null;
let tpa = null;
let tpsa = null;
let docProcess = false;
let reprocess = false;
let tagTickets = false;
let exportTickets = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg.startsWith('--ai='.toLowerCase())) {
    selectedAI = arg.substring(5);
  } else if (arg === '--gemini') {
    selectedAI = 'gemini';
  } else if (arg === '--openai') {
    selectedAI = 'openai';
  }
  if (arg.startsWith('--start-date=')) {
    startDate = arg.substring(13);
  }
  if (arg.startsWith('--end-date=')) {
    endDate = arg.substring(11);
  }
  if (arg.startsWith('--tpa='.toLowerCase())) {
    tpa = arg.substring(6);
  }
  if (arg.startsWith('--tpsa='.toLowerCase())) {
    tpsa = arg.substring(7);
  }
  if (arg.startsWith('--doc-process'.toLowerCase())) {
    docProcess = true;
  }
  if (arg.startsWith('--reprocess'.toLowerCase())) {
    reprocess = true;
  }

  if (arg.startsWith('--tag-tickets'.toLowerCase())) {
    tagTickets = true;
  }
  if (arg.startsWith('--export'.toLowerCase())) {
    exportTickets = true;
  }
}

if (tpa && tpsa) {
  throw new Error(
    'Configuration Error: Please only define either tpa or tpsa, not both'
  );
}

if ((docProcess && !tpa) || (docProcess && tpsa)) {
  throw new Error(
    `Configuration Error: Please define --tpa= with --docs-process`
  );
}

if (tpa && !docProcess) {
  throw new Error(
    `Configuration Error: Cannot use --tpa= to generate articles. Please use --tpsa=`
  );
}

if ((reprocess && !docProcess) || (reprocess && !tpa) || (reprocess && tpsa)) {
  throw new Error(
    `Configuration Error: --repocess cannot be called without --docs-process and --tpa=`
  );
}

if ((tagTickets && docProcess) || (tagTickets && tpa) || (tagTickets && tpsa)) {
  throw new Error(
    `Configuration Error: --tag-tickets can only apply to tickets with no product area or partially missing product area data. Cannot be called with --tpa= or tpsa=`
  );
}

if (
  (exportTickets && !tpa && !tpsa) ||
  (exportTickets && docProcess) ||
  (exportTickets && reprocess) ||
  (exportTickets && tagTickets)
) {
  throw new Error(
    `Configuration Error: --export can only be used --tpa=, --tpsa=, --start-date= and --end-date=`
  );
}
const validAIs = ['default', 'gemini', 'openai'];
if (!validAIs.includes(selectedAI)) {
  console.warn(
    `Warning: Invalid AI specified '${selectedAI}'. Falling back to Gemini.`
  );
}

const server = express();
server.use(express.json({ limit: '50mb' }));
server.use(express.urlencoded({ limit: '50mb' }));
server.use(
  cors({
    origin: '*',
    method: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
  })
);

const port = 3000;
server.locals.config = {
  selectedAI: selectedAI,
  startDate: startDate,
  endDate: endDate,
  tpa: tpa,
  tpsa: tpsa,
  docProcess: docProcess,
  reprocess: reprocess,
  tagTickets: tagTickets,
  exportTickets: exportTickets,
};

server.use('/', zendeskAIRoute);

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

export default server;
