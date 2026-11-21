/** The first verse of a reference or range (so retrieval fetches a real verse: "EXO.27.1-EXO.27.2" -> "EXO.27.1"). */
export const detailRefs = (r: string): string[] => [r.split("-")[0]];
