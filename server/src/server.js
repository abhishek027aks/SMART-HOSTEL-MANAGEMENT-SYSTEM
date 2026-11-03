const app = require("./app");
const config = require("./config");
const connectDatabase = require("./config/db");

let server;
let shuttingDown = false;

const shutdown = (signal) => {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    console.log(`Received ${signal}. Shutting down server...`);

    if (!server) {
        console.log("Server shutdown complete.");
        process.exit(0);
    }

    server.close((error) => {
        if (error) {
            console.error("Graceful shutdown failed.", error);
            process.exit(1);
        }

        console.log("Server shutdown complete.");
        process.exit(0);
    });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const startServer = async () => {
    try {
        config.validateAuthConfig();
        await connectDatabase(config.mongoUri);

        server = app.listen(config.port, () => {
            console.log(`Smart Hostel Management System server running on port ${config.port}`);
        });
    } catch (error) {
        console.error("Server startup failed.", error);
        process.exit(1);
    }
};

startServer();
