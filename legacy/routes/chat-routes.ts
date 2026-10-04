import { Router } from "express";
import { verifyToken } from "../utils/token-manager.js";
import { chatCompletionValidator, validate } from "../utils/validators.js";
import {
  deleteAllChats,
  generateChatCompletion,
  sendAllChatsToUser,
} from "../controllers/chat-controllers.js";

// Protected API
const chatRoutes = Router();

chatRoutes.post(
  "/new",
  validate(chatCompletionValidator),
  verifyToken,
  generateChatCompletion
);

chatRoutes.get("/all-chats", verifyToken, sendAllChatsToUser);

chatRoutes.delete("/delete", verifyToken, deleteAllChats);

export default chatRoutes;
