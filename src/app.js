const express = require("express");
const healthRoutes = require("./routes/health.routes");
const spacecraftRoutes = require("./routes/spacecraft.routes");
const commandQueueRoutes = require("./routes/commandQueue.routes");

const app = express();

app.use(express.json());
app.use(healthRoutes);
app.use(spacecraftRoutes);
app.use(commandQueueRoutes);

app.use((error, request, response, next) => {
	if (response.headersSent) {
		return next(error);
	}

	if (error.type === "entity.parse.failed") {
		return response.status(400).json({
			success: false,
			error: { code: "INVALID_JSON", message: "Request body must be valid JSON" },
		});
	}

	return response.status(500).json({
		success: false,
		error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
	});
});

module.exports = app;