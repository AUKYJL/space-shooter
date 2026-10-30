import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type CurrentUser = {
  id: string;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentUser => {
  const request = ctx.switchToHttp().getRequest<{ user?: CurrentUser }>();
  if (!request.user) {
    throw new Error("CurrentUser is missing on request. Did you forget @Auth()?");
  }
  return request.user;
});

