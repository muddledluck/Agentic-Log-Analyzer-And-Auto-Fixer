import { Request, Response } from 'express';
import { catchAsync } from "../../shared/utils/catchAsync";
import { AuthService } from "./auth.service";

export const register = catchAsync(async (req: Request, res: Response) => {
  const { token, result } = await AuthService.register(req.body);

  res.status(201).json({
    message: "Registration successful",
    token,
    user: { id: result.user.id, email: result.user.email },
    organization: result.org,
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { token, user } = await AuthService.login(req.body);

  res.status(200).json({
    message: "Login successful",
    token,
    user: { id: user.id, email: user.email },
  });
});


