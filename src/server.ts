import "dotenv/config";
import app from "./app";
import prismaClient from "./config/prisma";

const port = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
  try {
    await prismaClient.$connect();
    console.log("Database is connected");

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to connect to the database");
    console.error(error);
    process.exit(1);
  }
};

void startServer();