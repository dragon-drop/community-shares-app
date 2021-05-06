// Script to calculate share distributions
// Author: Jonathan Bowen
// Email: jonathan@dragondrop.uk

// define the tables
let distributionsT = base.getTable('Distributions');
let shareHoldingsT = base.getTable('Share holdings');
let transactionsT = base.getTable('Transactions');

// get the shareholdings
let shareHoldingsQ = await shareHoldingsT.selectRecordsAsync();

// pick a distribution to process
let record = await input.recordAsync('Pick a record', distributionsT);

let treatmentMap = {
  'New shares': 'New shares issued',
  'Cash distribution': 'Cash distribution earned'
}

// if a distribution is picked
if (record) {
  // define some variables for later use
  let distributionAssigned = record.getCellValue('Distribution assigned');
  let shareOfferId = record.getCellValue('Share offer')[0]['id'];
  let distribution = record.getCellValue('% distribution');
  let distributionDate = record.getCellValue('Date');

  if (distributionAssigned) {
    output.text('Distributions have already been calculated for this share offer/date - no action will be taken');
  } else {
    output.text(`Calculating distributions for ${record.name}`)
    // get the shareholding records related to the share offer being distributed
    let shareHoldingsR = shareHoldingsQ.records.filter(record => {
      return record.getCellValue('Share offer')[0]['id'] == shareOfferId
    })

    // define an empty array to hold the distributions being calculated
    let thisDistribution = []

    // for each of the shareholdings related to this distribution
    for (let shareHolding of shareHoldingsR) {
      // define some variables for later use
      let shareHoldingDetail = shareHoldingsQ.getRecord(shareHolding.id)
      let member = shareHoldingDetail.getCellValue('Member')[0]['id']
      let amount = shareHoldingDetail.getCellValue('Current investment') ? shareHoldingDetail.getCellValue('Current investment') : shareHoldingDetail.getCellValue('Original investment')
      let distibutionType = shareHoldingDetail.getCellValue('Treatment of interest');
      let distribtionAmount = amount * distribution

      // push values to our array for each shareholding
      thisDistribution.push({
        fields: {
          'Member': [{
            id: member
          }],
          'Share offer': [{
            id: shareOfferId
          }],
          'Type': {
            name: treatmentMap[distibutionType]
          },
          'Date': distributionDate,
          'Amount': distribtionAmount
        }
      })
    }

    // make a copy for later use as we are going to slice the original
    let copyThisDistribution = thisDistribution

    // create the distribution records
    while (thisDistribution.length > 0) {
      await transactionsT.createRecordsAsync(thisDistribution.slice(0, 50));
      thisDistribution = thisDistribution.slice(50);
    }

    // now we are going to update the current value of the shareholding based on the distributions made
    // if treatment of interest is new shares, then add to the original (or current if one exists) - compounding
    // if not new shares, then make the current amount equal to original amount (no compounding)
    let updates = []
    for (let shareholdingR of shareHoldingsR) {
      for (let distribution of copyThisDistribution) {
        if (shareholdingR.getCellValue('Member')[0]['id'] == distribution.fields.Member[0]['id'] && shareholdingR.getCellValue('Treatment of interest') == 'New shares') {
          updates.push({
            id: shareholdingR.id,
            fields: {
              "Current investment": shareholdingR.getCellValue('Current investment') ? shareholdingR.getCellValue('Current investment') + distribution.fields.Amount : shareholdingR.getCellValue('Original investment') + distribution.fields.Amount
            }
          })
        } else if (shareholdingR.getCellValue('Member')[0]['id'] == distribution.fields.Member[0]['id'] && shareholdingR.getCellValue('Treatment of interest') !== 'New shares') {
          updates.push({
            id: shareholdingR.id,
            fields: {
              "Current investment": shareholdingR.getCellValue('Original investment')
            }
          })
        }
      }
    }
    // do the updates in batches of 50
    while (updates.length > 0) {
      await shareHoldingsT.updateRecordsAsync(updates.slice(0, 50));
      updates = updates.slice(50);
    }

    // mark the distribution as assigned
    await distributionsT.updateRecordAsync(record, {
      'Distributions calculated': true
    })
    output.text('Distributions calculated!');
  }
}
