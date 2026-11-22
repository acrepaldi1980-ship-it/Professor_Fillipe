-- The fast search of 0043 returned fewer and different results (78% top-12 overlap) for a small gain, so it is not used: removed.
drop function if exists api_search_chunks_fast(vector, text, text[], int, text[]);
drop function if exists search_chunks_fast(vector, text, text[], int, text[]);
