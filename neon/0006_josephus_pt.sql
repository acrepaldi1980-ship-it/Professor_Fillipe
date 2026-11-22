-- Portuguese translation of Josephus (machine translation from Whiston's English, reviewed by sampling): the English text stays as the original.
alter table josephus_sections add column if not exists text_pt text;
alter table josephus_chapters add column if not exists title_pt text;
