import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import apiRoutes from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

const app: Express = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({ message: "E-commerce backend is running" });
});

app.use("/api/v1", apiRoutes);
app.use(errorHandler);

export default app;