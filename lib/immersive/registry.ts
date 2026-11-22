// Environment packages available to the immersive screen (Prompt 3.1). A new environment is one more line here.
import { ARK_PACKAGE } from "./packages/arca";
import { TABERNACLE_PACKAGE } from "./packages/tabernaculo";
import { TEST_PACKAGE } from "./packages/test";
import type { EnvironmentPackage } from "./package";

export const PACKAGES: Record<string, EnvironmentPackage> = { [TABERNACLE_PACKAGE.id]: TABERNACLE_PACKAGE, [ARK_PACKAGE.id]: ARK_PACKAGE, [TEST_PACKAGE.id]: TEST_PACKAGE };
export const getPackage = (id: string) => PACKAGES[id];
/** 3D environments offered to students (the test yard stays internal). */
export const PUBLIC_PACKAGES: EnvironmentPackage[] = [TABERNACLE_PACKAGE, ARK_PACKAGE];

// 360° photo tours (Prompt 3.5b). A new tour is one more line here (or an upload in the admin tool, later).
import { ARCHAEOLOGY_TOURS } from "./panos/arqueologia";
import { JORDAO_TOUR } from "./panos/jordao";
import { JERUSALEM_TOUR } from "./panos/jerusalem";
import { PANORAMAS_TOUR } from "./panos/panoramicas";
import { TEST_TOUR } from "./panos/teste";
import type { PanoTour } from "./pano";
/** The test tour is internal: it is not listed to students (open it with ?t=panorama_teste). */
export const TOURS: Record<string, PanoTour> = Object.fromEntries([JERUSALEM_TOUR, JORDAO_TOUR, PANORAMAS_TOUR, ...ARCHAEOLOGY_TOURS, TEST_TOUR].map((x) => [x.id, x]));
export const PUBLIC_TOURS: PanoTour[] = [JERUSALEM_TOUR, JORDAO_TOUR, PANORAMAS_TOUR, ...ARCHAEOLOGY_TOURS];
export const getTour = (id: string) => TOURS[id];
