import { describe, expect, it } from "vitest";
import {
  createPluginRegistryFixture,
  registerVirtualTestPlugin,
} from "../../test/helpers/plugins/contracts-testkit.js";
import type { SpeechProviderPlugin } from "./types.js";

describe("plugin registry provider id guard", () => {
  it("records a diagnostic instead of crashing when speech provider id is missing", () => {
    const { config, registry } = createPluginRegistryFixture();

    expect(() => {
      registerVirtualTestPlugin({
        registry,
        config,
        id: "broken-provider-plugin",
        name: "Broken Provider Plugin",
        register(api) {
          api.registerSpeechProvider({
            label: "Broken Speech Provider",
          } as unknown as SpeechProviderPlugin);
        },
      });
    }).not.toThrow();

    expect(registry.registry.speechProviders).toHaveLength(0);
    expect(registry.registry.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: "broken-provider-plugin",
          level: "error",
          message: "speech provider registration missing id",
        }),
      ]),
    );
  });
});
