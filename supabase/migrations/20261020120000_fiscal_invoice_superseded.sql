-- Allow superseding an issued tax invoice so a corrected folio can re-issue INV.

alter table fiscal_documents
  drop constraint if exists fiscal_documents_status_check;

alter table fiscal_documents
  add constraint fiscal_documents_status_check
  check (
    status = any (
      array[
        'issued'::text,
        'void'::text,
        'superseded'::text
      ]
    )
  );

comment on column fiscal_documents.status is
  'issued = active; void = cancelled; superseded = replaced by a newer INV after folio corrections.';
