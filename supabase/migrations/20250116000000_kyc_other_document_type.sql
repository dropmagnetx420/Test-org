-- Allow users to submit any document by adding a catch-all "other" type.
alter type public.id_document_type add value if not exists 'other';
