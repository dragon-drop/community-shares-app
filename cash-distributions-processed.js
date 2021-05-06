// Script to mark cash distributions as paid out
// Author: Jonathan Bowen
// Email: jonathan@dragondrop.uk

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

// check if input date is valid
let isValid = date => {
  return date.getTime() === date.getTime();
};

// define the tables
let transactionsT = base.getTable('Transactions');
let cashDistributionsV = transactionsT.getView('Cash distributions');
let cashDistributionsR = await cashDistributionsV.selectRecordsAsync();

// input the date that the distributions should be allocated to
let inputDate = await input.textAsync('Please enter the date that you will make the cash distribution payments (format: YYYY-MM-DD)');
// convert to a date
let distributionDate = new Date(inputDate);
// check if the date is valid
if (isValid(distributionDate)) {
  let year = distributionDate.getFullYear();
  let date = distributionDate.getDate();
  let monthIndex = distributionDate.getMonth();
  let monthName = months[monthIndex];
  let formattedDate = `${date} ${monthName} ${year}`

  // output the date to allow confirmation that it is correct
  let shouldContinue = await input.buttonsAsync(
    `You are about to create cash distributions for ${formattedDate} - would you like to proceed?`,
    [{
        label: 'Cancel',
        value: 'cancel',
        variant: 'danger'
      },
      {
        label: 'Proceed',
        value: 'yes',
        variant: 'primary'
      },
    ],
  );
  // if proceed chosen
  if (shouldContinue === 'yes') {
    // filter the records where cash distribution paid is true, i.e. they have already been marked as paid out
    let recordsToProcess = cashDistributionsR.records.filter(record => !record.getCellValue('Cash distribution paid'))

    // if there are no records to process, then end
    if (recordsToProcess.length == 0) {
      output.text('There are no records to process!')
      // otherwise...
    } else {
      // create empty array to hold the cash distributions
      let newCashDistributions = []
      // loop through the records and push into the empty array
      for (let record of recordsToProcess) {
        newCashDistributions.push({
          fields: {
            'Member': [{
              id: record.getCellValue('Member')[0]['id']
            }],
            'Share offer': [{
              id: record.getCellValue('Share offer')[0]['id']
            }],
            'Date': distributionDate,
            'Type': {
              name: 'Cash distribution paid'
            },
            'Amount': record.getCellValue('Amount'),
            'Cash distribution paid': true
          }
        })
      }

      // create new records in transactions table for these distributions
      while (newCashDistributions.length > 0) {
        await transactionsT.createRecordsAsync(newCashDistributions.slice(0, 50));
        newCashDistributions = newCashDistributions.slice(50);
      }

      // now mark the original distribution records as paid out too
      // create a data array
      let updateRecordsToProcess = recordsToProcess.map(r => {
        return {
          'id': r.id,
          'fields': {
            'Cash distribution paid': true
          }
        }
      })
      // now do the update
      while (updateRecordsToProcess.length > 0) {
        await transactionsT.updateRecordsAsync(updateRecordsToProcess.slice(0, 50));
        updateRecordsToProcess = updateRecordsToProcess.slice(50);
      }
    }
  }
} else {
  output.text('The date entered is invalid. Please run the script again and enter it in the format YYYY-MM-DD')
}
