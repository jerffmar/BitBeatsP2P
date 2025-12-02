import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { TrackController } from "./controllers/TrackController";
import { SeedService } from "./services/SeedService";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "*" }));
app.use(express.json());
app.use(morgan("dev"));

app.post("/api/tracks", TrackController.uploadMiddleware, TrackController.upload);
app.get("/api/stream/:id", TrackController.stream);

const PORT = parseInt(process.env.PORT ?? "3000", 10);

void (async () => {
	await SeedService.getInstance().init().catch(err => {
		console.error("SeedService initialization failed", err);
		process.exit(1);
	});
	app.listen(PORT, () => {
		console.log(`BitBeats API listening on port ${PORT}`);
	});
})();

export default app;
