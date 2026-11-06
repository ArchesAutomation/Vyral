declare module "cloudflare:workers" {
  export class DurableObject<E> {
    protected ctx: import("./runtime").StudioContext;
    protected env: E;
    constructor(ctx: import("./runtime").StudioContext, env: E);
  }
}
declare module "react-dom/client" {
  export function createRoot(container: Element): {
    render(children: import("react").ReactNode): void;
    unmount(): void;
  };
}
