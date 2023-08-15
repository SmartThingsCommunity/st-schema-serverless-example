module.exports.convertTemperature = (temperature, fromUnit, toUnit) => {
	if (fromUnit === toUnit) {
		return temperature;
	}
	if (toUnit === 'C') {
		// Convert F to C, in half degrees
		return Math.round(10 * (temperature - 32) / 9) / 2
	}
	// Convert C to F, in full degrees
	return Math.round((9 * temperature / 5) + 32)
}
