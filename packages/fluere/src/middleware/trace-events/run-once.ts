import { createHandlerDecorator } from "./create-handler-decorator";

const noop: (...args: any[]) => void = function noop() {};

export const runOnce = createHandlerDecorator({
  debugLabel: "onceHook",
  getInitialValue: () => false,
  onBeforeHandler: (handler, _, tracked) => (tracked ? noop : handler),
  onAfterHandler: () => true,
});
