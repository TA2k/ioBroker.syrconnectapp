//export mode an javascript object
module.exports = {
  // Identification & general info (no unit)
  getSRN: '', // Serial number (no unit)
  getVER: '', // Firmware version (no unit)
  getTYP: '', // Device type (no unit)
  getCNA: '', // Device name (no unit)
  getALM: '', // Alarm (no unit)
  getCDE: '', // Code / error code (no unit)

  // Resin capacities (assumed in grams – adjust if needed)
  getCS1: 'g', // Capacity exchanger resin 1
  getCS2: 'g', // Capacity exchanger resin 2
  getCS3: 'g', // Capacity exchanger resin 3

  // Program information
  getCYN: '', // Current program number (no unit)
  getCYT: 'mm:ss', // Duration of running program (minutes:seconds)

  // Unknown/reserved
  getDEN: '', // (no unit)

  // Network and gateway
  getDGW: '', // Gateway (no unit)

  // Consumption & flow measurements
  getDWF: 'l/d', // Average daily water consumption in liters per day
  getFCO: 'mg/l', // Iron content in milligrams per liter
  getFIR: '', // Firmware name (no unit)
  getFLO: 'l/min', // Current flow in liters per minute

  // Holiday dates (as calendar values)
  getHED: 'day', // Holiday start day
  getHEM: 'month', // Holiday start month
  getHEY: 'year', // Holiday start year
  getHSD: 'day', // Holiday end day
  getHSM: 'month', // Holiday end month
  getHSY: 'year', // Holiday end year

  // Network addresses
  getIPH: '', // IP address (no unit)

  // Water hardness
  getIWH: '°dH', // Water hardness in German degrees (°dH)
  getMAC: '', // MAC address (no unit)
  getMAN: '', // Manufacturer (no unit)
  getNOT: '', // Alert (no unit)
  getOWH: '°dH', // Soft water hardness in German degrees

  // Additional unknown parameters
  getPA1: '', // (no unit)
  getPA2: '', // (no unit)
  getPA3: '', // (no unit)

  // Pressure and regeneration details
  getPRS: 'bar', // Water pressure (assumed in bar)
  getPST: '', // Pressure sensor installed (boolean, no unit)
  getRDO: 'g', // Regenerant dosage (assumed in grams)
  getRES: '%', // Remaining capacity (percentage)
  getRG1: '', // Regeneration running 1 (boolean)
  getRG2: '', // Regeneration running 2 (boolean)
  getRG3: '', // Regeneration running 3 (boolean)
  getRPD: 'days', // Regeneration every x days (in days)
  getRPW: '', // Regeneration every xth day of week (no unit)
  getRTH: 'h', // Regeneration time (hour) in hours
  getRTI: 'hh:mm', // Total regeneration time in hours:minutes format
  getRTM: 'min', // Regeneration time (minute) in minutes

  // Miscellaneous
  getSCR: '', // Type (no unit)
  getSRE: '', // Service regenerations (count, no unit)

  // Salt supply and container amounts
  getSS1: 'kg', // Salt supply 1 (assumed in kilograms)
  getSS2: 'kg', // Salt supply 2 (assumed in kilograms)
  getSS3: 'kg', // Salt supply 3 (assumed in kilograms)
  getSTA: '', // Name of current program (no unit)
  getSV1: 'kg', // Amount of salt in container 1 (kilograms)
  getSV2: 'kg', // Amount of salt in container 2 (kilograms)
  getSV3: 'kg', // Amount of salt in container 3 (kilograms)
  getTOR: '', // Total regeneration priors (count, no unit)

  // Voltage measurements
  getVAC: 'V', // Voltage (Volts)
  getVS1: 'V', // Voltage sensor 1 (Volts)
  getVS2: 'V', // Voltage sensor 2 (Volts)
  getVS3: 'V', // Voltage sensor 3 (Volts)
  getWHU: '°dH', // Unit of water hardness (°dH)

  // Commands (set-commands have no associated unit)
  setSIR: '', // Regenerate now (command, no unit)
  setSDR: '', // Regenerate later (command, no unit)
  setSMR: '', // Multi regenerate (command, no unit)

  // Consumption by day/week/month (assumed in liters)
  getMOF: 'l', // Consumption Monday (liters)
  getTUF: 'l', // Consumption Tuesday (liters)
  getWEF: 'l', // Consumption Wednesday (liters)
  getTHF: 'l', // Consumption Thursday (liters)
  getFRF: 'l', // Consumption Friday (liters)
  getSAF: 'l', // Consumption Saturday (liters)
  getSUF: 'l', // Consumption Sunday (liters)
  getTOF: 'l', // Consumption today (liters)
  getYEF: 'l', // Consumption yesterday (liters)
  getCWF: 'l', // Consumption current week (liters)
  getLWF: 'l', // Consumption last week (liters)
  getCMF: 'l', // Consumption current month (liters)
  getLMF: 'l', // Consumption last month (liters)
  getCOF: 'l', // Consumption complete (liters)
  getUWF: 'l', // Consumption untreated (liters)
  getTFO: 'l', // Consumption peak level (liters)
};
