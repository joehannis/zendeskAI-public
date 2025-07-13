/* The logic for this works, but KB articles work using sections, and the sections do not follow the same structure as ticket fields. 
Need to work out how to combine ticket fields with the correct KB sections in order to pull these dynamically*/

const fetchTicketFields = async () => {
  const allTicketFields = await zendeskApiPull(
    'https://pendo.zendesk.com/api/v2/ticket_fields',
    'GET'
  );

  const productAreasList = [];

  allTicketFields.ticket_fields.forEach((area) => {
    if (area.title === 'Technical Product Area') {
      if (area.custom_field_options) {
        area.custom_field_options.forEach((tpa) => {
          const newObj = {
            tpaName: tpa.name,
            tpaValue: tpa.value,
            tpsaValues: [],
          };
          productAreasList.push(newObj);
        });
      }
    }
  });

  productAreasList.forEach((tpaObject) => {
    const subAreaTitle = `${tpaObject.tpaName} Technical Product Sub-area`;
    const matchingSubAreaField = allTicketFields.ticket_fields.find(
      (field) => field.title === subAreaTitle
    );
    if (matchingSubAreaField && matchingSubAreaField.custom_field_options) {
      tpaObject.tpsaValues = matchingSubAreaField.custom_field_options.map(
        (option) => option.value
      );
    }
  });

  console.log(productAreasList);
};
