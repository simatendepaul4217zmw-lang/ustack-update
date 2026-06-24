declare module "@tanstack/react-start/api" {
  type RouteHandler = (ctx: {
    request: Request;
    params: Record<string, string>;
  }) => Response | Promise<Response>;

  export function createAPIFileRoute(
    path: string
  ): (handlers: Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS", RouteHandler>>) => void;
}
