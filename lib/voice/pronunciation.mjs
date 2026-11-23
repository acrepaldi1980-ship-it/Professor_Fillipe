// Brazilian pronunciation fixes for the espeak-ng phonemizer inside Piper (sherpa-onnx), applied as `replace` lines in the pt-BR voice file of the espeak data
// (models/piper/<voice>/espeak-ng-data/lang/roa/pt-BR). Phoneme names are espeak's own mnemonics. Measured with an ASR and by phoneme listings (docs/PROGRESS.md).
//   y -> i : the unstressed final "e" ("de", "leite", "verdade") came out as the French [y]; in Brazil it is [i] ("dʒi", "lˈeitʃi").
// Tried and rejected (the voices were trained with these sounds, and the ASR error rate went up): "&" (final and pre-stress "a", [æ]) -> "a" or schwa.
export const PT_BR_PRONUNCIATION = [
  "replace 00 y i",
];
