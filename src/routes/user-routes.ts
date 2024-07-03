import { Router } from "express";
import {
  getAllUsers,
  userSignUp,
  userLogin,
  verifyUser,
  logoutUser,
} from "../controllers/user-controllers.js";
import {
  signupValidator,
  loginValidator,
  validate,
} from "../utils/validators.js";
import { verifyToken } from "../utils/token-manager.js";

const userRoutes = Router();

userRoutes.get("/", getAllUsers);
userRoutes.post("/signup", validate(signupValidator), userSignUp);
userRoutes.post("/login", validate(loginValidator), userLogin);
userRoutes.get("/auth-status", verifyToken, verifyUser);
userRoutes.get("/logout", verifyToken, logoutUser);

export default userRoutes;
