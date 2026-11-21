// Where the pre-recorded narrations and films live: a public bucket "media" in Supabase Storage (kept out of the deploy because of the size).
const base = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/media/curiosidades`;
export const audioUrl = (id: string) => `${base()}/${id}.mp3`;
export const videoUrl = (id: string) => `${base()}/${id}.mp4`;
export const posterUrl = (id: string) => `${base()}/${id}.jpg`;
