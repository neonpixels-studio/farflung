export {};

declare module "h3" {
  interface H3EventContext {
    userId?: string;
    authMethod?: "api_key" | "clerk";
  }
}
