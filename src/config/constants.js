const PORT = Number(process.env.PORT) || 3000;
// Illustrative hackathon policy thresholds, not spacecraft specifications.
const MIN_BATTERY = 25;
const MIN_FUEL = 20;
const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 50;

module.exports = {
	PORT,
	MIN_BATTERY,
	MIN_FUEL,
	MIN_TEMPERATURE,
	MAX_TEMPERATURE,
};