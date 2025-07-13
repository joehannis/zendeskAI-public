import { getUtcStartOfDay, getUtcEndOfDay } from '../utils/dateProcessing.mjs';
import TPA_TPSA_OPTIONS from '../constants/zendesk-technical-product-areas.json' with { type: 'json' };

const ticketFilterLogic = (config, allRawTickets) => {
  const tpaFilter = config.tpa;
  const tpsaFilter = config.tpsa;
  const effectiveStartDateUTC = getUtcStartOfDay(config.startDate);
  const effectiveEndDateUTC = getUtcEndOfDay(config.endDate);

  const tpsaKeys = [];

  TPA_TPSA_OPTIONS.forEach((obj) => {
    obj['custom_field_options'].forEach((option) => {
      let newObj = {};
      newObj['tpa'] = obj['tpa'];
      newObj['tpsa'] = option['value'];
      newObj['sections'] = obj['sections'];
      tpsaKeys.push(newObj);
    });
  });

  const filteredObjects = [];

  //TPA filterting removed due to rate limiting issues. Roadmap to reintroduce.

  // if (tpaFilter) {
  //   //filter tickets by tpa
  //   const tpaObj = tpsaKeys.find((obj) => {
  //     return obj['tpa'] === tpaFilter;
  //   });

  //   if (!tpaObj) {
  //     throw 'tpa does not exist';
  //   }
  //   const filteredTickets = allRawTickets.filter((ticket) => {
  //     const isTpaMatch = ticket.tags.includes(tpaFilter);
  //     const isNotJiraEscalated = config.exportTickets? true : !ticket.tags.includes('jira_escalated');
  //     const ticketCreationDateUTC = new Date(ticket.created_at);

  //     //convert time stamps for date filtering
  //     const passesStartDateFilter =
  //       !effectiveStartDateUTC ||
  //       ticketCreationDateUTC >= effectiveStartDateUTC;
  //     const passesEndDateFilter =
  //       !effectiveEndDateUTC || ticketCreationDateUTC <= effectiveEndDateUTC;
  //     return (
  //       isTpaMatch &&
  //       isNotJiraEscalated &&
  //       passesStartDateFilter &&
  //       passesEndDateFilter
  //     );
  //   });

  //   const filteredTicketsWithTpsa = filteredTickets.map((ticket)=> {
  //    const tpsaTag = ticket.tags.find(tag => tag.startsWith('tpsa_'));
  //     if (tpsaTag) {
      
  //       return { ...ticket, tpsa: tpsaTag };
  //     } else {
  //       return { ...ticket }; 
  //     }

  //   })

  //   if (filteredTicketsWithTpsa.length > 0) {

  //     console.log(`Total tickets after filtering: ${filteredTickets.length}`);
  //     filteredObjects.push({
  //       tpa: tpaObj['tpa'],
  //       sections: tpaObj['sections'],
  //       tickets: filteredTicketsWithTpsa,
  //     });
  //   }
  // } else 
  if (tpsaFilter) {
    const tpsaObj = tpsaKeys.find((obj) => {
      return obj['tpsa'] === tpsaFilter;
    });
    if (!tpsaObj) {
      throw 'tpsa does not exist';
    }
    const filteredTickets = allRawTickets.filter((ticket) => {
      const isTspaMatch = ticket.tags.includes(tpsaFilter);
      const isNotJiraEscalated = config.exportTickets? true : !ticket.tags.includes('jira_escalated');
      const ticketCreationDateUTC = new Date(ticket.created_at);

      const passesStartDateFilter =
        !effectiveStartDateUTC ||
        ticketCreationDateUTC >= effectiveStartDateUTC;
      const passesEndDateFilter =
        !effectiveEndDateUTC || ticketCreationDateUTC <= effectiveEndDateUTC;
      return (
        isTspaMatch &&
        isNotJiraEscalated &&
        passesStartDateFilter &&
        passesEndDateFilter
      );
    });



    if (filteredTickets.length > 0) {
      console.log(`Total tickets after filtering: ${filteredTickets.length}`);
      filteredObjects.push({
        tpa: tpsaObj['tpa'],
        tpsa: tpsaFilter,
        sections: tpsaObj['sections'],
        tickets: filteredTickets,
      });
    }
  // } else {
  //   for (const area of tpsaKeys) {
  //     // if no filters are applied, filter all tickets based on their tpa and tpsa
  //     const filteredTickets = allRawTickets.filter(
  //      config.exportTickets? true : !ticket.tags.includes('jira_escalated')
  //     );

  //     if (filteredTickets.length > 0) {
  //       console.log(`Total tickets after filtering: ${filteredTickets.length}`);
  //       filteredObjects.push({
  //         tpa: area['tpa'] || '',
  //         tpsa: area['tpsa'] || '',
  //         sections: area['sections'] || '',
  //         tickets: filteredTickets,
  //       });
  //     }
  //   }
  }
  return filteredObjects;
};

export default ticketFilterLogic;
