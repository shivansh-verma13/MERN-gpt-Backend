import app from "./app.js";
import { connectToDatabase } from "./db/connections.js";

const PORT = process.env.PORT || 5001;

async function startServer() {
  try {
    await connectToDatabase();
    app.listen(PORT, () => {
      console.log("Server is Up and Running and connected to the Database!");
    });
  } catch (error) {
    console.log(error);
  }
}

startServer();
