import app from "./app";
import { logger } from "./lib/logger";
import {
  seedMainExercisesIfEmpty,
  seedDefaultMultipliersIfEmpty,
  seedDefaultEquipmentIfEmpty,
} from "./lib/levels";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  try {
    const { seeded } = await seedMainExercisesIfEmpty();
    if (seeded > 0) {
      logger.info({ seeded }, "Seeded default main exercises");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed main exercises");
  }

  try {
    const { seeded } = await seedDefaultMultipliersIfEmpty();
    if (seeded > 0) {
      logger.info({ seeded }, "Seeded default bodyweight multipliers");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed default multipliers");
  }

  try {
    const { seeded } = await seedDefaultEquipmentIfEmpty();
    if (seeded > 0) {
      logger.info({ seeded }, "Seeded default exercise equipment");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed default equipment");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start();
