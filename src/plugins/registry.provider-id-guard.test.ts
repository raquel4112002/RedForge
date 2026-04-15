import { describe, expect, it } from "vitest";
import {
  createPluginRegistryFixture,
  registerVirtualTestPlugin,
} from "../../test/helpers/plugins/contracts-testkit.js";

describe("plugin registry provider id guard", () => {
  it("records a diagnostic instead of crashing when provider id is missing", () => {
    const { config, registry } = createPluginRegistryFixture();

    expect(() => {
      registerVirtualTestPlugin({
        registry,
        config,
        id: "broken-provider-plugin",
        name: "Broken Provider Plugin",
        register(api) {
          api.registerProvider({
            label: "Broken Provider",
            auth: [],
          } as unknown as { id: string; label: string; auth: [] });
        },
      });
    }).not.toThrow();

    expect(registry.registry.providers).toHaveLength(0);
    expect(registry.registry.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: "broken-provider-plugin",
          level: "error",
          message: "provider registration missing id",
        }),
      ]),
    );
  });
});
