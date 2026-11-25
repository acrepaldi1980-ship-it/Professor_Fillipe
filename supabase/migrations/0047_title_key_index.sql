-- Entry lookup by title ("Zacchaeus"): an expression index, so the lookup is an index scan instead of a pass over every dictionary block.
create index if not exists chunks_title_first_part on chunks (lower(split_part(title_path, ',', 1))) where kind in ('dictionary', 'encyclopedia');
