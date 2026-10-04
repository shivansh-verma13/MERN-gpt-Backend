import { connect, disconnect } from "mongoose";

async function connectToDatabase() {
  try {
    await connect(process.env.MONGODB_URL);
  } catch (error) {
    console.error("Could not connect to MongoDB: ", error.message);
  }
}

async function disconnectFromDatabase() {
  try {
    await disconnect();
  } catch (error) {
    console.error("Could not disconnect from MongoDB: ", error.message);
  }
}

export { connectToDatabase, disconnectFromDatabase };
