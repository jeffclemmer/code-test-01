#!/usr/bin/env node

import {promises as fs} from 'fs';
import {parse} from 'csv-parse/sync';

// zip columns
// we don't need COUNTY_CODE = 2, NAME = 3, 
const ZIPCODE = 0, STATE = 1, RATE_AREA = 4;

// plan columns - state and rate_area are the same for zip columns
// we don't need PLAN_ID = 0
const METAL_LEVEL = 2, RATE = 3; 

// *** uncomment to test time *** 
// console.time("parse1");

// Normally something like this would be streamed from the files, 
// but, for this situation, loading the entire thing into memory
// is fine.

// load file
const zipsa = await fs.readFile(`./zips.csv`);
const zipsb = parse(zipsa);
// we don't need the first row
const zips = zipsb.slice(1);

// load file
const plansa = await fs.readFile(`./plans.csv`);
const plansb = parse(plansa);
const plans = plansb.slice(1);

// load file
const slcspa = await fs.readFile(`./slcsp.csv`);
const slcspb = parse(slcspa);
const slcsp = slcspb.slice(1);

// create an array of slcsp zips
let slcspMap = [];
for (let i in slcsp) {
  slcspMap.push(slcsp[i][ZIPCODE]);
}
// uncomment to show data structure
// console.log("slcspMap:", slcspMap);
// process.exit();

// create a more efficient map of plans
let planMap = {};
for (let i in plans) {
  
  // keep only silver plans
  if (plans[i][ METAL_LEVEL ] == "Silver") {
    
    // for code readability
    // join state and rate area - concat into one string
    // we use keys so we have fast access later.
    const key = `${zips[i][STATE]}-${zips[i][RATE_AREA]}`;
    
    // for code readability
    const value = parseFloat( plans[i][RATE] );
    
    if ( key in planMap ) {
      
      // double check that the value doesn't already 
      // exist in the array
      if ( planMap[ key ].includes( value ) == false ) {
        // append rate to already existing state and rate_area key
        planMap[ key ].push( value );
      }
      
    } else {
      
      // add a new state and rate area key
      planMap[ key ] = [ value ];
      
    }
  }
}

// sort each planMap array
for (let i in planMap) {
  planMap[i].sort( (a, b) => { return a - b } );
}

/* 
planMap looks like this:
{
  ...
  state-rate_area : [ rate, rate... ]
  'WI-3': [ 365.48, 369.4 ],
  'IA-1': [ 273.76, 287.3, 322.34, 337.76, 388.68 ],
  'NC-12': [
    332.21, 344.64,
    353.93, 357.64,
    359.83,  384.9,
    406.25
  ],
  ...
}

*/
// uncomment to show data structure
// console.log("planMap:", planMap);
// process.exit();


// this code essentially joins planMap with slcsp data
let zipMap = {};
for (let i in zips) {
  
  let key = zips[i][ZIPCODE];
  
  // make sure we're looking at a zip that we need
  if ( slcspMap.includes(key) == true ) {
    
    // check if we have a zipMap entry already.
    // if we do, this would be ambiguous according to the
    // assignment rules, so we mark ambiguous, unless
    // we have a zip in multiple counties
    
    if ( (key in zipMap) == false) {
      // add new entry
      
      // this is a key pointer into planMap - for readability
      let pointer = `${zips[i][STATE]}-${zips[i][RATE_AREA]}`;
      
      // make sure that the pointer exists in planMap
      // this constitutes a "join" of the two tables
      // based on the key "state" + "rate_area"
      
      if (pointer in planMap) {
        
        // does plan map have more than one array member?
        // if so, we have a second lowest plan
        if (planMap[ pointer ].length > 1) {
          
          // create an object, just in case we get a zip code that 
          // is in two counties.  we want to store the rate_area 
          // just in case we run into this zip again.
          
          zipMap[ key ] = { 
            rate: planMap[ pointer ][1], 
            rateAreas: zips[i][RATE_AREA],
          }
          
        } else {
          zipMap[ key ] = "no second lowest rate plan";
        }
        
      } else {
        // do we try to find the plan another way?
        zipMap[ key ] = "no rate plan";
      }
      
    } else {
      
      // "26716" zip has the same rate plan "9", but is in 
      // two different counties, so this wouldn't be amibiguous.
      // we can still determine the rate
      
      // check to see if the zip code has more than one entry, 
      // that the rate plan is the same, but the zip is in 
      // two different counties
      
      // if this array already includes the rate_area, then we just
      // push the value on to the stack and move on.  the rate 
      // is still good.  if it doesn't match, then we have an 
      // ambiguous situation and we mark it as ambiguous
      if ( typeof zipMap[ key ] != "object" || zipMap[ key ].rateAreas != zips[i][RATE_AREA] ) {
        // blank out this entry - it's ambiguous
        zipMap[ key ] = "amibiguous";
      }
      
    }
    
  }
  
}

/* 
zipMap looks like this:
{
  '39745': { rate: 265.73, rateAreas: '6' },
  '39845': { rate: 325.64, rateAreas: '15' },
  '40813': 'no rate plan',
  '42330': 'no rate plan',
  '43343': 'amibiguous',
  '46706': 'amibiguous',
  '47387': { rate: 326.98, rateAreas: '11' },
}
*/
// uncomment to show data structure
// console.log("zipMap:", zipMap);
// process.exit();


// write results in specified order according to slcsp
process.stdout.write(`zipcode,rate\n`);

for (let i in slcspMap) {
  
  // only printable rates are stored as objects
  // any messages are stored as strings and we don't want to 
  // print those
  if (typeof zipMap[ slcspMap[i] ] == "object") {
    process.stdout.write(`${slcspMap[i]},${zipMap[ slcspMap[i] ].rate.toFixed(2)}\n`);
  } else {
    process.stdout.write(`${slcspMap[i]},\n`);
  }
  
}

// *** uncomment to test time *** 
// console.timeEnd("parse1");

// *** uncomment to show memory usage *** 
// const used = process.memoryUsage().heapUsed / 1024 / 1024;
// console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
