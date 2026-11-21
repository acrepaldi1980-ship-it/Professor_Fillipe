// Environment packages available to the immersive screen (Prompt 3.1). A new environment is one more line here.
import { TEST_PACKAGE } from "./packages/test";
import type { EnvironmentPackage } from "./package";

export const PACKAGES: Record<string, EnvironmentPackage> = { [TEST_PACKAGE.id]: TEST_PACKAGE };
export const getPackage = (id: string) => PACKAGES[id];
