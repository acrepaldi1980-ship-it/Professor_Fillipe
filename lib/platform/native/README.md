# Native platform (Phase 2)

Empty on purpose. In Prompt 2.5 each interface in `../types.ts` gets a Capacitor
implementation here (microphone, audio with background playback, APNs/FCM push,
native storage, share, files, haptics, status bar), and `getPlatform()` picks it
when running inside the native shell.
